/** Phase 24 deterministic local watchlist, alert, dedupe, mute and rate-limit contract. */

import { assertStableEntityId, type EvidenceClass, type StableEntityId } from './global-intelligence-contract';
import type { Prediction } from './prediction-engine';

export const WATCH_TARGET_TYPES = [
  'EVENT',
  'KEYWORD',
  'PRODUCT',
  'GEO_UNIT',
  'INDUSTRY_CLUSTER',
  'COMPANY',
  'FACILITY',
  'SECURITY',
  'LOGISTICS_NODE',
  'LOGISTICS_ROUTE',
] as const;
export type WatchTargetType = (typeof WATCH_TARGET_TYPES)[number];

export const ALERT_SIGNAL_TYPES = [
  'TREND_FAST_RISING',
  'BREAKOUT_RISK',
  'CROSS_PLATFORM_RESONANCE',
  'OFFICIAL_CONFIRMATION',
  'OFFICIAL_RETRACTION',
  'INFRASTRUCTURE_ANOMALY',
  'TRADE_FLOW_CHANGE',
  'MARKET_ANOMALY',
  'EXCHANGE_STATE_CHANGE',
  'AI_PREDICTION_CHANGE',
  'PREDICTION_REVERSAL',
  'PROVIDER_OUTAGE',
] as const;
export type AlertSignalType = (typeof ALERT_SIGNAL_TYPES)[number];

export type AlertSeverity = 'INFO' | 'WATCH' | 'WARNING' | 'CRITICAL';

export type WatchlistEntry = Readonly<{
  watch_id: string;
  target_type: WatchTargetType;
  target_id: string;
  label: string;
  enabled: boolean;
  created_at: string;
  muted_until: string | null;
}>;

export type AlertRule = Readonly<{
  rule_id: string;
  watch_id: string | null;
  signal_types: readonly AlertSignalType[];
  min_severity: AlertSeverity;
  enabled: boolean;
}>;

export type AlertSignal = Readonly<{
  signal_id: string;
  signal_type: AlertSignalType;
  target_type: WatchTargetType | 'PROVIDER';
  target_id: string;
  title: string;
  severity: AlertSeverity;
  trigger_basis: string;
  detail_path: string;
  observed_at: string;
  data_cutoff_at: string;
  evidence_class: EvidenceClass;
  source_evidence_ids: readonly StableEntityId[];
  is_ai: boolean;
}>;

export type PersonalIntelligenceSettings = Readonly<{
  max_notifications_per_window: number;
  rate_window_minutes: number;
  quiet_hours_local: Readonly<{ start_hour: number; end_hour: number }> | null;
  timezone_offset_minutes: number;
}>;

export type LocalNotificationRecord = Readonly<{
  notification_id: string;
  dedupe_key: string;
  rule_id: string;
  watch_id: string | null;
  signal_id: string;
  title: string;
  body: string;
  detail_path: string;
  trigger_basis: string;
  data_cutoff_at: string;
  evidence_class: EvidenceClass;
  source_evidence_ids: readonly StableEntityId[];
  is_ai: boolean;
  created_at: string;
  delivery_status: 'PENDING' | 'DELIVERED' | 'SUPPRESSED_DUPLICATE' | 'SUPPRESSED_MUTED' | 'SUPPRESSED_QUIET_HOURS' | 'SUPPRESSED_RATE_LIMIT' | 'PERMISSION_REQUIRED' | 'FAILED';
  delivery_message: string | null;
  read_at: string | null;
}>;

const SEVERITY_RANK: Readonly<Record<AlertSeverity, number>> = { INFO: 0, WATCH: 1, WARNING: 2, CRITICAL: 3 };
const WATCH_ID = /^watch_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const RULE_ID = /^rule_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const SIGNAL_ID = /^signal_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of value.normalize('NFKC')) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!value.trim() || !Number.isFinite(parsed)) throw new Error(`${field} must be an ISO timestamp`);
  return parsed;
}

function assertAppPath(value: string): void {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) throw new Error('detail_path must be an application-relative path');
}

function targetPrefix(targetType: Exclude<WatchTargetType, 'KEYWORD'>): Parameters<typeof assertStableEntityId>[1] {
  return ({
    EVENT: 'event',
    PRODUCT: 'product',
    GEO_UNIT: 'geo',
    INDUSTRY_CLUSTER: 'cluster',
    COMPANY: 'company',
    FACILITY: 'facility',
    SECURITY: 'security',
    LOGISTICS_NODE: 'node',
    LOGISTICS_ROUTE: 'route',
  } as const)[targetType];
}

