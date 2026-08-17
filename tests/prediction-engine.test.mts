import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { createStableEntityId } from '../shared/global-intelligence-contract.ts';
import {
  LOCAL_BASELINE_MODEL_VERSION,
  PREDICTION_DISCLAIMER,
  evaluatePrediction,
  runLocalBaselinePrediction,
  type LocalPredictionRequest,
  type PredictionFeature,
  type PredictionTargetKind,
} from '../shared/prediction-engine.ts';
import {
  createPredictionRepository,
  type PredictionRepositoryAdapter,
} from '../src/services/prediction-repository.ts';

const SOURCE_A = createStableEntityId('source', 'prediction-a');
const SOURCE_B = createStableEntityId('source', 'prediction-b');

const FEATURES: Readonly<Record<PredictionTargetKind, readonly Readonly<[string, number]>[]>> = {
  TREND_BURST: [['heat_score', 68], ['velocity_per_hour', 9], ['acceleration_ratio', 0.8], ['platform_diversity', 3], ['official_confirmation', 0], ['audience_concentration', 0.2]],
  ASSET_IMPACT: [['event_heat', 68], ['issuer_exposure', 0.8], ['market_liquidity', 0.7], ['corroboration', 0.7], ['uncertainty', 0.2]],
  INDUSTRY_IMPACT: [['event_heat', 68], ['geographic_overlap', 0.8], ['supply_dependency', 0.7], ['corroboration', 0.7], ['uncertainty', 0.2]],
  LOGISTICS_DISRUPTION: [['event_heat', 68], ['route_overlap', 0.8], ['observed_disruption', 0.7], ['corroboration', 0.7], ['uncertainty', 0.2]],
};

function request(kind: PredictionTargetKind = 'TREND_BURST', overrides: Partial<LocalPredictionRequest> = {}): LocalPredictionRequest {
  const features: PredictionFeature[] = FEATURES[kind].map(([feature_id, value], index) => ({
    feature_id,
    value,
    observed_at: '2026-08-15T02:00:00Z',
    source_evidence_ids: [index % 2 === 0 ? SOURCE_A : SOURCE_B],
  }));
  return {
    target_kind: kind,
    target_id: createStableEntityId(kind === 'TREND_BURST' ? 'event' : kind === 'ASSET_IMPACT' ? 'security' : kind === 'INDUSTRY_IMPACT' ? 'cluster' : 'route', `prediction-${kind.toLowerCase()}`),
    horizon_minutes: 60,
    data_cutoff_at: '2026-08-15T02:00:00Z',
    generated_at: '2026-08-15T02:01:00Z',
    historical_sample_count: 40,
    distinct_source_count: 2,
    features,
    ...overrides,
  };
}

function memoryAdapter(): PredictionRepositoryAdapter {
  const values = new Map<string, unknown>();
  return {
    async read<T>(key: string): Promise<T | null> { return (values.get(key) as T | undefined) ?? null; },
    async write<T>(key: string, value: T): Promise<void> { values.set(key, structuredClone(value)); },
  };
}

describe('Phase 22 LOCAL_BASELINE_V1 prediction and evaluation', () => {
  it('is deterministic, versioned, traceable and supports all four required target families', () => {
    for (const kind of Object.keys(FEATURES) as PredictionTargetKind[]) {
      const first = runLocalBaselinePrediction(request(kind));
      const second = runLocalBaselinePrediction(request(kind));
      assert.deepEqual(first, second);
      assert.equal(first.status, 'ACTIVE');
      assert.equal(first.model_version, LOCAL_BASELINE_MODEL_VERSION);
      assert.equal(first.methodology, 'DETERMINISTIC_UNCALIBRATED_LOGISTIC_BASELINE');
      assert.ok(first.probability_estimate !== null && first.probability_estimate >= 0 && first.probability_estimate <= 1);
      assert.deepEqual(first.source_evidence_ids, [SOURCE_A, SOURCE_B]);
      assert.equal(first.disclaimer, PREDICTION_DISCLAIMER);
      assert.match(first.outcome_definition, /1 小时/);
      assert.ok(first.supporting_factors.length > 0);
    }
  });

  it('returns INSUFFICIENT_DATA without inventing a probability or factors', () => {
    const prediction = runLocalBaselinePrediction(request('TREND_BURST', {
      historical_sample_count: 3,
      distinct_source_count: 1,
      features: request().features.filter((feature) => feature.feature_id !== 'acceleration_ratio'),
    }));
    assert.equal(prediction.status, 'INSUFFICIENT_DATA');
    assert.equal(prediction.probability_estimate, null);
    assert.deepEqual(prediction.supporting_factors, []);
    assert.ok(prediction.insufficiency_reasons.some((reason) => /20 historical/.test(reason)));
    assert.ok(prediction.insufficiency_reasons.some((reason) => /acceleration_ratio/.test(reason)));
  });

  it('scores only after expiry and preserves failed outcomes in the evaluation record', () => {
    const prediction = runLocalBaselinePrediction(request());
    assert.throws(() => evaluatePrediction(prediction, '2026-08-15T02:59:59Z', false), /not reached/);
    const evaluation = evaluatePrediction(prediction, '2026-08-15T03:00:00Z', false);
    assert.equal(evaluation.outcome_observed, false);
    assert.ok(evaluation.brier_score >= 0 && evaluation.brier_score <= 1);
    assert.equal(evaluation.model_version, LOCAL_BASELINE_MODEL_VERSION);
  });

  it('stores facts and predictions separately, remains idempotent and reports historical performance', async () => {
    const repository = createPredictionRepository(memoryAdapter());
    const created = await repository.create(request());
    assert.equal(created.status, 'COMMITTED');
    assert.equal(created.snapshot.revision, 1);
    assert.equal((await repository.create(request())).status, 'NO_CHANGE');
    const evaluated = await repository.evaluate(created.prediction.prediction_id, '2026-08-15T03:00:00Z', false);
    assert.equal(evaluated.status, 'COMMITTED');
    assert.equal((await repository.history()).length, 1);
    const performance = await repository.performance();
    assert.equal(performance.evaluated_count, 1);
    assert.equal(performance.invalidated_count, 0);
    assert.ok(performance.mean_brier_score !== null);
    assert.ok(performance.classification_accuracy === 0 || performance.classification_accuracy === 1);
  });

  it('contains no random-number path and the UI can retain every prediction status', () => {
    const engine = readFileSync(new URL('../shared/prediction-engine.ts', import.meta.url), 'utf8');
    const repository = readFileSync(new URL('../src/services/prediction-repository.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(`${engine}\n${repository}`, /Math\.random|crypto\.getRandomValues/);
    assert.match(repository, /predictions: \{ \.\.\.snapshot\.predictions/);
    assert.match(repository, /failed predictions are never rewritten/);
    const page = readFileSync(new URL('../src/features/predictions/predictions.ts', import.meta.url), 'utf8');
    const operations = readFileSync(new URL('../src/services/provider-operations.ts', import.meta.url), 'utf8');
    assert.match(page, /probability_estimate === null/);
    assert.match(page, /prediction\.data_cutoff_at/);
    assert.match(page, /prediction\.disclaimer/);
    assert.match(operations, /local-baseline-prediction/);
    assert.match(operations, /AI_SPECULATION/);
  });
});
