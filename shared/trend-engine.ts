/** Phase 20 deterministic, explainable cross-platform trend engine. */

import { assertStableEntityId, createStableEntityId, type StableEntityId } from './global-intelligence-contract';
import { deduplicateSourceItems, type ContentPlatform, type SourceItem } from './content-event-normalization';

export const TREND_STATES = ['NORMAL', 'RISING', 'FAST_RISING', 'BREAKOUT_RISK', 'BREAKOUT', 'COOLING', 'RESOLVED'] as const;
export type TrendState = (typeof TREND_STATES)[number];

export type TrendScoreComponents = Readonly<{
  unique_content: number;
  independent_authors: number;
  platform_diversity: number;
  geographic_spread: number;
  language_diversity: number;
  velocity: number;
  engagement_velocity: number;
  acceleration: number;
  baseline_anomaly: number;
  official_confirmation: number;
  duplicate_penalty: number;
  coordination_risk_penalty: number;
  concentration_penalty: number;
}>;

export type TrendPoint = Readonly<{
  trend_point_id: StableEntityId;
  event_id: StableEntityId;
  as_of: string;
  window_minutes: number;
  window_start: string;
  unique_content_count: number;
  independent_author_count: number;
  platform_count: number;
  geographic_count: number;
  language_count: number;
  large_account_author_count: number;
  audience_concentration: number;
  official_source_count: number;
  engagement_count: number;
  duplicate_count: number;
  coordination_risk: number;
  velocity_per_hour: number;
  engagement_velocity_per_hour: number;
  acceleration_ratio: number;
  baseline_multiplier: number | null;
  leading_platform: ContentPlatform | null;
  earliest_source_item_id: StableEntityId | null;
  heat_score: number;
  state: TrendState;
  algorithm_version: string;
  components: TrendScoreComponents;
  reasons: readonly string[];
}>;

export type TrendEngineConfig = Readonly<{
  algorithm_version: string;
  windows_minutes: readonly number[];
  large_account_threshold: number;
  weights: Readonly<{
    unique_content: number;
    independent_authors: number;
    platform_diversity: number;
    geographic_spread: number;
    language_diversity: number;
    velocity: number;
    engagement_velocity: number;
    acceleration: number;
    baseline_anomaly: number;
    official_confirmation: number;
    duplicate_penalty: number;
    coordination_risk_penalty: number;
    concentration_penalty: number;
  }>;
  thresholds: Readonly<{
    rising: number;
    fast_rising: number;
    breakout_risk: number;
    breakout: number;
    resolved: number;
  }>;
}>;

export const DEFAULT_TREND_ENGINE_CONFIG: TrendEngineConfig = Object.freeze({
  algorithm_version: 'TREND_EXPLAINABLE_V1',
  windows_minutes: Object.freeze([5, 15, 30, 60, 360, 1440, 10_080, 43_200]),
  large_account_threshold: 100_000,
  weights: Object.freeze({
    unique_content: 14,
    independent_authors: 14,
    platform_diversity: 9,
    geographic_spread: 8,
    language_diversity: 5,
    velocity: 11,
    engagement_velocity: 8,
    acceleration: 9,
    baseline_anomaly: 9,
    official_confirmation: 8,
    duplicate_penalty: 8,
    coordination_risk_penalty: 8,
    concentration_penalty: 7,
  }),
  thresholds: Object.freeze({ rising: 22, fast_rising: 40, breakout_risk: 58, breakout: 74, resolved: 9 }),
});

export type TrendStateTransition = Readonly<{
  previous_state: TrendState;
  next_state: TrendState;
  changed: boolean;
  reasons: readonly string[];
}>;

export type PropagationStep = Readonly<{
  from_platform: ContentPlatform;
  to_platform: ContentPlatform;
  from_item_id: StableEntityId;
  to_item_id: StableEntityId;
  observed_delay_minutes: number;
}>;

export type TrendSnapshot = Readonly<{
  event_id: StableEntityId;
  as_of: string;
  points: readonly TrendPoint[];
  propagation_path: readonly PropagationStep[];
}>;

export const EMPTY_TREND_SNAPSHOTS: readonly TrendSnapshot[] = Object.freeze([]);

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!value.trim() || !Number.isFinite(parsed)) throw new Error(`${field} must be an ISO timestamp`);
  return parsed;
}

