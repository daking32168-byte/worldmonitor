/** Phase 22 deterministic local baseline predictions and expiry evaluation. */

import { assertStableEntityId, createStableEntityId, type StableEntityId } from './global-intelligence-contract';

export const LOCAL_BASELINE_MODEL_VERSION = 'LOCAL_BASELINE_V1';
export const PREDICTION_DISCLAIMER = 'AI/模型推演，不是事实、投资建议或已证明因果；概率为未校准的本地基线估计。';

export const PREDICTION_TARGET_KINDS = [
  'TREND_BURST',
  'ASSET_IMPACT',
  'INDUSTRY_IMPACT',
  'LOGISTICS_DISRUPTION',
] as const;
export type PredictionTargetKind = (typeof PREDICTION_TARGET_KINDS)[number];

export type PredictionFeature = Readonly<{
  feature_id: string;
  value: number;
  observed_at: string;
  source_evidence_ids: readonly StableEntityId[];
}>;

export type LocalPredictionRequest = Readonly<{
  target_kind: PredictionTargetKind;
  target_id: StableEntityId;
  horizon_minutes: 60 | 360 | 1440;
  data_cutoff_at: string;
  generated_at: string;
  historical_sample_count: number;
  distinct_source_count: number;
  features: readonly PredictionFeature[];
}>;

export type PredictionFactor = Readonly<{
  feature_id: string;
  observed_value: number;
  normalized_value: number;
  contribution: number;
  direction: 'SUPPORTING' | 'COUNTER';
}>;

export type Prediction = Readonly<{
  prediction_id: StableEntityId;
  status: 'ACTIVE' | 'INSUFFICIENT_DATA';
  target_kind: PredictionTargetKind;
  target_id: StableEntityId;
  horizon_minutes: number;
  data_cutoff_at: string;
  generated_at: string;
  expires_at: string;
  model_version: typeof LOCAL_BASELINE_MODEL_VERSION;
  methodology: 'DETERMINISTIC_UNCALIBRATED_LOGISTIC_BASELINE';
  probability_estimate: number | null;
  outcome_definition: string;
  supporting_factors: readonly PredictionFactor[];
  counter_factors: readonly PredictionFactor[];
  source_evidence_ids: readonly StableEntityId[];
  insufficiency_reasons: readonly string[];
  disclaimer: typeof PREDICTION_DISCLAIMER;
}>;

export type PredictionEvaluation = Readonly<{
  evaluation_id: string;
  prediction_id: StableEntityId;
  evaluated_at: string;
  outcome_observed: boolean;
  predicted_probability: number;
  brier_score: number;
  classification_correct: boolean;
  invalidated: boolean;
  invalidation_reason: string | null;
  model_version: typeof LOCAL_BASELINE_MODEL_VERSION;
}>;

type FeatureRule = Readonly<{ min: number; max: number; weight: number }>;