export function assertWatchlistEntry(entry: WatchlistEntry): void {
  if (!WATCH_ID.test(entry.watch_id)) throw new Error(`Invalid watch ID ${entry.watch_id}`);
  if (!WATCH_TARGET_TYPES.includes(entry.target_type)) throw new Error(`Invalid watch target type ${entry.target_type}`);
  if (!entry.label.trim()) throw new Error('Watch label is required');
  timestamp(entry.created_at, 'created_at');
  if (entry.muted_until !== null) timestamp(entry.muted_until, 'muted_until');
  if (entry.target_type === 'KEYWORD') {
    if (entry.target_id.trim().length < 2 || entry.target_id.length > 120) throw new Error('Keyword watch requires 2–120 characters');
  } else {
    assertStableEntityId(entry.target_id, targetPrefix(entry.target_type));
  }
}

export function assertAlertRule(rule: AlertRule, watches: ReadonlyMap<string, WatchlistEntry>): void {
  if (!RULE_ID.test(rule.rule_id)) throw new Error(`Invalid rule ID ${rule.rule_id}`);
  if (rule.watch_id !== null && !watches.has(rule.watch_id)) throw new Error(`Unknown watch ${rule.watch_id}`);
  if (rule.signal_types.length === 0 || new Set(rule.signal_types).size !== rule.signal_types.length) throw new Error('Alert rule requires unique signal types');
  if (!rule.signal_types.every((type) => ALERT_SIGNAL_TYPES.includes(type))) throw new Error('Alert rule includes an unsupported signal type');
  if (rule.watch_id === null && !rule.signal_types.every((type) => type === 'PROVIDER_OUTAGE' || type === 'PREDICTION_REVERSAL')) {
    throw new Error('Only Provider outage and prediction reversal rules may be global');
  }
}

export function assertAlertSignal(signal: AlertSignal): void {
  if (!SIGNAL_ID.test(signal.signal_id)) throw new Error(`Invalid signal ID ${signal.signal_id}`);
  if (!ALERT_SIGNAL_TYPES.includes(signal.signal_type)) throw new Error(`Unsupported signal type ${signal.signal_type}`);
  if (!signal.target_id.trim() || !signal.title.trim() || !signal.trigger_basis.trim()) throw new Error('Alert signal identity, title and trigger basis are required');
  assertAppPath(signal.detail_path);
  timestamp(signal.observed_at, 'observed_at');
  timestamp(signal.data_cutoff_at, 'data_cutoff_at');
  if (Date.parse(signal.data_cutoff_at) > Date.parse(signal.observed_at)) throw new Error('data_cutoff_at cannot be after observed_at');
  for (const id of signal.source_evidence_ids) assertStableEntityId(id, 'source');
  const aiType = signal.signal_type === 'AI_PREDICTION_CHANGE' || signal.signal_type === 'PREDICTION_REVERSAL';
  if (aiType !== signal.is_ai || (signal.is_ai && signal.evidence_class !== 'AI_SPECULATION')) {
    throw new Error('AI prediction signals require is_ai and AI_SPECULATION evidence class');
  }
  if (signal.signal_type === 'PROVIDER_OUTAGE' && signal.target_type !== 'PROVIDER') throw new Error('Provider outage signals require a PROVIDER target');
}

function matchesWatch(watch: WatchlistEntry, signal: AlertSignal): boolean {
  if (!watch.enabled) return false;
  if (watch.target_type === 'KEYWORD') {
    const needle = watch.target_id.normalize('NFKC').toLocaleLowerCase();
    return `${signal.title}\n${signal.trigger_basis}`.normalize('NFKC').toLocaleLowerCase().includes(needle);
  }
  return watch.target_type === signal.target_type && watch.target_id === signal.target_id;
}

function inQuietHours(now: number, settings: PersonalIntelligenceSettings): boolean {
  const quiet = settings.quiet_hours_local;
  if (!quiet) return false;
  const localHour = new Date(now + settings.timezone_offset_minutes * 60_000).getUTCHours();
  return quiet.start_hour === quiet.end_hour
    ? true
    : quiet.start_hour < quiet.end_hour
      ? localHour >= quiet.start_hour && localHour < quiet.end_hour
      : localHour >= quiet.start_hour || localHour < quiet.end_hour;
}

