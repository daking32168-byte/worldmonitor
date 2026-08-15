/** Phase 19 licensed content adapters, SourceItem normalization and events. */

import { createStableEntityId, type StableEntityId } from './global-intelligence-contract';

export const CONTENT_PLATFORMS = ['NEWS', 'X', 'BILIBILI'] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export type ContentProviderStatus = 'READY' | 'NOT_CONFIGURED' | 'RATE_LIMITED' | 'DISABLED_BY_LICENSE';

export type ProviderPolicy = Readonly<{
  license_status: 'VERIFIED' | 'RESTRICTED' | 'REVIEW_REQUIRED' | 'NOT_CONFIGURED';
  permits_ingest: boolean;
  permits_display: boolean;
  permits_export: boolean;
  requests_per_minute: number;
  max_retries: number;
  retry_base_ms: number;
}>;

export type ProviderSourceRecord = Readonly<{
  platform_item_id: string;
  canonical_url: string;
  author_id: string | null;
  author_handle: string | null;
  published_at: string;
  title: string | null;
  body: string;
  language_hint: string | null;
  source_authority: 'OFFICIAL' | 'PUBLISHER' | 'SOCIAL' | 'UNKNOWN';
  author_audience_size?: number | null;
  engagement_count?: number | null;
}>;

export type ContentFetchRequest = Readonly<{
  cursor: string | null;
  limit: number;
  transport: 'PROVIDER_API' | 'LICENSED_FILE';
  now: string;
  server_credential_present: boolean;
}>;

export type ContentFetchResult = Readonly<{
  records: readonly ProviderSourceRecord[];
  next_cursor: string | null;
  rate_limit_remaining: number | null;
}>;

export interface ContentProvider {
  readonly provider_id: string;
  readonly platform: ContentPlatform;
  readonly status: ContentProviderStatus;
  readonly policy: ProviderPolicy;
  fetch(request: ContentFetchRequest): Promise<ContentFetchResult>;
}

export interface SocialProvider extends ContentProvider {
  readonly platform: 'X' | 'BILIBILI';
}

export type ContentExecutionState = Readonly<{
  window_started_at: string;
  requests_in_window: number;
}>;

export type ContentExecutionReceipt = Readonly<{
  result: ContentFetchResult;
  state: ContentExecutionState;
  attempts: number;
}>;

export type SourceItem = Readonly<{
  item_id: StableEntityId;
  provider_id: string;
  platform: ContentPlatform;
  platform_item_id: string;
  canonical_url: string;
  author_id: string | null;
  author_handle: string | null;
  published_at: string;
  retrieved_at: string;
  language: string;
  title: string | null;
  body: string;
  content_fingerprint: string;
  confirmation_status: 'OFFICIAL_CONFIRMED' | 'PUBLISHER_REPORTED' | 'SOCIAL_SIGNAL' | 'UNVERIFIED';
  license_status: ProviderPolicy['license_status'];
  permits_display: boolean;
  permits_export: boolean;
  author_audience_size: number | null;
  engagement_count: number | null;
  entity_ids: readonly StableEntityId[];
  geo_ids: readonly StableEntityId[];
}>;

export type ExtractionDictionary = Readonly<{
  entities: Readonly<Record<string, StableEntityId>>;
  locations: Readonly<Record<string, StableEntityId>>;
}>;

export type EventCandidate = Readonly<{
  event_id: StableEntityId;
  status: 'CANDIDATE' | 'OFFICIAL_CONFIRMED';
  title: string;
  language: string;
  first_observed_at: string;
  last_observed_at: string;
  source_item_ids: readonly StableEntityId[];
  independent_author_count: number;
  platform_count: number;
  entity_ids: readonly StableEntityId[];
  geo_ids: readonly StableEntityId[];
  timeline: readonly Readonly<{
    item_id: StableEntityId;
    platform: ContentPlatform;
    platform_item_id: string;
    canonical_url: string;
    published_at: string;
    confirmation_status: SourceItem['confirmation_status'];
  }>[];
}>;

export const EMPTY_SOURCE_ITEMS: readonly SourceItem[] = Object.freeze([]);
export const EMPTY_EVENT_CANDIDATES: readonly EventCandidate[] = Object.freeze([]);