const FEATURE_RULES: Readonly<Record<PredictionTargetKind, Readonly<Record<string, FeatureRule>>>> = Object.freeze({
  TREND_BURST: Object.freeze({
    heat_score: { min: 0, max: 100, weight: 1.35 },
    velocity_per_hour: { min: 0, max: 20, weight: 0.95 },
    acceleration_ratio: { min: -2, max: 2, weight: 0.9 },
    platform_diversity: { min: 0, max: 3, weight: 0.65 },
    official_confirmation: { min: 0, max: 1, weight: 0.45 },
    audience_concentration: { min: 0, max: 1, weight: -0.7 },
  }),
  ASSET_IMPACT: Object.freeze({
    event_heat: { min: 0, max: 100, weight: 0.8 },
    issuer_exposure: { min: 0, max: 1, weight: 1.1 },
    market_liquidity: { min: 0, max: 1, weight: 0.4 },
    corroboration: { min: 0, max: 1, weight: 0.7 },
    uncertainty: { min: 0, max: 1, weight: -1.0 },
  }),
  INDUSTRY_IMPACT: Object.freeze({
    event_heat: { min: 0, max: 100, weight: 0.7 },
    geographic_overlap: { min: 0, max: 1, weight: 1.0 },
    supply_dependency: { min: 0, max: 1, weight: 1.1 },
    corroboration: { min: 0, max: 1, weight: 0.7 },
    uncertainty: { min: 0, max: 1, weight: -1.0 },
  }),
  LOGISTICS_DISRUPTION: Object.freeze({
    event_heat: { min: 0, max: 100, weight: 0.7 },
    route_overlap: { min: 0, max: 1, weight: 1.1 },
    observed_disruption: { min: 0, max: 1, weight: 1.2 },
    corroboration: { min: 0, max: 1, weight: 0.7 },
    uncertainty: { min: 0, max: 1, weight: -1.0 },
  }),
});

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!value.trim() || !Number.isFinite(parsed)) throw new Error(`${field} must be an ISO-compatible timestamp`);
  return parsed;
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of value.normalize('NFKC')) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function outcomeDefinition(kind: PredictionTargetKind, horizon: number): string {
  const window = horizon === 60 ? '1 小时' : horizon === 360 ? '6 小时' : '24 小时';
  const subject = {
    TREND_BURST: '事件进入 BREAKOUT_RISK 或 BREAKOUT',
    ASSET_IMPACT: '目标证券出现请求方事先定义并随后验证的显著影响',
    INDUSTRY_IMPACT: '目标产业出现请求方事先定义并随后验证的显著影响',
    LOGISTICS_DISRUPTION: '目标路线出现请求方事先定义并随后验证的中断',
  }[kind];
  return `数据截止后 ${window} 内，${subject}。`;
}

function validateRequest(request: LocalPredictionRequest): string[] {
  const reasons: string[] = [];
  try { assertStableEntityId(request.target_id); } catch (error) { reasons.push(error instanceof Error ? error.message : String(error)); }
  const cutoff = timestamp(request.data_cutoff_at, 'data_cutoff_at');
  const generated = timestamp(request.generated_at, 'generated_at');
  if (generated < cutoff) reasons.push('generated_at cannot precede data_cutoff_at');
  if (!Number.isInteger(request.historical_sample_count) || request.historical_sample_count < 20) reasons.push('at least 20 historical samples are required');
  if (!Number.isInteger(request.distinct_source_count) || request.distinct_source_count < 2) reasons.push('at least two distinct sources are required');
  const rules = FEATURE_RULES[request.target_kind];
  const byId = new Map<string, PredictionFeature>();
  for (const feature of request.features) {
    if (byId.has(feature.feature_id)) reasons.push(`duplicate feature ${feature.feature_id}`);
    byId.set(feature.feature_id, feature);
    if (!Number.isFinite(feature.value)) reasons.push(`${feature.feature_id} must be finite`);
    if (timestamp(feature.observed_at, `${feature.feature_id}.observed_at`) > cutoff) reasons.push(`${feature.feature_id} was observed after the data cutoff`);
    if (feature.source_evidence_ids.length === 0) reasons.push(`${feature.feature_id} has no source evidence`);
    for (const id of feature.source_evidence_ids) {
      try { assertStableEntityId(id, 'source'); } catch (error) { reasons.push(error instanceof Error ? error.message : String(error)); }
    }
  }
  for (const id of Object.keys(rules)) if (!byId.has(id)) reasons.push(`required feature ${id} is missing`);
  for (const id of byId.keys()) if (!rules[id]) reasons.push(`feature ${id} is unsupported for ${request.target_kind}`);
  return [...new Set(reasons)];
}

