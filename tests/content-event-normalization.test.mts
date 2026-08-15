import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createStableEntityId } from '../shared/global-intelligence-contract.ts';
import {
  CONTENT_PROVIDERS,
  createEventCandidate,
  deduplicateSourceItems,
  detectContentLanguage,
  executeContentProvider,
  normalizeSourceRecord,
  type ContentProvider,
  type ProviderSourceRecord,
  type SourceItem,
} from '../shared/content-event-normalization.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function admittedProvider(platform: ContentProvider['platform'], id = `test-${platform.toLowerCase()}`): ContentProvider {
  return {
    provider_id: id,
    platform,
    status: 'READY',
    policy: {
      license_status: 'VERIFIED',
      permits_ingest: true,
      permits_display: true,
      permits_export: false,
      requests_per_minute: 10,
      max_retries: 2,
      retry_base_ms: 1000,
    },
    async fetch() { return { records: [], next_cursor: null, rate_limit_remaining: 10 }; },
  };
}

function record(overrides: Partial<ProviderSourceRecord> = {}): ProviderSourceRecord {
  return {
    platform_item_id: 'post-001',
    canonical_url: 'https://social.example.invalid/post/001?utm_source=test',
    author_id: 'author-001',
    author_handle: '@author',
    published_at: '2026-08-15T01:00:00Z',
    title: 'Fixture event',
    body: 'ASML announced an event in Veldhoven.',
    language_hint: 'en',
    source_authority: 'SOCIAL',
    ...overrides,
  };
}

function item(platform: ContentProvider['platform'], overrides: Partial<ProviderSourceRecord> = {}): SourceItem {
  return normalizeSourceRecord(admittedProvider(platform), record(overrides), '2026-08-15T02:00:00Z', {
    entities: { ASML: createStableEntityId('company', 'nl-17085815') },
    locations: { Veldhoven: createStableEntityId('geo', 'nl-veldhoven') },
  });
}

describe('Phase 19 content and event normalization', () => {
  it('ships news, X and Bilibili skeletons disabled without making a request', async () => {
    assert.deepEqual(CONTENT_PROVIDERS.map((provider) => provider.platform), ['NEWS', 'X', 'BILIBILI']);
    assert.equal(CONTENT_PROVIDERS.every((provider) => provider.status === 'NOT_CONFIGURED'), true);
    assert.equal(CONTENT_PROVIDERS.every((provider) => provider.policy.requests_per_minute === 0), true);
    await assert.rejects(() => CONTENT_PROVIDERS[1]!.fetch({
      cursor: null, limit: 10, transport: 'PROVIDER_API', now: '2026-08-15T00:00:00Z', server_credential_present: false,
    }), /NOT_CONFIGURED.*no Provider request was sent/);
  });

  it('preserves original URL, platform ID and timestamps while removing tracking parameters', () => {
    const normalized = item('X');
    assert.equal(normalized.platform_item_id, 'post-001');
    assert.equal(normalized.canonical_url, 'https://social.example.invalid/post/001');
    assert.equal(normalized.published_at, '2026-08-15T01:00:00Z');
    assert.equal(normalized.retrieved_at, '2026-08-15T02:00:00Z');
    assert.equal(normalized.permits_export, false);
  });

  it('uses deterministic language, entity and location extraction', () => {
    const normalized = item('NEWS');
    assert.equal(normalized.language, 'en');
    assert.deepEqual(normalized.entity_ids, [createStableEntityId('company', 'nl-17085815')]);
    assert.deepEqual(normalized.geo_ids, [createStableEntityId('geo', 'nl-veldhoven')]);
    assert.equal(detectContentLanguage('景德镇陶瓷产业'), 'zh');
    assert.equal(detectContentLanguage('12345'), 'und');
  });

  it('deduplicates platform IDs, canonical URLs and same-author reposts', () => {
    const first = item('X');
    const samePlatform = item('X');
    const sameContentSameAuthor = item('X', { platform_item_id: 'post-002', canonical_url: 'https://social.example.invalid/post/002' });
    const independentAuthor = item('X', { platform_item_id: 'post-003', canonical_url: 'https://social.example.invalid/post/003', author_id: 'author-002' });
    assert.equal(deduplicateSourceItems([first, samePlatform, sameContentSameAuthor, independentAuthor]).length, 2);
  });

  it('never marks social signals as official without explicit official authority', () => {
    const x = item('X');
    const bilibili = item('BILIBILI', { platform_item_id: 'BV1fixture', canonical_url: 'https://video.example.invalid/BV1fixture' });
    assert.equal(x.confirmation_status, 'SOCIAL_SIGNAL');
    assert.equal(bilibili.confirmation_status, 'SOCIAL_SIGNAL');
    const event = createEventCandidate([x, bilibili]);
    assert.equal(event.status, 'CANDIDATE');
    assert.equal(event.timeline.every((entry) => entry.confirmation_status === 'SOCIAL_SIGNAL'), true);
  });

  it('keeps a chronological raw-source timeline and distinguishes independent authors/platforms', () => {
    const x = item('X');
    const news = item('NEWS', {
      platform_item_id: 'news-002',
      canonical_url: 'https://news.example.invalid/story',
      author_id: 'publisher-002',
      published_at: '2026-08-15T01:10:00Z',
      source_authority: 'PUBLISHER',
    });
    const event = createEventCandidate([news, x]);
    assert.equal(event.status, 'CANDIDATE');
    assert.equal(event.independent_author_count, 2);
    assert.equal(event.platform_count, 2);
    assert.deepEqual(event.timeline.map((entry) => entry.platform_item_id), ['post-001', 'news-002']);
    assert.equal(event.timeline[0]?.canonical_url, 'https://social.example.invalid/post/001');
  });

  it('rejects ingestion when licence admission is absent', () => {
    const disabled = CONTENT_PROVIDERS[0]!;
    assert.throws(() => normalizeSourceRecord(disabled, record(), '2026-08-15T02:00:00Z'), /licence is not admitted/);
  });

  it('enforces a minute budget and bounded exponential retry in the shared executor', async () => {
    let calls = 0;
    const delays: number[] = [];
    const provider: ContentProvider = {
      ...admittedProvider('NEWS', 'retry-test'),
      policy: { ...admittedProvider('NEWS').policy, requests_per_minute: 3, max_retries: 2, retry_base_ms: 100 },
      async fetch() {
        calls += 1;
        if (calls < 3) throw new Error('fixture transient failure');
        return { records: [], next_cursor: null, rate_limit_remaining: 0 };
      },
    };
    const request = { cursor: null, limit: 10, transport: 'PROVIDER_API' as const, now: '2026-08-15T01:00:30Z', server_credential_present: true };
    const receipt = await executeContentProvider(provider, request, {
      window_started_at: '2026-08-15T01:00:00Z', requests_in_window: 0,
    }, async (delay) => { delays.push(delay); });
    assert.equal(receipt.attempts, 3);
    assert.deepEqual(delays, [100, 200]);
    assert.equal(receipt.state.requests_in_window, 3);
    await assert.rejects(() => executeContentProvider(provider, request, receipt.state), /rate limit reached before request/);
  });

  it('adds disabled X/Bilibili operations and contains no browser secret names or scrape fallback', () => {
    const operations = read('src/services/provider-operations.ts');
    const main = read('src/main.ts');
    assert.match(operations, /x-content-ingest/);
    assert.match(operations, /bilibili-content-ingest/);
    assert.match(operations, /没有 API\/许可时不抓取/);
    assert.doesNotMatch(main, /X_API_KEY|BILIBILI_(?:KEY|TOKEN|COOKIE)/);
  });
});