function normalizedContribution(value: number, saturation: number): number {
  return clamp(Math.log2(value + 1) / Math.log2(saturation + 1));
}

function stableKeyHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of value.normalize('NFKC')) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function stateForScore(previous: TrendState, score: number, acceleration: number, config: TrendEngineConfig): TrendStateTransition {
  let next: TrendState;
  const reasons: string[] = [];
  if (score >= config.thresholds.breakout && acceleration > 0) {
    next = 'BREAKOUT';
    reasons.push(`heat ${score} >= breakout ${config.thresholds.breakout} and acceleration is positive`);
  } else if (score >= config.thresholds.breakout_risk && acceleration > 0) {
    next = 'BREAKOUT_RISK';
    reasons.push(`heat ${score} >= breakout risk ${config.thresholds.breakout_risk} and acceleration is positive`);
  } else if (score >= config.thresholds.fast_rising && acceleration > 0) {
    next = 'FAST_RISING';
    reasons.push(`heat ${score} >= fast rising ${config.thresholds.fast_rising} and acceleration is positive`);
  } else if (score >= config.thresholds.rising) {
    next = 'RISING';
    reasons.push(`heat ${score} >= rising ${config.thresholds.rising}`);
  } else if (previous === 'COOLING' && score < config.thresholds.resolved) {
    next = 'RESOLVED';
    reasons.push(`cooling heat ${score} < resolved ${config.thresholds.resolved}`);
  } else if (['RISING', 'FAST_RISING', 'BREAKOUT_RISK', 'BREAKOUT'].includes(previous) && score < config.thresholds.rising) {
    next = 'COOLING';
    reasons.push(`heat ${score} fell below rising ${config.thresholds.rising}`);
  } else if (previous === 'RESOLVED' && score < config.thresholds.rising) {
    next = 'RESOLVED';
    reasons.push('resolved trend has no renewed rising signal');
  } else {
    next = 'NORMAL';
    reasons.push(`heat ${score} remains below rising ${config.thresholds.rising}`);
  }
  return Object.freeze({ previous_state: previous, next_state: next, changed: previous !== next, reasons: Object.freeze(reasons) });
}

export function transitionTrendState(
  previous: TrendState,
  score: number,
  acceleration: number,
  config = DEFAULT_TREND_ENGINE_CONFIG,
): TrendStateTransition {
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('trend score must be between 0 and 100');
  if (!Number.isFinite(acceleration)) throw new Error('trend acceleration must be finite');
  return stateForScore(previous, score, acceleration, config);
}

