import { PRIMARY_BRAND } from '@/config/brand';
import { maritimeLogisticsUrl } from '@/features/maritime-logistics/maritime-logistics-route';
import { providerOperationsUrl } from '@/features/provider-operations/provider-operations-route';
import {
  exportTradeFlowsCsv,
  tradeFlowAvailability,
  type TradeFlowObservation,
  type TradeLogisticsRegistry,
} from '../../../shared/trade-logistics';
import { tradeLogisticsRepository } from '../../services/trade-logistics-repository';
import './trade-flows.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function metric(label: string, value: number): HTMLElement {
  const card = el('article', 'trade-flows__metric');
  card.append(el('strong', undefined, String(value)), el('span', undefined, label));
  return card;
}

function formatNumber(value: number | null, unit: string | null): string {
  if (value === null) return '来源未提供';
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(value)}${unit ? ` ${unit}` : ''}`;
}

function downloadCsv(flows: readonly TradeFlowObservation[]): void {
  const url = URL.createObjectURL(new Blob([exportTradeFlowsCsv(flows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = el('a');
  anchor.href = url;
  anchor.download = 'trade-flows-authorized.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function render(root: HTMLElement, registry: TradeLogisticsRegistry): void {
  const state = tradeFlowAvailability(registry);
  const shell = el('main', 'trade-flows__shell');
  const header = el('header', 'trade-flows__header');
  const title = el('div');
  title.append(el('p', 'trade-flows__eyebrow', PRIMARY_BRAND), el('h1', undefined, '贸易流向与多式联运'));
  title.append(el('p', 'trade-flows__subtitle', '把国家贸易、许可装运、物流观测与模型路线分层显示；没有证据时不生成流向。'));
  const nav = el('nav', 'trade-flows__nav');
  const industry = el('a', undefined, '产业情报地图');
  industry.href = '/industry-map';
  const maritime = el('a', undefined, '海事与港口观测');
  maritime.href = maritimeLogisticsUrl();
  const importer = el('a', undefined, '人工操作中心导入');
  importer.href = '/manual-action-center?task=trade-import';
  const operations = el('a', undefined, 'Provider 运维');
  operations.href = providerOperationsUrl();
  nav.append(industry, maritime, importer, operations);
  header.append(title, nav);
  shell.append(header);

  const banner = el('section', 'trade-flows__banner');
  banner.dataset.status = state.status;
  banner.append(el('strong', undefined, state.status === 'NOT_CONFIGURED' ? 'Provider 未配置；尚无可展示观测' : '已有经验证观测'));
  banner.append(el('p', undefined, state.status === 'NOT_CONFIGURED'
    ? '外部 Provider 未被激活；可在人工操作中心选择具有本地分析与展示权的 CSV。系统先 Dry run，再提交并自动验证。'
    : '以下记录均保留来源、期间、单位、聚合层级与许可边界；导出还需来源明确允许 EXPORT。'));
  shell.append(banner);

  const metrics = el('section', 'trade-flows__metrics');
  metrics.append(
    metric('国家/产品实际观测', state.observedFlowCount),
    metric('许可装运观测', state.shipmentCount),
    metric('实际物流路线', state.observedRouteCount),
    metric('模型路线', state.modelledRouteCount),
  );
  shell.append(metrics);

  const legend = el('section', 'trade-flows__panel');
  legend.append(el('h2', undefined, '图例与证据层'));
  const legendList = el('ul', 'trade-flows__legend');
  const layers = [
    ['trade-flows__swatch--observed', '实际观测', 'Provider 或合法文件明确提供，保留原始聚合层级。'],
    ['trade-flows__swatch--disclosed', '企业披露', '只表达企业公开披露，不自动升级为装运事实。'],
    ['trade-flows__swatch--modelled', '模型路线', '带方法版本的估算，绝不显示为实际流。'],
  ] as const;
  for (const [className, label, copy] of layers) {
    const item = el('li');
    item.append(el('span', `trade-flows__swatch ${className}`), el('strong', undefined, label), document.createTextNode(` — ${copy}`));
    legendList.append(item);
  }
  legend.append(legendList);
  shell.append(legend);

  const boundaries = el('section', 'trade-flows__panel');
  boundaries.append(el('h2', undefined, '强制真实性边界'));
  const list = el('ul');
  for (const copy of [
    'AIS 只证明船舶自报/观测字段，不能生成货物、买方、工厂、提单或实际目的港。',
    '国家级贸易不会下推为企业、工厂、港口或单票出口。',
    '海运、空运、铁路、公路和多式联运使用同一合同，但实际与模型路线永久分层。',
    '导出保留期间、数值单位、来源证据 ID 和原始聚合层级。',
  ]) list.append(el('li', undefined, copy));
  boundaries.append(list);
  shell.append(boundaries);

  const observations = el('section', 'trade-flows__panel');
  const observationsHeader = el('div', 'trade-flows__panel-heading');
  observationsHeader.append(el('h2', undefined, '可展示记录'));
  const exportButton = el('button', 'trade-flows__export', '导出有权限的记录');
  exportButton.type = 'button';
  exportButton.addEventListener('click', () => {
    void tradeLogisticsRepository.exportableFlows().then((flows) => {
      if (flows.length === 0) throw new Error('当前来源没有授予 EXPORT 权限。');
      downloadCsv(flows);
    }).catch((error) => window.alert(error instanceof Error ? error.message : String(error)));
  });
  observationsHeader.append(exportButton);
  observations.append(observationsHeader);
  if (registry.flows.length === 0 && registry.shipments.length === 0) {
    observations.append(el('p', 'trade-flows__empty', '当前无经许可且通过来源验证的贸易或装运记录。空状态不代表贸易量为零。'));
  }
  for (const flow of registry.flows) {
    const source = registry.evidence.find((item) => item.sourceId === flow.evidence_id);
    const card = el('article', 'trade-flows__observation');
    const heading = el('div', 'trade-flows__observation-heading');
    heading.append(el('strong', undefined, `${flow.origin_geo_id} → ${flow.destination_geo_id}`), el('span', undefined, `${flow.trade_direction} · ${flow.origin_aggregation_level}`));
    const facts = el('dl', 'trade-flows__facts');
    for (const [label, value] of [
      ['产品 / HS', `${flow.product_id} · ${flow.hs_version} ${flow.hs_code}`],
      ['期间', `${flow.period_start} — ${flow.period_end}`],
      ['货值', formatNumber(flow.value, flow.value_currency)],
      ['数量', formatNumber(flow.quantity, flow.quantity_unit)],
      ['净重', formatNumber(flow.net_weight_kg, flow.net_weight_kg === null ? null : 'kg')],
      ['运输方式', flow.transport_mode ?? '来源未提供'],
    ] as const) facts.append(el('dt', undefined, label), el('dd', undefined, value));
    const sourceLine = el('p', 'trade-flows__source');
    sourceLine.append(document.createTextNode(`证据 ${flow.evidence_id} · 许可 ${source?.licenseStatus ?? 'UNKNOWN'} · 质量 ${flow.quality_status}`));
    if (source?.sourceUrl) {
      const link = el('a', undefined, '打开来源');
      link.href = source.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      sourceLine.append(document.createTextNode(' · '), link);
    }
    card.append(heading, facts, sourceLine);
    observations.append(card);
  }
  shell.append(observations);
  root.replaceChildren(shell);
}

export function initTradeFlowsWorkspace(rootId = 'app'): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Trade flows root #${rootId} was not found.`);
  root.className = 'trade-flows';
  root.replaceChildren(el('p', 'trade-flows__loading', '正在读取本地持久化贸易记录…'));
  void tradeLogisticsRepository.load()
    .then((registry) => render(root, registry))
    .catch((error) => {
      const failure = el('main', 'trade-flows__shell');
      failure.append(el('h1', undefined, '贸易记录读取失败'), el('p', 'trade-flows__empty', error instanceof Error ? error.message : String(error)));
      root.replaceChildren(failure);
    });
}
