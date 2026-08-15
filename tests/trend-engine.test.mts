import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createStableEntityId } from '../shared/global-intelligence-contract.ts';
import {
  DEFAULT_TREND_ENGINE_CONFIG,
  TREND_REALTIME_PROVIDER,
  computePropagationPath,
  computeTrendPoint,
  computeTrendSnapshot,
  serializeTrendSse,
  transitionTrendState,
} from '../shared/trend-engine.ts';
import type { ContentPlatform, SourceItem } from '../shared/content-event-normalization.ts';
import {
  connectTrendRealtime,
  validateTrendSseEndpoint,
  type TrendEventSource,
} from '../src/services/trend-realtime.ts';
import { isTrendsPath, parseTrendsRoute, trendsUrl } from '../src/features/trends/trends-route.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const eventId = createStableEntityId('event', 'phase20-deterministic');

function item(index: number, overrides: Partial<SourceItem> = {}): SourceItem {
  const platform = (['NEWS', 'X', 'BILIBILI'] as const)[index % 3] as ContentPlatform;
  const minute = String(10 + index).padStart(2, '0');
  return {
    item_id: createStableEntityId('item', `phase20-${index}`),
    provider_id: `fixture-${platform.toLowerCase()}`,
    platform,
    platform_item_id: `platform-${index}`,
    original_url: `https://example.invalid/items/${index}`,
    canonical_url: `https://example.invalid/items/${index}`,
    author_id: `author-${index}`,
    author_handle: `@author-${index}`,
    published_at: `2026-08-15T01:${minute}:00Z`,
    retrieved_at: '2026-08-15T02:00:00Z',
    language: 'en',
    title: `Event observation ${index}`,
    body: `Independent content ${index}`,
    content_fingerprint: `fingerprint-${index}`,
    confirmation_status: platform === 'NEWS' ? 'PUBLISHER_REPORTED' : 'SOCIAL_SIGNAL',
    license_status: 'VERIFIED',
    permits_display: true,
    permits_export: false,
    author_audience_size: 1_000,
    engagement_count: 10,
    entity_ids: [],
    geo_ids: [],
    ...overrides,
  };
}

