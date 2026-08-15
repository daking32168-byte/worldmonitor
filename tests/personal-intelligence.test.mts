import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  evaluateAlertSignals,
  predictionChangeSignals,
  providerOutageSignal,
  type AlertRule,
  type AlertSignal,
  type PersonalIntelligenceSettings,
  type WatchlistEntry,
} from '../shared/personal-intelligence.ts';
import { createStableEntityId } from '../shared/global-intelligence-contract.ts';
import type { Prediction } from '../shared/prediction-engine.ts';
import { createPersonalIntelligenceRepository, type PersonalIntelligenceAdapter } from '../src/services/personal-intelligence-repository.ts';

const eventId = createStableEntityId('event', 'alert-test');
const sourceId = createStableEntityId('source', 'alert-test');
const now = '2026-08-15T12:00:00Z';
const settings: PersonalIntelligenceSettings = {
  max_notifications_per_window: 2,
  rate_window_minutes: 15,
  quiet_hours_local: null,
  timezone_offset_minutes: 480,
};

function watch(overrides: Partial<WatchlistEntry> = {}): WatchlistEntry {
  return { watch_id: 'watch_event-alert', target_type: 'EVENT', target_id: eventId, label: '港口警报', enabled: true, created_at: '2026-08-15T10:00:00Z', muted_until: null, ...overrides };
}

function rule(overrides: Partial<AlertRule> = {}): AlertRule {
  return { rule_id: 'rule_event-alert', watch_id: 'watch_event-alert', signal_types: ['BREAKOUT_RISK'], min_severity: 'WATCH', enabled: true, ...overrides };
}

function signal(id: string, cutoff: string, overrides: Partial<AlertSignal> = {}): AlertSignal {
  return {
    signal_id: `signal_${id}`,
    signal_type: 'BREAKOUT_RISK',
    target_type: 'EVENT',
    target_id: eventId,
    title: '事件进入爆发风险',
    severity: 'WARNING',
    trigger_basis: '60 分钟热度与速度阈值同时满足',
    detail_path: `/impact/${eventId}`,
    observed_at: now,
    data_cutoff_at: cutoff,
    evidence_class: 'MODELLED_IMPACT',
    source_evidence_ids: [sourceId],
    is_ai: false,
    ...overrides,
  };
}

function prediction(id: string, cutoff: string, probability: number): Prediction {
  return {
    prediction_id: createStableEntityId('pred', id),
    status: 'ACTIVE',
    target_kind: 'TREND_BURST',
    target_id: eventId,
    horizon_minutes: 60,
    data_cutoff_at: cutoff,
    generated_at: cutoff,
    expires_at: new Date(Date.parse(cutoff) + 3_600_000).toISOString(),
    model_version: 'LOCAL_BASELINE_V1',
    methodology: 'DETERMINISTIC_UNCALIBRATED_LOGISTIC_BASELINE',
    probability_estimate: probability,
    outcome_definition: 'test outcome',
    supporting_factors: [],
    counter_factors: [],
    source_evidence_ids: [sourceId],
    insufficiency_reasons: [],
    disclaimer: 'AI/模型推演，不是事实、投资建议或已证明因果；概率为未校准的本地基线估计。',
  };
}

function memoryAdapter(): PersonalIntelligenceAdapter {
  const values = new Map<string, unknown>();
  return {
    async read<T>(key: string): Promise<T | null> { return (values.get(key) as T | undefined) ?? null; },
    async write<T>(key: string, value: T): Promise<void> { values.set(key, structuredClone(value)); },
  };
}