function timestamp(value: string, field: string): void {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('canonical_url must use HTTP(S)');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of value.normalize('NFKC')) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function normalizedContent(record: Pick<ProviderSourceRecord, 'title' | 'body'>): string {
  return `${record.title ?? ''}\n${record.body}`.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function contentFingerprint(record: Pick<ProviderSourceRecord, 'title' | 'body'>): string {
  return fnv1a64(normalizedContent(record));
}

export function detectContentLanguage(value: string, hint?: string | null): string {
  const normalizedHint = hint?.normalize('NFKC').trim().toLowerCase();
  if (normalizedHint && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(normalizedHint)) return normalizedHint;
  const han = (value.match(/[\p{Script=Han}]/gu) ?? []).length;
  const latin = (value.match(/[A-Za-z]/g) ?? []).length;
  if (han > latin) return 'zh';
  if (latin > 0) return 'en';
  return 'und';
}

function matchDictionary(text: string, entries: Readonly<Record<string, StableEntityId>>): readonly StableEntityId[] {
  const haystack = text.normalize('NFKC').toLocaleLowerCase();
  return Object.freeze([...new Set(Object.entries(entries)
    .filter(([alias]) => haystack.includes(alias.normalize('NFKC').toLocaleLowerCase()))
    .map(([, id]) => id))]);
}

function confirmation(platform: ContentPlatform, authority: ProviderSourceRecord['source_authority']): SourceItem['confirmation_status'] {
  if (authority === 'OFFICIAL') return 'OFFICIAL_CONFIRMED';
  if (platform === 'NEWS' && authority === 'PUBLISHER') return 'PUBLISHER_REPORTED';
  if (platform === 'X' || platform === 'BILIBILI') return 'SOCIAL_SIGNAL';
  return 'UNVERIFIED';
}

export function normalizeSourceRecord(
  provider: Pick<ContentProvider, 'provider_id' | 'platform' | 'policy'>,
  record: ProviderSourceRecord,
  retrievedAt: string,
  dictionary: ExtractionDictionary = { entities: {}, locations: {} },
): SourceItem {
  if (provider.policy.license_status === 'NOT_CONFIGURED' || provider.policy.license_status === 'REVIEW_REQUIRED') {
    throw new Error('content Provider licence is not admitted');
  }
  if (!provider.policy.permits_ingest) throw new Error('content Provider policy forbids ingestion');
  if (!record.platform_item_id.trim() || !record.body.trim()) throw new Error('platform_item_id and body are required');
  timestamp(record.published_at, 'published_at');
  timestamp(retrievedAt, 'retrieved_at');
  const url = canonicalUrl(record.canonical_url);
  for (const [field, value] of [['author_audience_size', record.author_audience_size], ['engagement_count', record.engagement_count]] as const) {
    if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0)) throw new Error(`${field} must be non-negative`);
  }
  const text = `${record.title ?? ''}\n${record.body}`;
  const fingerprint = contentFingerprint(record);
  return Object.freeze({
    item_id: createStableEntityId('item', `${provider.platform.toLowerCase()}-${fnv1a64(`${provider.provider_id}:${record.platform_item_id}`)}`),
    provider_id: provider.provider_id,
    platform: provider.platform,
    platform_item_id: record.platform_item_id,
    canonical_url: url,
    author_id: record.author_id,
    author_handle: record.author_handle,
    published_at: record.published_at,
    retrieved_at: retrievedAt,
    language: detectContentLanguage(text, record.language_hint),
    title: record.title,
    body: record.body,
    content_fingerprint: fingerprint,
    confirmation_status: confirmation(provider.platform, record.source_authority),
    license_status: provider.policy.license_status,
    permits_display: provider.policy.permits_display,
    permits_export: provider.policy.permits_export,
    author_audience_size: record.author_audience_size ?? null,
    engagement_count: record.engagement_count ?? null,
    entity_ids: matchDictionary(text, dictionary.entities),
    geo_ids: matchDictionary(text, dictionary.locations),
  });
}

export function deduplicateSourceItems(items: readonly SourceItem[]): readonly SourceItem[] {
  const byPlatformId = new Map<string, SourceItem>();
  const byCanonicalUrl = new Set<string>();
  const byContentAuthor = new Set<string>();
  for (const item of [...items].sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at) || a.item_id.localeCompare(b.item_id))) {
    const platformKey = `${item.platform}:${item.platform_item_id}`;
    const contentAuthorKey = `${item.content_fingerprint}:${item.author_id ?? item.author_handle ?? 'unknown'}`;
    if (byPlatformId.has(platformKey) || byCanonicalUrl.has(item.canonical_url) || byContentAuthor.has(contentAuthorKey)) continue;
    byPlatformId.set(platformKey, item);
    byCanonicalUrl.add(item.canonical_url);
    byContentAuthor.add(contentAuthorKey);
  }
  return Object.freeze([...byPlatformId.values()]);
}