export function computeTrendPoint(
  eventId: StableEntityId,
  items: readonly SourceItem[],
  asOf: string,
  windowMinutes: number,
  previousState: TrendState = 'NORMAL',
  config = DEFAULT_TREND_ENGINE_CONFIG,
): TrendPoint {
  assertStableEntityId(eventId, 'event');
  const asOfMs = timestamp(asOf, 'as_of');
  if (!Number.isInteger(windowMinutes) || windowMinutes <= 0) throw new Error('windowMinutes must be a positive integer');
  const startMs = asOfMs - windowMinutes * 60_000;
  const rawInWindow = items.filter((item) => {
    const published = timestamp(item.published_at, 'published_at');
    return published > startMs && published <= asOfMs;
  });
  const deduplicatedItems = deduplicateSourceItems(items);
  const inWindow = deduplicatedItems.filter((item) => {
    const published = timestamp(item.published_at, 'published_at');
    return published > startMs && published <= asOfMs;
  });
  const priorWindow = deduplicatedItems.filter((item) => {
    const published = timestamp(item.published_at, 'published_at');
    return published > startMs - windowMinutes * 60_000 && published <= startMs;
  });
  const uniqueContent = new Set(inWindow.map((item) => item.content_fingerprint));
  const authors = new Set(inWindow.map((item) => item.author_id ?? item.author_handle).filter((value): value is string => Boolean(value)));
  const platforms = new Set(inWindow.map((item) => item.platform));
  const geographies = new Set(inWindow.flatMap((item) => item.geo_ids));
  const languages = new Set(inWindow.map((item) => item.language).filter((language) => language !== 'und'));
  const audienceByAuthor = new Map<string, number>();
  for (const item of inWindow) {
    const author = item.author_id ?? item.author_handle;
    if (!author || item.author_audience_size === null) continue;
    audienceByAuthor.set(author, Math.max(audienceByAuthor.get(author) ?? 0, item.author_audience_size));
  }
  const audienceValues = [...audienceByAuthor.values()];
  const audienceTotal = audienceValues.reduce((sum, value) => sum + value, 0);
  const concentration = audienceTotal > 0 ? Math.max(...audienceValues) / audienceTotal : 0;
  const largeAccounts = audienceValues.filter((value) => value >= config.large_account_threshold).length;
  const officialCount = inWindow.filter((item) => item.confirmation_status === 'OFFICIAL_CONFIRMED').length;
  const engagementCount = inWindow.reduce((total, item) => total + (item.engagement_count ?? 0), 0);
  const duplicateCount = Math.max(0, rawInWindow.length - inWindow.length);
  const duplicateRatio = rawInWindow.length > 0 ? duplicateCount / rawInWindow.length : 0;
  const minuteBuckets = new Map<number, number>();
  const platformCounts = new Map<ContentPlatform, number>();
  for (const item of inWindow) {
    const minute = Math.floor(Date.parse(item.published_at) / 60_000);
    minuteBuckets.set(minute, (minuteBuckets.get(minute) ?? 0) + 1);
    platformCounts.set(item.platform, (platformCounts.get(item.platform) ?? 0) + 1);
  }
  const coordinationRisk = inWindow.length >= 4
    ? (Math.max(...minuteBuckets.values()) / inWindow.length)
    : 0;
  const leadingPlatform = [...platformCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const earliestSourceItemId = [...inWindow]
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at) || a.item_id.localeCompare(b.item_id))[0]?.item_id ?? null;
  const midpoint = startMs + (asOfMs - startMs) / 2;
  const priorContent = new Set(inWindow.filter((item) => Date.parse(item.published_at) <= midpoint).map((item) => item.content_fingerprint)).size;
  const recentContent = new Set(inWindow.filter((item) => Date.parse(item.published_at) > midpoint).map((item) => item.content_fingerprint)).size;
  const acceleration = clamp((recentContent - priorContent) / Math.max(1, priorContent), -2, 2);
  const velocity = uniqueContent.size / (windowMinutes / 60);
  const engagementVelocity = engagementCount / (windowMinutes / 60);
  const baselineMultiplier = priorWindow.length > 0 ? round(uniqueContent.size / priorWindow.length) : null;
  const rawComponents: TrendScoreComponents = {
    unique_content: config.weights.unique_content * normalizedContribution(uniqueContent.size, 32),
    independent_authors: config.weights.independent_authors * normalizedContribution(authors.size, 32),
    platform_diversity: config.weights.platform_diversity * clamp(platforms.size / CONTENT_PLATFORM_COUNT),
    geographic_spread: config.weights.geographic_spread * normalizedContribution(geographies.size, 8),
    language_diversity: config.weights.language_diversity * normalizedContribution(languages.size, 4),
    velocity: config.weights.velocity * clamp(velocity / 12),
    engagement_velocity: config.weights.engagement_velocity * normalizedContribution(engagementVelocity, 10_000),
    acceleration: config.weights.acceleration * clamp(Math.max(0, acceleration) / 2),
    baseline_anomaly: baselineMultiplier === null ? 0 : config.weights.baseline_anomaly * clamp((baselineMultiplier - 1) / 4),
    official_confirmation: officialCount > 0 ? config.weights.official_confirmation : 0,
    duplicate_penalty: -config.weights.duplicate_penalty * duplicateRatio,
    coordination_risk_penalty: -config.weights.coordination_risk_penalty * coordinationRisk,
    concentration_penalty: -config.weights.concentration_penalty * concentration,
  };
  const components = Object.freeze(Object.fromEntries(Object.entries(rawComponents).map(([key, value]) => [key, round(value)])) as unknown as TrendScoreComponents);
  const score = round(clamp(Object.values(components).reduce((sum, value) => sum + value, 0), 0, 100), 2);
  const transition = transitionTrendState(previousState, score, acceleration, config);
  const reasons = Object.freeze([
    ...transition.reasons,
    `${uniqueContent.size} unique contents from ${authors.size} independent authors across ${platforms.size} platforms`,
    `${geographies.size} geographies and ${languages.size} languages; engagement velocity ${round(engagementVelocity, 2)} per hour`,
    `audience concentration ${round(concentration, 3)}; ${largeAccounts} large-account authors; duplicate ratio ${round(duplicateRatio, 3)}`,
    baselineMultiplier === null ? 'no prior equal-length observation window; baseline multiplier is unavailable' : `current/prior equal-window baseline multiplier ${baselineMultiplier}`,
    `coordination risk indicator ${round(coordinationRisk, 3)} based on one-minute publication concentration; this is not a coordination finding`,
  ]);
  return Object.freeze({
    trend_point_id: createStableEntityId('trend', `${stableKeyHash(`${eventId}:${windowMinutes}:${asOfMs}`)}-${windowMinutes}m`),
    event_id: eventId,
    as_of: asOf,
    window_minutes: windowMinutes,
    window_start: new Date(startMs).toISOString(),
    unique_content_count: uniqueContent.size,
    independent_author_count: authors.size,
    platform_count: platforms.size,
    geographic_count: geographies.size,
    language_count: languages.size,
    large_account_author_count: largeAccounts,
    audience_concentration: round(concentration),
    official_source_count: officialCount,
    engagement_count: engagementCount,
    duplicate_count: duplicateCount,
    coordination_risk: round(coordinationRisk),
    velocity_per_hour: round(velocity),
    engagement_velocity_per_hour: round(engagementVelocity),
    acceleration_ratio: round(acceleration),
    baseline_multiplier: baselineMultiplier,
    leading_platform: leadingPlatform,
    earliest_source_item_id: earliestSourceItemId,
    heat_score: score,
    state: transition.next_state,
    algorithm_version: config.algorithm_version,
    components,
    reasons,
  });
}