export function evaluateAlertSignals(
  watches: readonly WatchlistEntry[],
  rules: readonly AlertRule[],
  signals: readonly AlertSignal[],
  existingNotifications: readonly LocalNotificationRecord[],
  nowIso: string,
  settings: PersonalIntelligenceSettings,
): readonly LocalNotificationRecord[] {
  const now = timestamp(nowIso, 'now');
  if (!Number.isInteger(settings.max_notifications_per_window) || settings.max_notifications_per_window < 1 || settings.max_notifications_per_window > 20) throw new Error('Notification rate cap must be 1–20');
  if (!Number.isInteger(settings.rate_window_minutes) || settings.rate_window_minutes < 1 || settings.rate_window_minutes > 1440) throw new Error('Notification rate window must be 1–1440 minutes');
  if (!Number.isInteger(settings.timezone_offset_minutes) || Math.abs(settings.timezone_offset_minutes) > 14 * 60) throw new Error('Invalid notification timezone offset');
  if (settings.quiet_hours_local && [settings.quiet_hours_local.start_hour, settings.quiet_hours_local.end_hour].some((hour) => !Number.isInteger(hour) || hour < 0 || hour > 23)) throw new Error('Quiet hours must use 0–23 local hours');

  const watchMap = new Map(watches.map((watch) => {
    assertWatchlistEntry(watch);
    return [watch.watch_id, watch] as const;
  }));
  for (const rule of rules) assertAlertRule(rule, watchMap);
  for (const signal of signals) assertAlertSignal(signal);
  const previousKeys = new Set(existingNotifications.filter((item) => item.delivery_status !== 'SUPPRESSED_DUPLICATE').map((item) => item.dedupe_key));
  const windowStart = now - settings.rate_window_minutes * 60_000;
  let rateSlotsUsed = existingNotifications.filter((item) => item.delivery_status === 'DELIVERED' && Date.parse(item.created_at) >= windowStart).length;
  const produced: LocalNotificationRecord[] = [];

  for (const signal of [...signals].sort((a, b) => a.observed_at.localeCompare(b.observed_at) || a.signal_id.localeCompare(b.signal_id))) {
    for (const rule of [...rules].sort((a, b) => a.rule_id.localeCompare(b.rule_id))) {
      if (!rule.enabled || !rule.signal_types.includes(signal.signal_type) || SEVERITY_RANK[signal.severity] < SEVERITY_RANK[rule.min_severity]) continue;
      const watch = rule.watch_id === null ? null : watchMap.get(rule.watch_id) ?? null;
      if (watch ? !matchesWatch(watch, signal) : signal.signal_type !== 'PROVIDER_OUTAGE' && signal.signal_type !== 'PREDICTION_REVERSAL') continue;
      const dedupeKey = `${rule.rule_id}:${signal.signal_type}:${signal.target_type}:${signal.target_id}:${signal.data_cutoff_at}`;
      let status: LocalNotificationRecord['delivery_status'] = 'PENDING';
      let message: string | null = null;
      if (previousKeys.has(dedupeKey)) {
        status = 'SUPPRESSED_DUPLICATE';
        message = '相同对象、规则和数据截止时间已处理。';
      } else if (watch?.muted_until && Date.parse(watch.muted_until) > now) {
        status = 'SUPPRESSED_MUTED';
        message = `自选已静音至 ${watch.muted_until}。`;
      } else if (inQuietHours(now, settings)) {
        status = 'SUPPRESSED_QUIET_HOURS';
        message = '当前处于本地静音时段。';
      } else if (rateSlotsUsed >= settings.max_notifications_per_window) {
        status = 'SUPPRESSED_RATE_LIMIT';
        message = `${settings.rate_window_minutes} 分钟窗口内已达到 ${settings.max_notifications_per_window} 条上限。`;
      } else {
        rateSlotsUsed += 1;
        previousKeys.add(dedupeKey);
      }
      const title = signal.is_ai ? `[AI推演] ${signal.title}` : signal.title;
      produced.push(Object.freeze({
        notification_id: `notification_${fnv1a64(`${dedupeKey}:${nowIso}:${status}`)}`,
        dedupe_key: dedupeKey,
        rule_id: rule.rule_id,
        watch_id: rule.watch_id,
        signal_id: signal.signal_id,
        title,
        body: `${signal.trigger_basis} · 数据截止 ${signal.data_cutoff_at}`,
        detail_path: signal.detail_path,
        trigger_basis: signal.trigger_basis,
        data_cutoff_at: signal.data_cutoff_at,
        evidence_class: signal.evidence_class,
        source_evidence_ids: signal.source_evidence_ids,
        is_ai: signal.is_ai,
        created_at: nowIso,
        delivery_status: status,
        delivery_message: message,
        read_at: null,
      }));
    }
  }
  return Object.freeze(produced);
}

