import {
  commitGlobalIntelligenceImport,
  createEmptyGlobalIntelligenceSnapshot,
  planGlobalIntelligenceImport,
  type GlobalIntelligenceImportResult,
  type GlobalIntelligenceImportSubmission,
  type GlobalIntelligenceSnapshot,
} from '../../shared/global-intelligence-import';
import { getPersistentCache, setPersistentCache } from './persistent-cache';

const CURRENT_SNAPSHOT_KEY = 'global-intelligence:repository:v1:current';
const BACKUP_KEY_PREFIX = 'global-intelligence:repository:v1:backup:';

export type GlobalIntelligenceRepositoryAdapter = Readonly<{
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}>;

export type GlobalIntelligenceRollbackResult = Readonly<{
  status: 'ROLLED_BACK' | 'NO_BACKUP';
  snapshot: GlobalIntelligenceSnapshot;
  rolledBackRevision: number | null;
}>;

function isSnapshot(value: unknown): value is GlobalIntelligenceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GlobalIntelligenceSnapshot>;
  return candidate.schemaVersion === 1
    && Number.isInteger(candidate.revision)
    && (candidate.revision ?? -1) >= 0
    && typeof candidate.records === 'object'
    && candidate.records !== null
    && typeof candidate.evidence === 'object'
    && candidate.evidence !== null
    && Array.isArray(candidate.history);
}

function hydrateSnapshot(snapshot: GlobalIntelligenceSnapshot): GlobalIntelligenceSnapshot {
  const empty = createEmptyGlobalIntelligenceSnapshot();
  return {
    ...snapshot,
    records: {
      ...empty.records,
      ...snapshot.records,
      trade_flows: snapshot.records.trade_flows ?? {},
    },
  };
}

const persistentAdapter: GlobalIntelligenceRepositoryAdapter = {
  async read<T>(key: string): Promise<T | null> {
    return (await getPersistentCache<T>(key))?.data ?? null;
  },
  async write<T>(key: string, value: T): Promise<void> {
    await setPersistentCache(key, value);
  },
};

export function createGlobalIntelligenceLocalRepository(adapter: GlobalIntelligenceRepositoryAdapter = persistentAdapter) {
  let mutationQueue: Promise<void> = Promise.resolve();

  const load = async (): Promise<GlobalIntelligenceSnapshot> => {
    const stored = await adapter.read<GlobalIntelligenceSnapshot>(CURRENT_SNAPSHOT_KEY);
    if (stored === null) return createEmptyGlobalIntelligenceSnapshot();
    if (!isSnapshot(stored)) throw new Error('Stored Global Intelligence snapshot has an unsupported or corrupt schema');
    return hydrateSnapshot(stored);
  };

  const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  return Object.freeze({
    load,

    async dryRun(submission: GlobalIntelligenceImportSubmission): Promise<GlobalIntelligenceImportResult> {
      const snapshot = await load();
      const plan = await planGlobalIntelligenceImport(submission, snapshot, new Date().toISOString());
      return { status: plan.status, plan, snapshot };
    },

    async import(submission: GlobalIntelligenceImportSubmission): Promise<GlobalIntelligenceImportResult> {
      return serialized(async () => {
        const snapshot = await load();
        const plan = await planGlobalIntelligenceImport(submission, snapshot, new Date().toISOString());
        const result = commitGlobalIntelligenceImport(plan, snapshot);
        if (result.status !== 'COMMITTED') return result;

        // Write the previous revision before the new current pointer. A failed
        // current write therefore leaves the last known-good snapshot intact.
        await adapter.write(`${BACKUP_KEY_PREFIX}${result.snapshot.revision}`, snapshot);
        await adapter.write(CURRENT_SNAPSHOT_KEY, result.snapshot);
        return result;
      });
    },

    async rollback(): Promise<GlobalIntelligenceRollbackResult> {
      return serialized(async () => {
        const snapshot = await load();
        if (snapshot.revision === 0) return { status: 'NO_BACKUP', snapshot, rolledBackRevision: null };
        const backup = await adapter.read<GlobalIntelligenceSnapshot>(`${BACKUP_KEY_PREFIX}${snapshot.revision}`);
        if (!isSnapshot(backup) || backup.revision !== snapshot.revision - 1) {
          throw new Error(`Rollback backup for revision ${snapshot.revision} is missing or invalid`);
        }
        await adapter.write(CURRENT_SNAPSHOT_KEY, backup);
        return { status: 'ROLLED_BACK', snapshot: backup, rolledBackRevision: snapshot.revision };
      });
    },
  });
}

export const globalIntelligenceLocalRepository = createGlobalIntelligenceLocalRepository();