describe('Phase 20 explainable trend engine', () => {
  it('returns deterministic snapshots for the same inputs and all required windows', () => {
    const items = [item(0), item(1), item(2), item(3)];
    const first = computeTrendSnapshot(eventId, items, '2026-08-15T02:00:00Z');
    const second = computeTrendSnapshot(eventId, items, '2026-08-15T02:00:00Z');
    assert.deepEqual(first, second);
    assert.deepEqual(first.points.map((point) => point.window_minutes), [5, 15, 30, 60, 360, 1440, 10_080, 43_200]);
    assert.equal(first.points.every((point) => point.algorithm_version === 'TREND_EXPLAINABLE_V1'), true);
    assert.equal(first.points.every((point) => point.trend_point_id.startsWith('trend_')), true);
  });

  it('does not linearly amplify identical reposts', () => {
    const original = item(0);
    const reposts = Array.from({ length: 12 }, (_, index) => item(index + 1, {
      platform: 'X',
      author_id: 'same-author',
      author_handle: '@same-author',
      content_fingerprint: original.content_fingerprint,
      published_at: `2026-08-15T01:${String(20 + index).padStart(2, '0')}:00Z`,
    }));
    const point = computeTrendPoint(eventId, [original, ...reposts], '2026-08-15T02:00:00Z', 60);
    assert.equal(point.unique_content_count, 1);
    assert.equal(point.independent_author_count, 2);
    assert.ok(point.heat_score < 40, `expected bounded heat, received ${point.heat_score}`);
  });

  it('distinguishes one large account from many independent small authors', () => {
    const large = computeTrendPoint(eventId, [item(0, { author_audience_size: 2_000_000 })], '2026-08-15T02:00:00Z', 60);
    const many = computeTrendPoint(eventId, Array.from({ length: 8 }, (_, index) => item(index)), '2026-08-15T02:00:00Z', 60);
    assert.equal(large.large_account_author_count, 1);
    assert.equal(large.audience_concentration, 1);
    assert.equal(many.large_account_author_count, 0);
    assert.equal(many.independent_author_count, 8);
    assert.ok(many.audience_concentration < large.audience_concentration);
    assert.ok(many.heat_score > large.heat_score);
  });

  it('records reasons across the NORMAL to RESOLVED state machine', () => {
    const rising = transitionTrendState('NORMAL', 25, 0);
    const fastRising = transitionTrendState('NORMAL', 45, 0.5);
    const breakoutRisk = transitionTrendState('NORMAL', 60, 0.5);
    const breakout = transitionTrendState('NORMAL', 80, 0.5);
    const cooling = transitionTrendState('BREAKOUT', 15, -0.5);
    const resolved = transitionTrendState('COOLING', 5, -0.5);
    assert.deepEqual(
      [rising.next_state, fastRising.next_state, breakoutRisk.next_state, breakout.next_state, cooling.next_state, resolved.next_state],
      ['RISING', 'FAST_RISING', 'BREAKOUT_RISK', 'BREAKOUT', 'COOLING', 'RESOLVED'],
    );
    assert.equal([rising, fastRising, breakoutRisk, breakout, cooling, resolved].every((value) => value.reasons.length > 0), true);
    assert.equal(transitionTrendState('RESOLVED', 5, 0).next_state, 'RESOLVED');
  });

  it('explains engagement, geography, language, baselines, duplication and coordination indicators', () => {
    const inputs = [
      item(0, { geo_ids: [createStableEntityId('geo', 'nl-veldhoven')], language: 'en', engagement_count: 120 }),
      item(1, { geo_ids: [createStableEntityId('geo', 'cn-shenzhen')], language: 'zh', engagement_count: 80 }),
      item(2, { published_at: '2026-08-15T00:20:00Z', engagement_count: 40 }),
      item(3, { published_at: '2026-08-15T00:25:00Z', engagement_count: 20 }),
    ];
    const point = computeTrendPoint(eventId, inputs, '2026-08-15T02:00:00Z', 60);
    assert.equal(point.geographic_count, 2);
    assert.equal(point.language_count, 2);
    assert.equal(point.engagement_count, 200);
    assert.equal(point.baseline_multiplier, 1);
    assert.ok('engagement_velocity' in point.components);
    assert.ok('geographic_spread' in point.components);
    assert.ok('duplicate_penalty' in point.components);
    assert.ok('coordination_risk_penalty' in point.components);
    assert.match(point.reasons.join(' '), /not a coordination finding/);
  });

  it('builds a deterministic first-observation propagation path', () => {
    const path = computePropagationPath([
      item(0, { platform: 'X', published_at: '2026-08-15T01:10:00Z' }),
      item(1, { platform: 'NEWS', published_at: '2026-08-15T01:15:00Z' }),
      item(2, { platform: 'BILIBILI', published_at: '2026-08-15T01:45:00Z' }),
      item(3, { platform: 'X', published_at: '2026-08-15T01:50:00Z' }),
    ]);
    assert.deepEqual(path.map((step) => `${step.from_platform}->${step.to_platform}`), ['X->NEWS', 'NEWS->BILIBILI']);
    assert.deepEqual(path.map((step) => step.observed_delay_minutes), [5, 30]);
  });

  it('serializes versioned snapshots as named SSE events', () => {
    const snapshot = computeTrendSnapshot(eventId, [item(0)], '2026-08-15T02:00:00Z');
    const serialized = serializeTrendSse({ event: 'trend_snapshot', id: 'snapshot-1', data: snapshot, retry_ms: 5_000 });
    assert.match(serialized, /^id: snapshot-1\nevent: trend_snapshot\nretry: 5000\ndata: /);
    assert.match(serialized, /TREND_EXPLAINABLE_V1/);
    assert.equal(serialized.endsWith('\n\n'), true);
  });

  it('creates no EventSource without a Provider and rejects unsafe remote HTTP', () => {
    let factoryCalls = 0;
    const statuses: string[] = [];
    const connection = connectTrendRealtime({
      endpoint: TREND_REALTIME_PROVIDER.endpoint,
      eventSourceFactory() {
        factoryCalls += 1;
        throw new Error('must not create EventSource');
      },
      onStatus(status) { statuses.push(status); },
      onSnapshot() {},
    });
    assert.equal(connection.initialStatus, 'NOT_CONFIGURED');
    assert.equal(factoryCalls, 0);
    assert.deepEqual(statuses, ['NOT_CONFIGURED']);
    assert.throws(() => validateTrendSseEndpoint('http://provider.example.invalid/trends'), /must use HTTPS/);
    assert.throws(() => validateTrendSseEndpoint('https://user:secret@provider.example.invalid/trends'), /must not contain credentials/);
    assert.equal(validateTrendSseEndpoint('http://127.0.0.1:4173/trends'), 'http://127.0.0.1:4173/trends');
  });

  it('supports a bounded test EventSource and validates snapshots before delivery', () => {
    const listeners = new Map<string, (event?: { data: string }) => void>();
    let closed = false;
    const source: TrendEventSource = {
      close() { closed = true; },
      addEventListener(type: string, listener: (event?: { data: string }) => void) { listeners.set(type, listener); },
    } as TrendEventSource;
    const statuses: string[] = [];
    const snapshots: unknown[] = [];
    const errors: string[] = [];
    const connection = connectTrendRealtime({
      endpoint: 'http://localhost:4173/events',
      eventSourceFactory: () => source,
      onStatus(status) { statuses.push(status); },
      onSnapshot(snapshot) { snapshots.push(snapshot); },
      onError(message) { errors.push(message); },
    });
    listeners.get('open')?.();
    const snapshot = computeTrendSnapshot(eventId, [item(0)], '2026-08-15T02:00:00Z');
    listeners.get('trend_snapshot')?.({ data: JSON.stringify(snapshot) });
    listeners.get('trend_snapshot')?.({ data: '{"event_id":"wrong"}' });
    connection.close();
    assert.deepEqual(statuses, ['CONNECTING', 'LIVE', 'CLOSED']);
    assert.deepEqual(snapshots, [snapshot]);
    assert.deepEqual(errors, ['trend_snapshot payload failed validation']);
    assert.equal(closed, true);
  });

  it('keeps the trends route and production imports fixture-free', () => {
    const route = read('src/features/trends/trends-route.ts');
    const page = read('src/features/trends/trends.ts');
    const main = read('src/main.ts');
    const engine = read('shared/trend-engine.ts');
    const realtime = read('src/services/trend-realtime.ts');
    const operations = read('src/services/provider-operations.ts');
    assert.match(route, /TRENDS_PATH = '\/trends'/);
    assert.match(page, /SOURCE_REQUIRED/);
    assert.match(page, /生产环境不会连接测试流或显示 fixture/);
    assert.match(page, /onSnapshot\(snapshot\)/);
    assert.match(page, /snapshots\.set\(snapshot\.event_id, snapshot\)/);
    assert.match(page, /render\(\)/);
    assert.match(page, /globalContentRepository\.listTrendSnapshots\(\)/);
    assert.match(main, /isTrendsPath/);
    assert.equal(isTrendsPath('/trends/event_example'), true);
    assert.deepEqual(parseTrendsRoute('/trends/event_example'), { kind: 'detail', eventId: 'event_example' });
    assert.equal(trendsUrl('event_example'), '/trends/event_example');
    assert.match(operations, /trend-realtime-sse/);
    assert.match(operations, /test fixtures are forbidden from the production SSE path/);
    assert.doesNotMatch(`${route}\n${page}\n${engine}\n${realtime}`, /from ['"].*(?:tests|fixtures)\//);
    assert.deepEqual(DEFAULT_TREND_ENGINE_CONFIG.windows_minutes, [5, 15, 30, 60, 360, 1440, 10_080, 43_200]);
    assert.equal(TREND_REALTIME_PROVIDER.production_fixture_enabled, false);
  });
});