export function runLocalBaselinePrediction(request: LocalPredictionRequest): Prediction {
  const cutoffMs = timestamp(request.data_cutoff_at, 'data_cutoff_at');
  timestamp(request.generated_at, 'generated_at');
  const stableRequest = JSON.stringify({
    target_kind: request.target_kind,
    target_id: request.target_id,
    horizon_minutes: request.horizon_minutes,
    data_cutoff_at: request.data_cutoff_at,
    historical_sample_count: request.historical_sample_count,
    distinct_source_count: request.distinct_source_count,
    features: [...request.features].sort((a, b) => a.feature_id.localeCompare(b.feature_id)),
    model_version: LOCAL_BASELINE_MODEL_VERSION as typeof LOCAL_BASELINE_MODEL_VERSION,
  });
  const predictionId = createStableEntityId('pred', fnv1a64(stableRequest));
  const expiresAt = new Date(cutoffMs + request.horizon_minutes * 60_000).toISOString();
  const insufficiencyReasons = validateRequest(request);
  const sourceEvidenceIds = [...new Set(request.features.flatMap((feature) => feature.source_evidence_ids))].sort();
  const common = {
    prediction_id: predictionId,
    target_kind: request.target_kind,
    target_id: request.target_id,
    horizon_minutes: request.horizon_minutes,
    data_cutoff_at: request.data_cutoff_at,
    generated_at: request.generated_at,
    expires_at: expiresAt,
    model_version: LOCAL_BASELINE_MODEL_VERSION as typeof LOCAL_BASELINE_MODEL_VERSION,
    methodology: 'DETERMINISTIC_UNCALIBRATED_LOGISTIC_BASELINE' as const,
    outcome_definition: outcomeDefinition(request.target_kind, request.horizon_minutes),
    source_evidence_ids: sourceEvidenceIds,
    disclaimer: PREDICTION_DISCLAIMER as typeof PREDICTION_DISCLAIMER,
  };
  if (insufficiencyReasons.length > 0) {
    return {
      ...common,
      status: 'INSUFFICIENT_DATA',
      probability_estimate: null,
      supporting_factors: [],
      counter_factors: [],
      insufficiency_reasons: insufficiencyReasons,
    };
  }

  const rules = FEATURE_RULES[request.target_kind];
  const factors = request.features.map((feature): PredictionFactor => {
    const rule = rules[feature.feature_id]!;
    const normalized = clamp((feature.value - rule.min) / (rule.max - rule.min));
    const contribution = round((normalized - 0.5) * 2 * rule.weight);
    return {
      feature_id: feature.feature_id,
      observed_value: feature.value,
      normalized_value: round(normalized),
      contribution,
      direction: contribution >= 0 ? 'SUPPORTING' : 'COUNTER',
    };
  }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || a.feature_id.localeCompare(b.feature_id));
  const logit = -0.45 + factors.reduce((total, factor) => total + factor.contribution, 0);
  const probability = round(1 / (1 + Math.exp(-logit)), 4);
  return {
    ...common,
    status: 'ACTIVE',
    probability_estimate: probability,
    supporting_factors: factors.filter((factor) => factor.direction === 'SUPPORTING'),
    counter_factors: factors.filter((factor) => factor.direction === 'COUNTER'),
    insufficiency_reasons: [],
  };
}

export function evaluatePrediction(
  prediction: Prediction,
  evaluatedAt: string,
  outcomeObserved: boolean,
  invalidationReason: string | null = null,
): PredictionEvaluation {
  if (prediction.status !== 'ACTIVE' || prediction.probability_estimate === null) throw new Error('INSUFFICIENT_DATA predictions cannot be scored');
  if (timestamp(evaluatedAt, 'evaluated_at') < timestamp(prediction.expires_at, 'expires_at')) throw new Error('prediction has not reached its evaluation horizon');
  if (invalidationReason !== null && !invalidationReason.trim()) throw new Error('invalidation_reason cannot be blank');
  const actual = outcomeObserved ? 1 : 0;
  const probability = prediction.probability_estimate;
  return {
    evaluation_id: `evaluation_${prediction.prediction_id.slice('pred_'.length)}_${fnv1a64(evaluatedAt).slice(0, 8)}`,
    prediction_id: prediction.prediction_id,
    evaluated_at: evaluatedAt,
    outcome_observed: outcomeObserved,
    predicted_probability: probability,
    brier_score: round((probability - actual) ** 2),
    classification_correct: (probability >= 0.5) === outcomeObserved,
    invalidated: invalidationReason !== null,
    invalidation_reason: invalidationReason,
    model_version: LOCAL_BASELINE_MODEL_VERSION,
  };
}
