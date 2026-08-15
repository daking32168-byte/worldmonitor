import { PRIMARY_BRAND } from '@/config/brand';
import { deliverDesktopNotification, notificationPermissionState, requestNotificationPermissionFromUserGesture } from '@/services/desktop-notifications';
import { personalIntelligenceRepository } from '@/services/personal-intelligence-repository';
import { predictionRepository } from '@/services/prediction-repository';
import { getProviderOperationsSnapshot } from '@/services/provider-operations';
import {
  ALERT_SIGNAL_TYPES,
  WATCH_TARGET_TYPES,
  predictionChangeSignals,
  providerOutageSignal,
  type AlertRule,
  type AlertSignalType,
  type WatchTargetType,
  type WatchlistEntry,
} from '../../../shared/personal-intelligence';
import './intelligence-center.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function navLink(label: string, href: string): HTMLAnchorElement {
  const node = el('a', undefined, label);
  node.href = href;
  return node;
}

function optionSelect<T extends string>(values: readonly T[]): HTMLSelectElement {
  const select = el('select');
  for (const value of values) {
    const option = el('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  return select;
}

function localId(prefix: 'watch' | 'rule'): string {
  const opaque = typeof crypto.randomUUID === 'function' ? crypto.randomUUID().toLowerCase() : `${Date.now().toString(36)}-${performance.now().toString(36).replace('.', '-')}`;
  return `${prefix}_${opaque}`;
}

function signalsFromCurrentOperations(now: string) {
  return getProviderOperationsSnapshot().flatMap((operation) => {
    const failedAt = operation.telemetry.lastExecutorFailureAt;
    if ((operation.telemetry.lastOutcome !== 'FAILURE' && operation.telemetry.lastOutcome !== 'RATE_LIMITED') || failedAt === undefined) return [];
    return [providerOutageSignal({
      provider_id: operation.id,
      failed_at: new Date(failedAt).toISOString(),
      observed_at: now,
      reason: operation.telemetry.lastMessage ?? `${operation.title} 已记录 ${operation.telemetry.lastOutcome}`,
    })];
  });
}

export function initIntelligenceCenter(rootId = 'app'): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Intelligence center root #${rootId} was not found`);
  const params = new URLSearchParams(window.location.search);

  const page = el('main', 'intel-center');
  const header = el('header', 'intel-center__header');
  const title = el('div');
  title.append(
    el('p', 'intel-center__eyebrow', PRIMARY_BRAND),
    el('h1', undefined, '个人情报中心'),
    el('p', undefined, '本地持久化自选、确定性规则、去重、限流和静音。不会因“没有 Provider”而伪报“没有事件”。'),
  );
  const nav = el('nav', 'intel-center__nav');
  nav.append(navLink('全球趋势', '/trends'), navLink('影响图谱', '/impact-graph'), navLink('Provider 运维', '/provider-operations'), navLink('返回地球', '/'));
  header.append(title, nav);

  const permissionPanel = el('section', 'intel-center__panel intel-center__permission');
  permissionPanel.append(el('h2', undefined, '桌面通知权限'));
  const permissionStatus = el('p');
  const permissionButton = el('button', undefined, '由我确认并申请通知权限');
  permissionButton.type = 'button';
  permissionPanel.append(permissionStatus, permissionButton, el('p', 'intel-center__muted', 'Windows 与 macOS 使用官方 Tauri 通知插件的最小权限；网页使用浏览器通知。只有点击此按钮才会申请系统权限。应用退出后不驻留，sidecar 也不会继续派发。'));

  const setup = el('section', 'intel-center__panel');
  setup.append(el('h2', undefined, '新增自选与规则'));
  const form = el('div', 'intel-center__form');
  const targetType = optionSelect(WATCH_TARGET_TYPES);
  const targetId = el('input');
  targetId.placeholder = '实体详情页带入的 ID；关键词直接输入文字';
  const label = el('input');
  label.placeholder = '显示名称';
  const signalType = optionSelect(ALERT_SIGNAL_TYPES.filter((type) => type !== 'PROVIDER_OUTAGE' && type !== 'PREDICTION_REVERSAL'));
  const addButton = el('button', undefined, '保存自选与规则');
  addButton.type = 'button';
  const systemOutageButton = el('button', undefined, '启用 Provider 中断告警');
  systemOutageButton.type = 'button';
  const systemPredictionButton = el('button', undefined, '启用 AI 预测反转告警');
  systemPredictionButton.type = 'button';
  form.append(targetType, targetId, label, signalType, addButton, systemOutageButton, systemPredictionButton);
  const setupStatus = el('p', 'intel-center__status');
  setupStatus.setAttribute('role', 'status');
  setup.append(form, setupStatus);

  const watchPanel = el('section', 'intel-center__panel');
  watchPanel.append(el('h2', undefined, '自选与静音'));
  const watchList = el('div', 'intel-center__list');
  watchPanel.append(watchList);

  const notificationPanel = el('section', 'intel-center__panel');
  const notificationHeading = el('div', 'intel-center__section-heading');
  notificationHeading.append(el('h2', undefined, '通知、触发依据与详情跳转'));
  const refreshButton = el('button', undefined, '自动检查并派发');
  refreshButton.type = 'button';
  notificationHeading.append(refreshButton);
  const notificationList = el('div', 'intel-center__list');
  notificationPanel.append(notificationHeading, notificationList);
  page.append(header, permissionPanel, setup, watchPanel, notificationPanel);
  root.replaceChildren(page);

  const prefillType = params.get('watchType');
  if (prefillType && WATCH_TARGET_TYPES.includes(prefillType as WatchTargetType)) targetType.value = prefillType;
  targetId.value = params.get('watchId') ?? '';
  label.value = params.get('watchLabel') ?? '';

  const refreshPermission = async () => {
    const state = await notificationPermissionState();
    permissionStatus.textContent = `当前权限：${state}`;
    permissionButton.hidden = state === 'GRANTED';
    if (state === 'DENIED') {
      permissionStatus.append(document.createTextNode('。系统已拒绝；请先进入人工操作中心，再由那里打开准确的系统通知设置。 '), navLink('打开人工操作中心', '/manual-action-center?task=notification-permission'));
    }
  };

  const render = async () => {
    const snapshot = await personalIntelligenceRepository.load();
    const rulesByWatch = new Map<string, AlertRule[]>();
    for (const rule of Object.values(snapshot.rules)) {
      const key = rule.watch_id ?? 'SYSTEM';
      rulesByWatch.set(key, [...(rulesByWatch.get(key) ?? []), rule]);
    }
    watchList.replaceChildren();
    const systemRules = rulesByWatch.get('SYSTEM') ?? [];
    if (Object.keys(snapshot.watches).length === 0 && systemRules.length === 0) watchList.append(el('p', 'intel-center__muted', '尚无自选。可从实体详情页带入，也可在上方新增。'));
    for (const watch of Object.values(snapshot.watches)) {
      const card = el('article', 'intel-center__card');
      card.append(el('h3', undefined, watch.label), el('p', undefined, `${watch.target_type} · ${watch.target_id}`), el('p', undefined, `规则：${(rulesByWatch.get(watch.watch_id) ?? []).flatMap((rule) => rule.signal_types).join(', ') || '无'}`));
      const controls = el('div', 'intel-center__controls');
      const mute = el('button', undefined, watch.muted_until && Date.parse(watch.muted_until) > Date.now() ? '取消静音' : '静音 1 小时');
      mute.type = 'button';
      mute.addEventListener('click', () => {
        void personalIntelligenceRepository.upsertWatch({ ...watch, muted_until: watch.muted_until && Date.parse(watch.muted_until) > Date.now() ? null : new Date(Date.now() + 3_600_000).toISOString() }).then(render);
      });
      const remove = el('button', undefined, '移除');
      remove.type = 'button';
      remove.addEventListener('click', () => { void personalIntelligenceRepository.removeWatch(watch.watch_id).then(render); });
      controls.append(mute, remove);
      card.append(el('p', 'intel-center__muted', watch.muted_until ? `静音至 ${watch.muted_until}` : '未静音'), controls);
      watchList.append(card);
    }
    if (systemRules.length > 0) {
      const systemCard = el('article', 'intel-center__card');
      systemCard.append(el('h3', undefined, '系统级规则'), el('p', undefined, systemRules.flatMap((rule) => rule.signal_types).join(', ')));
      watchList.append(systemCard);
    }

    notificationList.replaceChildren();
    const notifications = [...snapshot.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (notifications.length === 0) notificationList.append(el('p', 'intel-center__muted', '尚无通知。这里只显示真实规则计算结果，不使用演示数据。'));
    for (const notification of notifications) {
      const card = el('article', 'intel-center__card');
      card.dataset.deliveryStatus = notification.delivery_status;
      card.append(
        el('span', 'intel-center__badge', notification.delivery_status),
        el('h3', undefined, notification.title),
        el('p', undefined, notification.body),
        el('p', 'intel-center__basis', `触发依据：${notification.trigger_basis}`),
        el('p', 'intel-center__muted', `证据等级 ${notification.evidence_class} · 来源证据 ${notification.source_evidence_ids.length} · ${notification.delivery_message ?? '待派发'}`),
        navLink('打开准确详情页', notification.detail_path),
      );
      notificationList.append(card);
    }
  };

  const addGlobalRule = async (type: 'PROVIDER_OUTAGE' | 'PREDICTION_REVERSAL') => {
    await personalIntelligenceRepository.upsertRule({ rule_id: `rule_global-${type.toLowerCase().replace(/_/g, '-')}`, watch_id: null, signal_types: [type], min_severity: 'WATCH', enabled: true });
    setupStatus.textContent = `${type} 告警已启用。`;
    await render();
  };

  addButton.addEventListener('click', () => {
    void (async () => {
      const watch: WatchlistEntry = {
        watch_id: localId('watch'),
        target_type: targetType.value as WatchTargetType,
        target_id: targetId.value.trim(),
        label: label.value.trim(),
        enabled: true,
        created_at: new Date().toISOString(),
        muted_until: null,
      };
      await personalIntelligenceRepository.upsertWatch(watch);
      await personalIntelligenceRepository.upsertRule({ rule_id: localId('rule'), watch_id: watch.watch_id, signal_types: [signalType.value as AlertSignalType], min_severity: 'WATCH', enabled: true });
      setupStatus.textContent = '自选与规则已保存到本地持久层。';
      await render();
    })().catch((error) => { setupStatus.textContent = error instanceof Error ? error.message : String(error); });
  });
  systemOutageButton.addEventListener('click', () => { void addGlobalRule('PROVIDER_OUTAGE').catch((error) => { setupStatus.textContent = String(error); }); });
  systemPredictionButton.addEventListener('click', () => { void addGlobalRule('PREDICTION_REVERSAL').catch((error) => { setupStatus.textContent = String(error); }); });
  permissionButton.addEventListener('click', () => {
    void requestNotificationPermissionFromUserGesture().then(async () => {
      await refreshPermission();
      const snapshot = await personalIntelligenceRepository.load();
      for (const notification of snapshot.notifications.filter((item) => item.delivery_status === 'PERMISSION_REQUIRED')) {
        const outcome = await deliverDesktopNotification(notification);
        await personalIntelligenceRepository.updateNotification(notification.notification_id, { delivery_status: outcome.status, delivery_message: outcome.message });
      }
      await render();
    }).catch((error) => { permissionStatus.textContent = error instanceof Error ? error.message : String(error); });
  });
  refreshButton.addEventListener('click', () => {
    void (async () => {
      refreshButton.disabled = true;
      const now = new Date().toISOString();
      const signals = [
        ...signalsFromCurrentOperations(now),
        ...predictionChangeSignals(await predictionRepository.history(), now),
      ];
      const result = await personalIntelligenceRepository.evaluate(signals, now);
      for (const notification of result.created.filter((item) => item.delivery_status === 'PENDING')) {
        const outcome = await deliverDesktopNotification(notification);
        await personalIntelligenceRepository.updateNotification(notification.notification_id, { delivery_status: outcome.status, delivery_message: outcome.message });
      }
      setupStatus.textContent = signals.length === 0 ? '检查完成：当前没有真实 Provider 中断或预测反转信号。' : `检查完成：处理 ${signals.length} 个真实信号。`;
      await render();
    })().catch((error) => { setupStatus.textContent = error instanceof Error ? error.message : String(error); }).finally(() => { refreshButton.disabled = false; });
  });

  void Promise.all([refreshPermission(), render()]).catch((error) => { setupStatus.textContent = error instanceof Error ? error.message : String(error); });
}