const CONTENT_PLATFORM_COUNT = 3;

export function computePropagationPath(items: readonly SourceItem[]): readonly PropagationStep[] {
  for (const item of items) timestamp(item.published_at, 'published_at');
  const earliest = new Map<ContentPlatform, SourceItem>();
  for (const item of deduplicateSourceItems(items)) {
    const previous = earliest.get(item.platform);
    if (!previous || Date.parse(item.published_at) < Date.parse(previous.published_at)) earliest.set(item.platform, item);
  }
  const ordered = [...earliest.values()].sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at) || a.platform.localeCompare(b.platform));
  return Object.freeze(ordered.slice(1).map((item, index) => {
    const previous = ordered[index]!;
    return Object.freeze({
      from_platform: previous.platform,
      to_platform: item.platform,
      from_item_id: previous.item_id,
      to_item_id: item.item_id,
      observed_delay_minutes: round((Date.parse(item.published_at) - Date.parse(previous.published_at)) / 60_000, 2),
    });
  }));
}

export function computeTrendSnapshot(
  eventId: StableEntityId,
  items: readonly SourceItem[],
  asOf: string,
  previousState: TrendState = 'NORMAL',
  config = DEFAULT_TREND_ENGINE_CONFIG,
): TrendSnapshot {
  return Object.freeze({
    event_id: eventId,
    as_of: asOf,
    points: Object.freeze(config.windows_minutes.map((window) => computeTrendPoint(eventId, items, asOf, window, previousState, config))),
    propagation_path: computePropagationPath(items),
  });
}

export type TrendSseEnvelope = Readonly<{
  event: 'provider_status' | 'trend_snapshot';
  id: string;
  data: Readonly<{ status: 'NOT_CONFIGURED' }> | TrendSnapshot;
  retry_ms: number;
}>;

export function serializeTrendSse(envelope: TrendSseEnvelope): string {
  if (!envelope.id.trim() || !Number.isInteger(envelope.retry_ms) || envelope.retry_ms < 0) throw new Error('invalid trend SSE envelope');
  return `id: ${envelope.id}\nevent: ${envelope.event}\nretry: ${envelope.retry_ms}\ndata: ${JSON.stringify(envelope.data)}\n\n`;
}

export const TREND_REALTIME_PROVIDER = Object.freeze({
  status: 'NOT_CONFIGURED' as const,
  endpoint: null,
  production_fixture_enabled: false,
});
