import {
  evaluatePrediction,
  runLocalBaselinePrediction,
  type LocalPredictionRequest,
  type Prediction,
  type PredictionEvaluation,
} from '../../shared/prediction-engine';
import { getPersistentCache, setPersistentCache } from './persistent-cache';

const PREDICTION_REPOSITORY_KEY = 'global-intelligence:prediction-repository:v1:current';

export type PredictionRepositorySnapshot = Readonly<{
  schemaVersion: 1;
  revision: number;
  predictions: Readonly<Record<string, Prediction>>;
  evaluations: readonly PredictionEvaluation[];
}>;

export type PredictionRepositoryAdapter = Readonly<{
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}>;

function emptySnapshot(): PredictionRepositorySnapshot {
  return { schemaVersion: 1, revision: 0, predictions: {}, evaluations: [] };
}

function isSnapshot(value: unknown): value is PredictionRepositorySnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PredictionRepositorySnapshot>;
  return candidate.schemaVersion === 1
    && Number.isInteger(candidate.revision)
    && (candidate.revision ?? -1) >= 0
    && typeof candidate.predictions === 'object'
    && candidate.predictions !== null
    && Array.isArray(candidate.evaluations);
}

function samePrediction(left: Prediction, right: Prediction): boolean {
  const { generated_at: leftGeneratedAt, ...leftStable } = left;
  const { generated_at: rightGeneratedAt, ...rightStable } = right;
  void leftGeneratedAt;
  void rightGeneratedAt;
  return JSON.stringify(leftStable) === JSON.stringify(rightStable);
}

const persistentAdapter: PredictionRepositoryAdapter = {
  async read<T>(key: string): Promise<T | null> {
    return (await getPersistentCache<T>(key))?.data ?? null;
  },
  async write<T>(key: string, value: T): Promise<void> {
    await setPersistentCache(key, value);
  },
};

export function createPredictionRepository(adapter: PredictionRepositoryAdapter = persistentAdapter) {
  let mutationQueue: Promise<void> = Promise.resolve();

  const load = async (): Promise<PredictionRepositorySnapshot> => {
    const value = await adapter.read<PredictionRepositorySnapshot>(PREDICTION_REPOSITORY_KEY);
    if (value === null) return emptySnapshot();
    if (!isSnapshot(value)) throw new Error('Stored prediction repository has an unsupported or corrupt schema');
    return value;
  };
  const save = async (snapshot: PredictionRepositorySnapshot): Promise<void> => adapter.write(PREDICTION_REPOSITORY_KEY, snapshot);
  const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  return Object.freeze({
    load,

    async create(request: LocalPredictionRequest): Promise<Readonly<{ status: 'COMMITTED' | 'NO_CHANGE'; prediction: Prediction; snapshot: PredictionRepositorySnapshot }>> {
      return serialized(async () => {
        const snapshot = await load();
        const prediction = runLocalBaselinePrediction(request);
        const existing = snapshot.predictions[prediction.prediction_id];
        if (existing) {
          if (!samePrediction(existing, prediction)) throw new Error(`${prediction.prediction_id} conflicts with an existing prediction`);
          return { status: 'NO_CHANGE', prediction: existing, snapshot };
        }
        const next: PredictionRepositorySnapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          predictions: { ...snapshot.predictions, [prediction.prediction_id]: prediction },
        };
        await save(next);
        return { status: 'COMMITTED', prediction, snapshot: next };
      });
    },

    async evaluate(
      predictionId: string,
      evaluatedAt: string,
      outcomeObserved: boolean,
      invalidationReason: string | null = null,
    ): Promise<Readonly<{ status: 'COMMITTED' | 'NO_CHANGE'; evaluation: PredictionEvaluation; snapshot: PredictionRepositorySnapshot }>> {
      return serialized(async () => {
        const snapshot = await load();
        const prediction = snapshot.predictions[predictionId];
        if (!prediction) throw new Error(`Unknown prediction ${predictionId}`);
        const evaluation = evaluatePrediction(prediction, evaluatedAt, outcomeObserved, invalidationReason);
        const existing = snapshot.evaluations.find((item) => item.prediction_id === prediction.prediction_id);
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(evaluation)) throw new Error(`${prediction.prediction_id} already has a different evaluation; failed predictions are never rewritten`);
          return { status: 'NO_CHANGE', evaluation: existing, snapshot };
        }
        const next: PredictionRepositorySnapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          evaluations: [...snapshot.evaluations, evaluation],
        };
        await save(next);
        return { status: 'COMMITTED', evaluation, snapshot: next };
      });
    },

    async history(): Promise<readonly Prediction[]> {
      return Object.values((await load()).predictions).sort((a, b) => b.generated_at.localeCompare(a.generated_at) || a.prediction_id.localeCompare(b.prediction_id));
    },

    async performance(): Promise<Readonly<{ evaluated_count: number; invalidated_count: number; mean_brier_score: number | null; classification_accuracy: number | null }>> {
      const evaluations = (await load()).evaluations;
      const admitted = evaluations.filter((item) => !item.invalidated);
      return {
        evaluated_count: admitted.length,
        invalidated_count: evaluations.length - admitted.length,
        mean_brier_score: admitted.length > 0 ? admitted.reduce((sum, item) => sum + item.brier_score, 0) / admitted.length : null,
        classification_accuracy: admitted.length > 0 ? admitted.filter((item) => item.classification_correct).length / admitted.length : null,
      };
    },
  });
}

export const predictionRepository = createPredictionRepository();
