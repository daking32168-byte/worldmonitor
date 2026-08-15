import {
  GLOBAL_INTELLIGENCE_IMPORT_DATASETS,
  GLOBAL_INTELLIGENCE_IMPORT_HEADERS,
  GLOBAL_INTELLIGENCE_IMPORT_LIMITS,
  sha256Text,
  type GlobalIntelligenceImportDataset,
  type GlobalIntelligenceImportSubmission,
} from '../../../shared/global-intelligence-import';
import {
  createStableEntityId,
  type AggregationLevel,
  type EvidenceClass,
  type QualityStatus,
} from '../../../shared/global-intelligence-contract';
import { globalIntelligenceLocalRepository } from '../../services/global-intelligence-local-repository';
import { notificationPermissionState } from '../../services/desktop-notifications';
import { isDesktopRuntime } from '../../services/runtime';
import { invokeTauri } from '../../services/tauri-bridge';
import './manual-action-center.css';

type StatusTone = 'neutral' | 'error' | 'success';

const DATASET_LABELS: Readonly<Record<GlobalIntelligenceImportDataset, string>> = {
  geo_units: '地理单元',
  industry_clusters: '产业集群',
  product_taxonomy: '产品分类',
  product_hs_mappings: '产品与 HS 映射',
  trade_flows: '贸易流观测',
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function field(label: string, control: HTMLElement, wide = false): HTMLLabelElement {
  const wrapper = element('label', `manual-center__field${wide ? ' manual-center__field--wide' : ''}`);
  wrapper.append(document.createTextNode(label), control);
  return wrapper;
}

function textInput(id: string, placeholder = '', type = 'text'): HTMLInputElement {
  const input = element('input');
  input.id = id;
  input.name = id;
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  return input;
}

function selectInput<T extends string>(id: string, values: readonly T[], labels?: Readonly<Partial<Record<T, string>>>): HTMLSelectElement {
  const select = element('select');
  select.id = id;
  select.name = id;
  for (const value of values) {
    const option = element('option');
    option.value = value;
    option.textContent = labels?.[value] ?? value;
    select.append(option);
  }
  return select;
}

function downloadTemplate(dataset: GlobalIntelligenceImportDataset): void {
  const content = `${GLOBAL_INTELLIGENCE_IMPORT_HEADERS[dataset].join(',')}\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = element('a');
  anchor.href = url;
  anchor.download = `${dataset}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function numberOfRecords(snapshot: Awaited<ReturnType<typeof globalIntelligenceLocalRepository.load>>): number {
  return GLOBAL_INTELLIGENCE_IMPORT_DATASETS.reduce((total, dataset) => total + Object.keys(snapshot.records[dataset]).length, 0);
}

export function initManualActionCenter(rootId: string): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Manual Action Center root #${rootId} was not found`);

  const page = element('main', 'manual-center');
  const header = element('header', 'manual-center__header');
  const heading = element('div');
  heading.append(
    element('p', 'manual-center__eyebrow', 'LOCAL · AUDITED · REVERSIBLE'),
    element('h1', undefined, '人工操作中心'),
    element('p', 'manual-center__lede', '所有需要人工选择的文件都在这里完成。应用会自动校验、计算哈希、检测冲突并验证结果；无需运行命令、寻找系统路径或编辑配置文件。'),
  );
  const home = element('a', 'manual-center__home', '返回地球');
  home.href = '/';
  header.append(heading, home);

  const grid = element('div', 'manual-center__grid');
  if (new URLSearchParams(window.location.search).get('task') === 'notification-permission') {
    const notificationCard = element('section', 'manual-center__card manual-center__card--wide');
    notificationCard.append(
      element('h2', undefined, '当前唯一人工操作：在系统设置中允许桌面通知'),
      element('p', 'manual-center__warning', '无需运行命令、寻找路径、编辑配置或提供任何密钥。点击下方按钮会直接打开当前系统的准确通知设置；完成后返回本应用，应用会自动验证。'),
    );
    const permissionState = element('p');
    permissionState.setAttribute('role', 'status');
    permissionState.setAttribute('aria-live', 'polite');
    const openSettings = element('button', undefined, '打开系统通知设置');
    openSettings.type = 'button';
    const verify = async () => {
      const state = await notificationPermissionState();
      permissionState.textContent = state === 'GRANTED'
        ? '自动验证通过：通知权限已授予。可以返回个人情报中心。'
        : `自动验证尚未通过：当前权限为 ${state}。未标记完成。`;
    };
    openSettings.addEventListener('click', () => {
      void (async () => {
        if (!isDesktopRuntime()) throw new Error('请在安装后的 Windows 或 macOS 桌面应用中执行此操作。');
        await invokeTauri<void>('open_notification_settings');
        permissionState.textContent = '系统通知设置已打开。只需为本应用允许通知，然后返回；应用会自动验证。';
      })().catch((error) => { permissionState.textContent = error instanceof Error ? error.message : String(error); });
    });
    window.addEventListener('focus', () => { void verify(); });
    notificationCard.append(openSettings, permissionState);
    grid.append(notificationCard);
    void verify();
  }
  const card = element('section', 'manual-center__card');
  card.append(
    element('h2', undefined, '本地产业主数据导入'),
    element('p', 'manual-center__warning', '安全边界：此页面不接受密钥、密码、Cookie、Token、私钥或验证码。仅导入你有权本地分析和展示的 CSV；不会激活任何外部 Provider。CSV 的 source_id 可留空，提交时会自动绑定到本页验证的来源清单。'),
  );

  const steps = element('div', 'manual-center__steps');
  ['1 选择数据类型', '2 选择 CSV', '3 Dry run', '4 提交并验证'].forEach((label, index) => {
    steps.append(element('div', `manual-center__step${index === 0 ? ' manual-center__step--active' : ''}`, label));
  });
  card.append(steps);

  const form = element('form', 'manual-center__form');
  form.noValidate = true;
  const dataset = selectInput('import-dataset', GLOBAL_INTELLIGENCE_IMPORT_DATASETS, DATASET_LABELS);
  const fileInput = textInput('import-file', '', 'file');
  fileInput.accept = '.csv,text/csv';
  const publisher = textInput('import-publisher', '例如：GLEIF / Wikidata / 官方统计机构');
  const sourceTitle = textInput('import-source-title', '数据集或发布物名称');
  const sourceUrl = textInput('import-source-url', 'https://…（可选）', 'url');
  const sourceReference = textInput('import-source-reference', '版本号、发布日期或文件编号');
  const sourcePublishedAt = textInput('import-source-published-at', '', 'date');
  const licenseReference = textInput('import-license-reference', '例如：CC0 1.0 官方许可页');
  const aggregationLevel = selectInput<AggregationLevel>('import-aggregation', [
    'GLOBAL', 'COUNTRY', 'STATE_PROVINCE', 'CITY', 'COUNTY_DISTRICT', 'TOWN', 'INDUSTRIAL_PARK', 'CLUSTER', 'COMPANY', 'FACILITY',
  ]);
  const evidenceClass = selectInput<EvidenceClass>('import-evidence-class', [
    'OFFICIAL_REGISTRY', 'OFFICIAL_CLUSTER', 'VERIFIED_COMPANY', 'VERIFIED_FACILITY', 'COMPANY_DISCLOSED', 'OBSERVED_TRADE',
  ]);
  const qualityStatus = selectInput<QualityStatus>('import-quality', ['VERIFIED', 'CORROBORATED']);
  const exportAllowed = textInput('import-export-allowed', '', 'checkbox');
  if (new URLSearchParams(window.location.search).get('task') === 'trade-import') {
    dataset.value = 'trade_flows';
    aggregationLevel.value = 'COUNTRY';
    evidenceClass.value = 'OBSERVED_TRADE';
    card.append(element('p', 'manual-center__warning', '当前已定位到贸易流导入。CSV 中引用的地理单元与产品必须先在本地仓库存在；本操作不会连接或激活任何外部 Provider。'));
  }

  form.append(
    field('1. 数据类型', dataset),
    field('2. CSV 文件（系统文件选择器）', fileInput),
    field('发布机构', publisher),
    field('来源标题', sourceTitle),
    field('官方 HTTPS 来源页（可选）', sourceUrl, true),
    field('来源版本/编号', sourceReference),
    field('来源发布日期（可选）', sourcePublishedAt),
    field('许可证依据', licenseReference, true),
    field('证据聚合层级', aggregationLevel),
    field('证据类别', evidenceClass),
    field('质量状态', qualityStatus),
    field('许可证同时允许导出', exportAllowed),
  );
  card.append(form);

  const actions = element('div', 'manual-center__actions');
  const templateButton = element('button', undefined, '下载所选空模板');
  templateButton.type = 'button';
  const sourceLink = element('a', 'manual-center__source-link', '打开准确来源页');
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  sourceLink.hidden = true;
  const dryRunButton = element('button', undefined, '运行 Dry run');
  dryRunButton.type = 'button';
  dryRunButton.dataset.primary = 'true';
  const commitButton = element('button', undefined, '提交并自动验证');
  commitButton.type = 'button';
  commitButton.disabled = true;
  const rollbackButton = element('button', undefined, '回滚最近一次导入');
  rollbackButton.type = 'button';
  actions.append(templateButton, sourceLink, dryRunButton, commitButton, rollbackButton);
  card.append(actions);

  const status = element('div', 'manual-center__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  card.append(status);

  const summaryCard = element('aside', 'manual-center__card');
  summaryCard.append(element('h2', undefined, '本地仓库状态'));
  const summary = element('div', 'manual-center__summary');
  summaryCard.append(summary, element('p', 'manual-center__muted', '写入位置由桌面安全缓存管理；在浏览器中使用 IndexedDB。提交使用文件哈希幂等，冲突不会静默覆盖。'));
  grid.append(card, summaryCard);
  page.append(header, grid);
  root.replaceChildren(page);

  let csvText: string | null = null;
  let fileName: string | null = null;
  let fileSha256: string | null = null;
  let lastDryRunSha: string | null = null;

  const setStep = (active: number) => {
    [...steps.children].forEach((node, index) => node.classList.toggle('manual-center__step--active', index <= active));
  };
  const setStatus = (message: string, tone: StatusTone = 'neutral', issues: readonly string[] = []) => {
    status.dataset.tone = tone;
    status.replaceChildren(element('p', undefined, message));
    if (issues.length > 0) {
      const list = element('ul', 'manual-center__issues');
      for (const item of issues) list.append(element('li', undefined, item));
      status.append(list);
    }
  };
  const refreshSummary = async () => {
    const snapshot = await globalIntelligenceLocalRepository.load();
    const entries: readonly [string, string][] = [
      ['Schema', `v${snapshot.schemaVersion}`],
      ['Revision', String(snapshot.revision)],
      ['事实记录', String(numberOfRecords(snapshot))],
      ['已验证来源', String(Object.keys(snapshot.evidence).length)],
      ['导入历史', String(snapshot.history.length)],
    ];
    summary.replaceChildren(...entries.map(([label, value]) => {
      const row = element('div', 'manual-center__metric');
      row.append(element('span', undefined, label), element('strong', undefined, value));
      return row;
    }));
  };
  const makeSubmission = (): GlobalIntelligenceImportSubmission => {
    if (csvText === null || fileName === null || fileSha256 === null) throw new Error('请先使用系统文件选择器选择一个 CSV 文件。');
    const selectedDataset = dataset.value as GlobalIntelligenceImportDataset;
    const permittedUses = exportAllowed.checked
      ? ['LOCAL_ANALYSIS', 'DISPLAY', 'EXPORT'] as const
      : ['LOCAL_ANALYSIS', 'DISPLAY'] as const;
    return {
      dataset: selectedDataset,
      fileName,
      csvText,
      manifest: {
        sourceId: createStableEntityId('source', `local-${selectedDataset}-${fileSha256.slice(0, 20)}`),
        providerId: 'operator-local-import',
        publisher: publisher.value,
        sourceTitle: sourceTitle.value,
        sourceUrl: sourceUrl.value.trim() || null,
        sourceReference: sourceReference.value,
        sourcePublishedAt: sourcePublishedAt.value ? `${sourcePublishedAt.value}T00:00:00Z` : null,
        licenseStatus: 'VERIFIED',
        licenseReference: licenseReference.value,
        permittedUses,
        evidenceClass: evidenceClass.value as EvidenceClass,
        aggregationLevel: aggregationLevel.value as AggregationLevel,
        qualityStatus: qualityStatus.value as QualityStatus,
      },
    };
  };

  templateButton.addEventListener('click', () => downloadTemplate(dataset.value as GlobalIntelligenceImportDataset));
  dataset.addEventListener('change', () => {
    if (dataset.value === 'trade_flows') {
      aggregationLevel.value = 'COUNTRY';
      evidenceClass.value = 'OBSERVED_TRADE';
    }
    lastDryRunSha = null;
    commitButton.disabled = true;
    setStep(csvText === null ? 0 : 1);
  });
  sourceUrl.addEventListener('input', () => {
    try {
      const url = new URL(sourceUrl.value);
      sourceLink.hidden = url.protocol !== 'https:';
      if (!sourceLink.hidden) sourceLink.href = url.href;
    } catch {
      sourceLink.hidden = true;
      sourceLink.removeAttribute('href');
    }
  });
  fileInput.addEventListener('change', () => {
    void (async () => {
      const file = fileInput.files?.[0];
      csvText = null;
      fileName = null;
      fileSha256 = null;
      lastDryRunSha = null;
      commitButton.disabled = true;
      if (!file) {
        setStep(0);
        setStatus('尚未选择文件。');
        return;
      }
      if (file.size > GLOBAL_INTELLIGENCE_IMPORT_LIMITS.maxBytes) {
        setStatus('文件超过 5 MiB 安全上限，未读取。请拆分后重试。', 'error');
        return;
      }
      csvText = await file.text();
      fileName = file.name;
      fileSha256 = await sha256Text(csvText);
      setStep(1);
      setStatus(`已读取 ${file.name}；SHA-256 ${fileSha256}。下一步填写来源与许可依据，然后运行 Dry run。`);
    })().catch((error) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
  });
  dryRunButton.addEventListener('click', () => {
    void (async () => {
      const submission = makeSubmission();
      setStatus('正在执行只读校验…');
      const result = await globalIntelligenceLocalRepository.dryRun(submission);
      if (result.status === 'INVALID') {
        lastDryRunSha = null;
        commitButton.disabled = true;
        setStep(2);
        setStatus('Dry run 未通过，未写入任何记录。', 'error', result.plan.issues.map((item) => `${item.line ? `第 ${item.line} 行` : '清单'}${item.field ? ` · ${item.field}` : ''}: ${item.message}`));
        return;
      }
      lastDryRunSha = result.plan.fileSha256;
      commitButton.disabled = result.status !== 'READY';
      setStep(2);
      setStatus(
        result.status === 'NO_CHANGE'
          ? `Dry run 通过：文件 ${result.plan.fileSha256} 已导入，无需重复提交。`
          : `Dry run 通过：将新增 ${result.plan.inserts.length} 条，保持 ${result.plan.unchangedRecordIds.length} 条不变；未发现覆盖冲突。`,
        'success',
      );
    })().catch((error) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
  });
  commitButton.addEventListener('click', () => {
    void (async () => {
      const submission = makeSubmission();
      if (lastDryRunSha !== fileSha256) throw new Error('文件或数据类型已改变，请重新运行 Dry run。');
      commitButton.disabled = true;
      setStatus('正在提交，并从持久层重新读取以验证…');
      const result = await globalIntelligenceLocalRepository.import(submission);
      if (result.status !== 'COMMITTED') {
        setStatus(result.status === 'NO_CHANGE' ? '该文件已经提交，无重复写入。' : '提交被校验器拒绝，未写入。', result.status === 'NO_CHANGE' ? 'success' : 'error');
        await refreshSummary();
        return;
      }
      const verified = await globalIntelligenceLocalRepository.load();
      const receipt = verified.history[verified.history.length - 1];
      if (verified.revision !== result.snapshot.revision || receipt?.fileSha256 !== result.plan.fileSha256) {
        throw new Error('提交后的自动验证失败；结果未标记为完成。');
      }
      setStep(3);
      setStatus(`提交并自动验证成功：revision ${verified.revision}，SHA-256 ${receipt.fileSha256}，新增 ${receipt.insertedRecordIds.length} 条。`, 'success');
      await refreshSummary();
    })().catch((error) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
  });
  rollbackButton.addEventListener('click', () => {
    void (async () => {
      setStatus('正在回滚最近一次导入并重新读取验证…');
      const result = await globalIntelligenceLocalRepository.rollback();
      if (result.status === 'NO_BACKUP') {
        setStatus('当前是初始 revision 0，没有可回滚的导入。');
      } else {
        const verified = await globalIntelligenceLocalRepository.load();
        if (verified.revision !== result.snapshot.revision) throw new Error('回滚后的自动验证失败。');
        setStatus(`已回滚 revision ${result.rolledBackRevision}；当前 revision ${verified.revision}。`, 'success');
      }
      lastDryRunSha = null;
      commitButton.disabled = true;
      await refreshSummary();
    })().catch((error) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
  });

  setStatus('先选择数据类型，再使用系统文件选择器选择 CSV。');
  void refreshSummary().catch((error) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
}
