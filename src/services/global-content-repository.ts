import {
  createEventCandidate,
  deduplicateSourceItems,
  executeContentProvider,
  normalizeSourceRecord,
  type ContentExecutionReceipt,
  type ContentExecutionState,
  type ContentFetchRequest,
  type ContentProvider,
  type EventCandidate,
  type ExtractionDictionary,
  type SourceItem,
} from '../../shared/content-event-normalization';
import {
  computeTrendSnapshot,
  type TrendSnapshot,
  type TrendState,
} from '../../shared/trend-engine';
import type { StableEntityId } from '../../shared/global-intelligence-contract';
import { getPersistentCache, setPersistentCache } from './persistent-cache';

const CONTENT_REPOSITORY_KEY = 'global-intelligence:content-repository:v1:current';

export type ContentProviderRun = Readonly<{
  providerId: string;
  platform: ContentProvider['platform'];
  retrievedAt: string;
  attempts: number;
  receivedCount: number;
  insertedCount: number;
  licenseStatus: ContentProvider['policy']['license_status'];
  rateLimitRemaining: number | null;
}>;

export type GlobalContentSnapshot = Readonly<{
  schemaVersion: 1;
  revision: number;
  sourceItems: Readonly<Record<string, SourceItem>>;
  events: Readonly<Record<string, EventCandidate>>;
  trendHistory: readonly TrendSnapshot[];
  providerRuns: readonly ContentProviderRun[];
}>;

export type ContentRepositoryAdapter = Readonly<{
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}>;

export type ContentIngestResult = Readonly<{
  status: 'COMMITTED' | 'NO_CHANGE';
  snapshot: GlobalContentSnapshot;
  execution: ContentExecutionReceipt;
  insertedItemIds: readonly StableEntityId[];
}>;

function emptySnapshot(): GlobalContentSnapshot {
  return {
    schemaVersion: 1,
    revision: 0,
    sourceItems: {},
    events: {},
    trendHistory: [],
    providerRuns: [],
  };
}

function isSnapshot(value: unknown): value is GlobalContentSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GlobalContentSnapshot>;
  return candidate.schemaVersion === 1
    && Number.isInteger(candidate.revision)
    && (candidate.revision ?? -1) >= 0
    && typeof candidate.sourceItems === 'object'
    && candidate.sourceItems !== null
    && typeof candidate.events === 'object'
    && candidate.events !== null
    && Array.isArray(candidate.trendHistory)
    && Array.isArray(candidate.providerRuns);
}

function sameItem(left: SourceItem, right: SourceItem): boolean {
  const { retrieved_at: leftRetrievedAt, ...leftStable } = left;
  const { retrieved_at: rightRetrievedAt, ...rightStable } = right;
  void leftRetrievedAt;
  void rightRetrievedAt;
  return JSON.stringify(leftStable) === JSON.stringify(rightStable);
}

const persistentAdapter: ContentRepositoryAdapter = {
  async read<T>(key: string): Promise<T | null> {
    return (await getPersistentCache<T>(key))?.data ?? null;
  },
  async write<T>(key: string, value: T): Promise<void> {
    await setPersistentCache(key, value);
  },
};

