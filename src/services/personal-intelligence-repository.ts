import {
  assertAlertRule,
  assertWatchlistEntry,
  evaluateAlertSignals,
  type AlertRule,
  type AlertSignal,
  type LocalNotificationRecord,
  type PersonalIntelligenceSettings,
  type WatchlistEntry,
} from '../../shared/personal-intelligence';
import { getPersistentCache, setPersistentCache } from './persistent-cache';

const PERSONAL_INTELLIGENCE_KEY = 'global-intelligence:personal-intelligence:v1:current';

export const DEFAULT_PERSONAL_INTELLIGENCE_SETTINGS: PersonalIntelligenceSettings = Object.freeze({
  max_notifications_per_window: 3,
  rate_window_minutes: 15,
  quiet_hours_local: null,
  timezone_offset_minutes: -new Date().getTimezoneOffset(),
});

export type PersonalIntelligenceSnapshot = Readonly<{
  schemaVersion: 1;
  revision: number;
  watches: Readonly<Record<string, WatchlistEntry>>;
  rules: Readonly<Record<string, AlertRule>>;
  notifications: readonly LocalNotificationRecord[];
  settings: PersonalIntelligenceSettings;
}>;

export type PersonalIntelligenceAdapter = Readonly<{
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}>;

function emptySnapshot(): PersonalIntelligenceSnapshot {
  return { schemaVersion: 1, revision: 0, watches: {}, rules: {}, notifications: [], settings: DEFAULT_PERSONAL_INTELLIGENCE_SETTINGS };
}

function isSnapshot(value: unknown): value is PersonalIntelligenceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersonalIntelligenceSnapshot>;
  return candidate.schemaVersion === 1 && Number.isInteger(candidate.revision) && (candidate.revision ?? -1) >= 0
    && typeof candidate.watches === 'object' && candidate.watches !== null
    && typeof candidate.rules === 'object' && candidate.rules !== null
    && Array.isArray(candidate.notifications)
    && typeof candidate.settings === 'object' && candidate.settings !== null;
}

const persistentAdapter: PersonalIntelligenceAdapter = {
  async read<T>(key: string): Promise<T | null> { return (await getPersistentCache<T>(key))?.data ?? null; },
  async write<T>(key: string, value: T): Promise<void> { await setPersistentCache(key, value); },
};

export function createPersonalIntelligenceRepository(adapter: PersonalIntelligenceAdapter = persistentAdapter) {
  let mutationQueue: Promise<void> = Promise.resolve();
  const load = async (): Promise<PersonalIntelligenceSnapshot> => {
    const value = await adapter.read<PersonalIntelligenceSnapshot>(PERSONAL_INTELLIGENCE_KEY);
    if (value === null) return emptySnapshot();
    if (!isSnapshot(value)) throw new Error('Stored personal intelligence data has an unsupported or corrupt schema');
    return value;
  };
  const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };
  const save = async (snapshot: PersonalIntelligenceSnapshot): Promise<void> => adapter.write(PERSONAL_INTELLIGENCE_KEY, snapshot);

  return Object.freeze({
    load,

    async upsertWatch(watch: WatchlistEntry): Promise<PersonalIntelligenceSnapshot> {
      return serialized(async () => {
        assertWatchlistEntry(watch);
        const snapshot = await load();
        const existing = snapshot.watches[watch.watch_id];
        if (existing && existing.created_at !== watch.created_at) throw new Error('Watch created_at is immutable');
        if (existing && JSON.stringify(existing) === JSON.stringify(watch)) return snapshot;
        const next = { ...snapshot, revision: snapshot.revision + 1, watches: { ...snapshot.watches, [watch.watch_id]: watch } };
        await save(next);
        return next;
      });
    },

    async removeWatch(watchId: string): Promise<PersonalIntelligenceSnapshot> {
      return serialized(async () => {
        const snapshot = await load();
        if (!snapshot.watches[watchId]) return snapshot;
        const watches = { ...snapshot.watches };
        delete watches[watchId];
        const rules = Object.fromEntries(Object.entries(snapshot.rules).filter(([, rule]) => rule.watch_id !== watchId));
        const next = { ...snapshot, revision: snapshot.revision + 1, watches, rules };
        await save(next);
        return next;
      });
    },

    async upsertRule(rule: AlertRule): Promise<PersonalIntelligenceSnapshot> {
      return serialized(async () => {
        const snapshot = await load();
        assertAlertRule(rule, new Map(Object.values(snapshot.watches).map((watch) => [watch.watch_id, watch])));
        const existing = snapshot.rules[rule.rule_id];
        if (existing && JSON.stringify(existing) === JSON.stringify(rule)) return snapshot;
        const next = { ...snapshot, revision: snapshot.revision + 1, rules: { ...snapshot.rules, [rule.rule_id]: rule } };
        await save(next);
        return next;
      });
    },

    async updateSettings(settings: PersonalIntelligenceSettings): Promise<PersonalIntelligenceSnapshot> {
      return serialized(async () => {
        evaluateAlertSignals([], [], [], [], new Date().toISOString(), settings);
        const snapshot = await load();
        if (JSON.stringify(snapshot.settings) === JSON.stringify(settings)) return snapshot;
        const next = { ...snapshot, revision: snapshot.revision + 1, settings };
        await save(next);
        return next;
      });
    },

    async evaluate(signals: readonly AlertSignal[], nowIso: string): Promise<Readonly<{ created: readonly LocalNotificationRecord[]; snapshot: PersonalIntelligenceSnapshot }>> {
      return serialized(async () => {
        const snapshot = await load();
        const created = evaluateAlertSignals(Object.values(snapshot.watches), Object.values(snapshot.rules), signals, snapshot.notifications, nowIso, snapshot.settings);
        if (created.length === 0) return { created, snapshot };
        const next = { ...snapshot, revision: snapshot.revision + 1, notifications: [...snapshot.notifications, ...created] };
        await save(next);
        return { created, snapshot: next };
      });
    },

    async updateNotification(
      notificationId: string,
      patch: Pick<LocalNotificationRecord, 'delivery_status' | 'delivery_message'> | Pick<LocalNotificationRecord, 'read_at'>,
    ): Promise<PersonalIntelligenceSnapshot> {
      return serialized(async () => {
        const snapshot = await load();
        const index = snapshot.notifications.findIndex((item) => item.notification_id === notificationId);
        if (index < 0) throw new Error(`Unknown notification ${notificationId}`);
        const current = snapshot.notifications[index]!;
        const replacement = Object.freeze({ ...current, ...patch });
        if (JSON.stringify(current) === JSON.stringify(replacement)) return snapshot;
        const notifications = [...snapshot.notifications];
        notifications[index] = replacement;
        const next = { ...snapshot, revision: snapshot.revision + 1, notifications };
        await save(next);
        return next;
      });
    },
  });
}

export const personalIntelligenceRepository = createPersonalIntelligenceRepository();