export function predictionChangeSignals(predictions: readonly Prediction[], observedAt: string): readonly AlertSignal[] {
  timestamp(observedAt, 'observed_at');
  const grouped = new Map<string, Prediction[]>();
  for (const prediction of predictions) {
    const key = `${prediction.target_kind}:${prediction.target_id}:${prediction.horizon_minutes}`;
    const list = grouped.get(key) ?? [];
    list.push(prediction);
    grouped.set(key, list);
  }
  const signals: AlertSignal[] = [];
  for (const list of grouped.values()) {
    const ordered = [...list].sort((a, b) => a.data_cutoff_at.localeCompare(b.data_cutoff_at) || a.prediction_id.localeCompare(b.prediction_id));
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]!;
      const current = ordered[index]!;
      if (current.status !== 'ACTIVE' || previous.status !== 'ACTIVE' || current.probability_estimate === null || previous.probability_estimate === null) continue;
      const crossed = (previous.probability_estimate < 0.5 && current.probability_estimate >= 0.5) || (previous.probability_estimate >= 0.5 && current.probability_estimate < 0.5);
      const delta = current.probability_estimate - previous.probability_estimate;
      if (!crossed && Math.abs(delta) < 0.2) continue;
      const signalType: AlertSignalType = crossed ? 'PREDICTION_REVERSAL' : 'AI_PREDICTION_CHANGE';
      signals.push(Object.freeze({
        signal_id: `signal_prediction-${fnv1a64(`${previous.prediction_id}:${current.prediction_id}`)}`,
        signal_type: signalType,
        target_type: current.target_kind === 'ASSET_IMPACT' ? 'SECURITY' : current.target_kind === 'INDUSTRY_IMPACT' ? 'INDUSTRY_CLUSTER' : current.target_kind === 'LOGISTICS_DISRUPTION' ? 'LOGISTICS_ROUTE' : 'EVENT',
        target_id: current.target_id,
        title: `${current.target_kind} 概率${crossed ? '跨越 50% 阈值' : '显著变化'}`,
        severity: crossed ? 'WARNING' : 'WATCH',
        trigger_basis: `LOCAL_BASELINE_V1 从 ${(previous.probability_estimate * 100).toFixed(1)}% 变为 ${(current.probability_estimate * 100).toFixed(1)}%；变化 ${(delta * 100).toFixed(1)} 个百分点`,
        detail_path: '/predictions',
        observed_at: observedAt,
        data_cutoff_at: current.data_cutoff_at,
        evidence_class: 'AI_SPECULATION',
        source_evidence_ids: current.source_evidence_ids,
        is_ai: true,
      }));
    }
  }
  return Object.freeze(signals);
}

export function providerOutageSignal(input: Readonly<{
  provider_id: string;
  failed_at: string;
  observed_at: string;
  reason: string;
}>): AlertSignal {
  timestamp(input.failed_at, 'failed_at');
  timestamp(input.observed_at, 'observed_at');
  if (!input.provider_id.trim() || !input.reason.trim()) throw new Error('Provider outage requires provider identity and reason');
  return Object.freeze({
    signal_id: `signal_provider-${fnv1a64(`${input.provider_id}:${input.failed_at}`)}`,
    signal_type: 'PROVIDER_OUTAGE',
    target_type: 'PROVIDER',
    target_id: input.provider_id,
    title: `Provider 中断：${input.provider_id}`,
    severity: 'WARNING',
    trigger_basis: input.reason,
    detail_path: '/provider-operations',
    observed_at: input.observed_at,
    data_cutoff_at: input.failed_at,
    evidence_class: 'UNVERIFIED',
    source_evidence_ids: [],
    is_ai: false,
  });
}