export function createGlobalContentRepository(adapter: ContentRepositoryAdapter = persistentAdapter) {
  let mutationQueue: Promise<void> = Promise.resolve();

  const load = async (): Promise<GlobalContentSnapshot> => {
    const value = await adapter.read<GlobalContentSnapshot>(CONTENT_REPOSITORY_KEY);
    if (value === null) return emptySnapshot();
    if (!isSnapshot(value)) throw new Error('Stored content repository has an unsupported or corrupt schema');
    return value;
  };

  const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const save = async (snapshot: GlobalContentSnapshot): Promise<void> => {
    await adapter.write(CONTENT_REPOSITORY_KEY, snapshot);
  };

  return Object.freeze({
    load,

    async ingestProvider(
      provider: ContentProvider,
      request: ContentFetchRequest,
      priorState: ContentExecutionState,
      dictionary: ExtractionDictionary = { entities: {}, locations: {} },
      sleep?: (delayMs: number) => Promise<void>,
    ): Promise<ContentIngestResult> {
      return serialized(async () => {
        const snapshot = await load();
        const execution = await executeContentProvider(provider, request, priorState, sleep);
        const normalized = deduplicateSourceItems(execution.result.records.map((record) => normalizeSourceRecord(
          provider,
          record,
          request.now,
          dictionary,
        )));

        const nextItems = { ...snapshot.sourceItems };
        const insertedItemIds: StableEntityId[] = [];
        const identityIndex = new Map(Object.values(snapshot.sourceItems).map((item) => [`${item.platform}:${item.platform_item_id}`, item]));
        for (const item of normalized) {
          const identity = `${item.platform}:${item.platform_item_id}`;
          const byIdentity = identityIndex.get(identity);
          if (byIdentity && !sameItem(byIdentity, item)) {
            throw new Error(`${identity} already exists with different normalized content`);
          }
          const byId = nextItems[item.item_id];
          if (byId && !sameItem(byId, item)) throw new Error(`${item.item_id} already exists with different normalized content`);
          if (!byId) {
            nextItems[item.item_id] = item;
            identityIndex.set(identity, item);
            insertedItemIds.push(item.item_id);
          }
        }

        if (insertedItemIds.length === 0) return { status: 'NO_CHANGE', snapshot, execution, insertedItemIds };
        const next: GlobalContentSnapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          sourceItems: nextItems,
          providerRuns: [
            ...snapshot.providerRuns,
            {
              providerId: provider.provider_id,
              platform: provider.platform,
              retrievedAt: request.now,
              attempts: execution.attempts,
              receivedCount: execution.result.records.length,
              insertedCount: insertedItemIds.length,
              licenseStatus: provider.policy.license_status,
              rateLimitRemaining: execution.result.rate_limit_remaining,
            },
          ],
        };
        await save(next);
        return { status: 'COMMITTED', snapshot: next, execution, insertedItemIds };
      });
    },

    async createEvent(sourceItemIds: readonly StableEntityId[]): Promise<Readonly<{ status: 'COMMITTED' | 'NO_CHANGE'; event: EventCandidate; snapshot: GlobalContentSnapshot }>> {
      return serialized(async () => {
        const snapshot = await load();
        const items = sourceItemIds.map((id) => {
          const item = snapshot.sourceItems[id];
          if (!item) throw new Error(`Unknown SourceItem ${id}`);
          if (!item.permits_display) throw new Error(`SourceItem ${id} is not licensed for display`);
          return item;
        });
        const event = createEventCandidate(items);
        const existing = snapshot.events[event.event_id];
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(event)) throw new Error(`${event.event_id} already exists with different source membership`);
          return { status: 'NO_CHANGE', event, snapshot };
        }
        const next: GlobalContentSnapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          events: { ...snapshot.events, [event.event_id]: event },
        };
        await save(next);
        return { status: 'COMMITTED', event, snapshot: next };
      });
    },

    async computeTrend(eventId: StableEntityId, asOf: string): Promise<Readonly<{ status: 'COMMITTED' | 'NO_CHANGE'; trend: TrendSnapshot; snapshot: GlobalContentSnapshot }>> {
      return serialized(async () => {
        const snapshot = await load();
        const event = snapshot.events[eventId];
        if (!event) throw new Error(`Unknown EventCandidate ${eventId}`);
        const items = event.source_item_ids.map((id) => {
          const item = snapshot.sourceItems[id];
          if (!item) throw new Error(`Event ${eventId} references missing SourceItem ${id}`);
          return item;
        });
        const prior = [...snapshot.trendHistory]
          .filter((entry) => entry.event_id === eventId)
          .sort((a, b) => b.as_of.localeCompare(a.as_of))[0];
        const previousState: TrendState = prior?.points.find((point) => point.window_minutes === 60)?.state ?? 'NORMAL';
        const trend = computeTrendSnapshot(eventId, items, asOf, previousState);
        const existing = snapshot.trendHistory.find((entry) => entry.event_id === eventId && entry.as_of === asOf);
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(trend)) throw new Error(`Trend snapshot ${eventId}@${asOf} conflicts with stored output`);
          return { status: 'NO_CHANGE', trend, snapshot };
        }
        const next: GlobalContentSnapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          trendHistory: [...snapshot.trendHistory, trend],
        };
        await save(next);
        return { status: 'COMMITTED', trend, snapshot: next };
      });
    },

    async listDisplayableEvents(): Promise<readonly EventCandidate[]> {
      const snapshot = await load();
      return Object.values(snapshot.events).sort((a, b) => b.last_observed_at.localeCompare(a.last_observed_at) || a.event_id.localeCompare(b.event_id));
    },

    async getEvent(eventId: string): Promise<EventCandidate | null> {
      return (await load()).events[eventId] ?? null;
    },

    async listTrendSnapshots(): Promise<readonly TrendSnapshot[]> {
      return [...(await load()).trendHistory].sort((a, b) => b.as_of.localeCompare(a.as_of) || a.event_id.localeCompare(b.event_id));
    },
  });
}

export const globalContentRepository = createGlobalContentRepository();
