import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  ContentFetchRequest,
  ContentProvider,
  ProviderSourceRecord,
} from '../shared/content-event-normalization.ts';
import { createStableEntityId } from '../shared/global-intelligence-contract.ts';
import {
  createGlobalContentRepository,
  type ContentRepositoryAdapter,
} from '../src/services/global-content-repository.ts';

function sourceRecord(id: string, overrides: Partial<ProviderSourceRecord> = {}): ProviderSourceRecord {
  return {
    platform_item_id: id,
    canonical_url: `https://publisher.example.test/story/${id}?utm_source=wire`,
    author_id: `author-${id}`,
    author_handle: null,
    published_at: '2026-08-15T01:30:00Z',
    title: 'Verified industrial update',
    body: `ASML Veldhoven source observation ${id}`,
    language_hint: 'en',
    source_authority: 'PUBLISHER',
    author_audience_size: 1_000,
    engagement_count: 25,
    ...overrides,
  };
}

function provider(records: readonly ProviderSourceRecord[], overrides: Partial<ContentProvider> = {}): ContentProvider {
  return {
    provider_id: 'licensed-news-test',
    platform: 'NEWS',
    status: 'READY',
    policy: {
      license_status: 'VERIFIED',
      permits_ingest: true,
      permits_display: true,
      permits_export: false,
      requests_per_minute: 10,
      max_retries: 1,
      retry_base_ms: 1,
    },
    async fetch() {
      return { records, next_cursor: null, rate_limit_remaining: 9 };
    },
    ...overrides,
  };
}

function request(now = '2026-08-15T02:00:00Z'): ContentFetchRequest {
  return { cursor: null, limit: 10, transport: 'LICENSED_FILE', now, server_credential_present: false };
}

function memoryAdapter(): ContentRepositoryAdapter {
  const values = new Map<string, unknown>();
  return {
    async read<T>(key: string): Promise<T | null> {
      return (values.get(key) as T | undefined) ?? null;
    },
    async write<T>(key: string, value: T): Promise<void> {
      values.set(key, structuredClone(value));
    },
  };
}

describe('Provider to normalization to storage to API trend pipeline', () => {
  it('persists licensed source items, creates a traceable event and stores deterministic trend history', async () => {
    const repository = createGlobalContentRepository(memoryAdapter());
    const records = [sourceRecord('001'), sourceRecord('002', { published_at: '2026-08-15T01:40:00Z' })];
    const ingest = await repository.ingestProvider(
      provider(records),
      request(),
      { window_started_at: '2026-08-15T01:59:30Z', requests_in_window: 0 },
      {
        entities: { ASML: createStableEntityId('company', 'nl-asml') },
        locations: { Veldhoven: createStableEntityId('geo', 'nl-veldhoven') },
      },
    );
    assert.equal(ingest.status, 'COMMITTED');
    assert.equal(ingest.insertedItemIds.length, 2);
    assert.equal(ingest.snapshot.providerRuns[0]?.attempts, 1);
    assert.equal(ingest.snapshot.providerRuns[0]?.licenseStatus, 'VERIFIED');
    assert.equal(Object.values(ingest.snapshot.sourceItems).every((item) => item.original_url.includes('utm_source')), true);
    assert.equal(Object.values(ingest.snapshot.sourceItems).every((item) => !item.canonical_url.includes('utm_source')), true);

    const eventResult = await repository.createEvent(ingest.insertedItemIds);
    assert.equal(eventResult.status, 'COMMITTED');
    assert.equal(eventResult.event.source_item_ids.length, 2);
    assert.equal(eventResult.event.entity_ids[0], createStableEntityId('company', 'nl-asml'));
    assert.equal(eventResult.event.geo_ids[0], createStableEntityId('geo', 'nl-veldhoven'));

    const trendResult = await repository.computeTrend(eventResult.event.event_id, '2026-08-15T02:00:00Z');
    assert.equal(trendResult.status, 'COMMITTED');
    assert.equal(trendResult.trend.points.length, 8);
    assert.equal((await repository.listDisplayableEvents()).length, 1);
    assert.deepEqual(await repository.getEvent(eventResult.event.event_id), eventResult.event);
    assert.deepEqual(await repository.listTrendSnapshots(), [trendResult.trend]);

    const repeatedTrend = await repository.computeTrend(eventResult.event.event_id, '2026-08-15T02:00:00Z');
    assert.equal(repeatedTrend.status, 'NO_CHANGE');
  });

  it('is idempotent across retrieval times but rejects changed content under the same platform identity', async () => {
    const repository = createGlobalContentRepository(memoryAdapter());
    const originalProvider = provider([sourceRecord('stable')]);
    const state = { window_started_at: '2026-08-15T01:59:30Z', requests_in_window: 0 };
    assert.equal((await repository.ingestProvider(originalProvider, request(), state)).status, 'COMMITTED');
    assert.equal((await repository.ingestProvider(originalProvider, request('2026-08-15T02:01:00Z'), state)).status, 'NO_CHANGE');

    const changedProvider = provider([sourceRecord('stable', { body: 'Changed body under the same Provider ID' })]);
    await assert.rejects(
      () => repository.ingestProvider(changedProvider, request('2026-08-15T02:02:00Z'), state),
      /already exists with different normalized content/,
    );
    assert.equal(Object.keys((await repository.load()).sourceItems).length, 1);
  });

  it('stores analysis-permitted records but blocks event/UI creation when display rights are absent', async () => {
    const repository = createGlobalContentRepository(memoryAdapter());
    const restricted = provider([sourceRecord('restricted')], {
      policy: {
        ...provider([]).policy,
        license_status: 'RESTRICTED',
        permits_display: false,
      },
    });
    const ingest = await repository.ingestProvider(
      restricted,
      request(),
      { window_started_at: '2026-08-15T01:59:30Z', requests_in_window: 0 },
    );
    assert.equal(ingest.status, 'COMMITTED');
    await assert.rejects(() => repository.createEvent(ingest.insertedItemIds), /not licensed for display/);
    assert.equal((await repository.listDisplayableEvents()).length, 0);
  });
});