describe('Phase 24 local watchlists and notifications', () => {
  it('deduplicates the same event and enforces a batch-aware rate limit', () => {
    const first = evaluateAlertSignals([watch()], [rule()], [
      signal('one', '2026-08-15T11:55:00Z'),
      signal('duplicate', '2026-08-15T11:55:00Z'),
      signal('two', '2026-08-15T11:56:00Z'),
      signal('three', '2026-08-15T11:57:00Z'),
    ], [], now, settings);
    assert.deepEqual(first.map((item) => item.delivery_status), ['PENDING', 'SUPPRESSED_DUPLICATE', 'PENDING', 'SUPPRESSED_RATE_LIMIT']);
    assert.equal(first[0]?.detail_path, `/impact/${eventId}`);
    assert.match(first[0]?.body ?? '', /数据截止/);
  });

  it('applies watch mute and local quiet hours without dropping the audited decision', () => {
    const muted = evaluateAlertSignals([watch({ muted_until: '2026-08-15T13:00:00Z' })], [rule()], [signal('muted', '2026-08-15T11:59:00Z')], [], now, settings);
    assert.equal(muted[0]?.delivery_status, 'SUPPRESSED_MUTED');
    const quiet = evaluateAlertSignals([watch()], [rule()], [signal('quiet', '2026-08-15T11:59:00Z')], [], now, { ...settings, quiet_hours_local: { start_hour: 19, end_hour: 23 } });
    assert.equal(quiet[0]?.delivery_status, 'SUPPRESSED_QUIET_HOURS');
  });

  it('creates separately labelled Provider outage and AI prediction reversal signals', () => {
    const outage = providerOutageSignal({ provider_id: 'licensed-news', failed_at: '2026-08-15T11:50:00Z', observed_at: now, reason: 'Three bounded executor failures' });
    assert.equal(outage.detail_path, '/provider-operations');
    assert.equal(outage.is_ai, false);
    const reversal = predictionChangeSignals([
      prediction('older', '2026-08-15T10:00:00Z', 0.42),
      prediction('newer', '2026-08-15T11:00:00Z', 0.61),
    ], now);
    assert.equal(reversal.length, 1);
    assert.equal(reversal[0]?.signal_type, 'PREDICTION_REVERSAL');
    const record = evaluateAlertSignals([], [{ rule_id: 'rule_global-prediction-reversal', watch_id: null, signal_types: ['PREDICTION_REVERSAL'], min_severity: 'WATCH', enabled: true }], reversal, [], now, settings)[0];
    assert.equal(record?.is_ai, true);
    assert.match(record?.title ?? '', /^\[AI推演\]/);
    assert.equal(record?.evidence_class, 'AI_SPECULATION');
  });

  it('persists watchlists, removes their rules atomically and keeps delivery history', async () => {
    const repository = createPersonalIntelligenceRepository(memoryAdapter());
    await repository.upsertWatch(watch());
    await repository.upsertRule(rule());
    const evaluated = await repository.evaluate([signal('persisted', '2026-08-15T11:59:00Z')], now);
    const notification = evaluated.created[0]!;
    await repository.updateNotification(notification.notification_id, { delivery_status: 'DELIVERED', delivery_message: `已发送；详情入口 ${notification.detail_path}` });
    const removed = await repository.removeWatch(watch().watch_id);
    assert.equal(Object.keys(removed.watches).length, 0);
    assert.equal(Object.keys(removed.rules).length, 0);
    assert.equal(removed.notifications[0]?.delivery_status, 'DELIVERED');
  });

  it('uses the official cross-platform Tauri plugin with least privilege and a verified manual recovery path', () => {
    const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(read('package.json'), /@tauri-apps\/plugin-notification/);
    assert.match(read('src-tauri/Cargo.toml'), /tauri-plugin-notification/);
    assert.match(read('src-tauri/src/main.rs'), /tauri_plugin_notification::init\(\)/);
    const capabilities = JSON.parse(read('src-tauri/capabilities/default.json')) as { permissions: string[] };
    assert.ok(capabilities.permissions.includes('notification:allow-is-permission-granted'));
    assert.ok(capabilities.permissions.includes('notification:allow-request-permission'));
    assert.ok(capabilities.permissions.includes('notification:allow-notify'));
    assert.equal(capabilities.permissions.some((permission) => permission.startsWith('notification:') && !['notification:allow-is-permission-granted', 'notification:allow-request-permission', 'notification:allow-notify'].includes(permission)), false);
    const manual = read('src/features/manual-action-center/manual-action-center.ts');
    assert.match(manual, /open_notification_settings/);
    assert.match(manual, /notificationPermissionState/);
    assert.match(manual, /window\.addEventListener\('focus'/);
  });
});