export function createEventCandidate(items: readonly SourceItem[]): EventCandidate {
  const unique = deduplicateSourceItems(items);
  if (unique.length === 0) throw new Error('event candidate requires at least one unique SourceItem');
  const ordered = [...unique].sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at) || a.item_id.localeCompare(b.item_id));
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const title = ordered.find((item) => item.title?.trim())?.title?.trim() ?? first.body.trim().slice(0, 120);
  const official = ordered.some((item) => item.confirmation_status === 'OFFICIAL_CONFIRMED');
  return Object.freeze({
    event_id: createStableEntityId('event', `candidate-${fnv1a64(ordered.map((item) => item.content_fingerprint).sort().join(':'))}`),
    status: official ? 'OFFICIAL_CONFIRMED' : 'CANDIDATE',
    title,
    language: first.language,
    first_observed_at: first.published_at,
    last_observed_at: last.published_at,
    source_item_ids: Object.freeze(ordered.map((item) => item.item_id)),
    independent_author_count: new Set(ordered.map((item) => item.author_id ?? item.author_handle).filter(Boolean)).size,
    platform_count: new Set(ordered.map((item) => item.platform)).size,
    entity_ids: Object.freeze([...new Set(ordered.flatMap((item) => item.entity_ids))]),
    geo_ids: Object.freeze([...new Set(ordered.flatMap((item) => item.geo_ids))]),
    timeline: Object.freeze(ordered.map((item) => Object.freeze({
      item_id: item.item_id,
      platform: item.platform,
      platform_item_id: item.platform_item_id,
      canonical_url: item.canonical_url,
      published_at: item.published_at,
      confirmation_status: item.confirmation_status,
    }))),
  });
}

function validatePolicy(policy: ProviderPolicy): void {
  for (const [field, value] of [['requests_per_minute', policy.requests_per_minute], ['max_retries', policy.max_retries], ['retry_base_ms', policy.retry_base_ms]] as const) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  }
}

export function createDisabledContentProvider(
  providerId: string,
  platform: ContentPlatform,
  policy: ProviderPolicy,
): ContentProvider {
  validatePolicy(policy);
  if (policy.license_status !== 'NOT_CONFIGURED' && policy.license_status !== 'REVIEW_REQUIRED') {
    throw new Error('disabled Provider must have NOT_CONFIGURED or REVIEW_REQUIRED licence');
  }
  return Object.freeze({
    provider_id: providerId,
    platform,
    status: 'NOT_CONFIGURED' as const,
    policy: Object.freeze({ ...policy }),
    async fetch(request: ContentFetchRequest): Promise<ContentFetchResult> {
      if (request.transport !== 'PROVIDER_API' && request.transport !== 'LICENSED_FILE') {
        throw new Error('HTML scraping is not a supported content transport');
      }
      throw new Error(`${providerId} is NOT_CONFIGURED; no Provider request was sent`);
    },
  });
}

/**
 * Bounded executor for a service/sidecar adapter. It receives only the boolean
 * credential-presence flag in the request; secret material stays in the
 * concrete server executor and is never part of this shared contract.
 */
export async function executeContentProvider(
  provider: ContentProvider,
  request: ContentFetchRequest,
  priorState: ContentExecutionState,
  sleep: (delayMs: number) => Promise<void> = async () => {},
): Promise<ContentExecutionReceipt> {
  if (provider.status !== 'READY') throw new Error(`${provider.provider_id} is ${provider.status}`);
  if (request.transport !== 'PROVIDER_API' && request.transport !== 'LICENSED_FILE') {
    throw new Error('HTML scraping is not a supported content transport');
  }
  timestamp(request.now, 'now');
  timestamp(priorState.window_started_at, 'window_started_at');
  const nowMs = Date.parse(request.now);
  const sameWindow = nowMs - Date.parse(priorState.window_started_at) >= 0
    && nowMs - Date.parse(priorState.window_started_at) < 60_000;
  const used = sameWindow ? priorState.requests_in_window : 0;
  const maximumAttempts = provider.policy.max_retries + 1;
  if (provider.policy.requests_per_minute <= 0 || used + maximumAttempts > provider.policy.requests_per_minute) {
    throw new Error(`${provider.provider_id} rate limit reached before request`);
  }
  let attempt = 0;
  while (attempt <= provider.policy.max_retries) {
    attempt += 1;
    try {
      const result = await provider.fetch(request);
      return Object.freeze({
        result,
        attempts: attempt,
        state: Object.freeze({
          window_started_at: sameWindow ? priorState.window_started_at : request.now,
          requests_in_window: used + attempt,
        }),
      });
    } catch (error) {
      if (attempt > provider.policy.max_retries) throw error;
      await sleep(provider.policy.retry_base_ms * (2 ** (attempt - 1)));
    }
  }
  throw new Error('content Provider retry loop exhausted unexpectedly');
}

const DISABLED_POLICY: ProviderPolicy = Object.freeze({
  license_status: 'NOT_CONFIGURED',
  permits_ingest: false,
  permits_display: false,
  permits_export: false,
  requests_per_minute: 0,
  max_retries: 0,
  retry_base_ms: 0,
});

export const CONTENT_PROVIDERS: readonly ContentProvider[] = Object.freeze([
  createDisabledContentProvider('news-provider-skeleton', 'NEWS', DISABLED_POLICY),
  createDisabledContentProvider('x-provider-skeleton', 'X', DISABLED_POLICY),
  createDisabledContentProvider('bilibili-provider-skeleton', 'BILIBILI', DISABLED_POLICY),
]);
