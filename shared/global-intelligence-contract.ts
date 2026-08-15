/**
 * Global Intelligence V2 shared truth contract.
 *
 * Runtime-neutral by design: browser, server, sidecar, scripts, and tests may
 * import this module without gaining access to credentials or transports.
 */

export const GLOBAL_INTELLIGENCE_CONTRACT_VERSION = 'global-intelligence/v1' as const;

export const EVIDENCE_CLASSES = [
  'OFFICIAL_REGISTRY',
  'OFFICIAL_CLUSTER',
  'COMPANY_DISCLOSED',
  'VERIFIED_COMPANY',
  'VERIFIED_FACILITY',
  'OBSERVED_MARKET',
  'OBSERVED_TRADE',
  'CONTRACTED_SHIPMENT',
  'PORT_OBSERVATION',
  'AIS_OBSERVATION',
  'OFFICIAL_WARNING',
  'SOCIAL_SIGNAL',
  'MODELLED_ROUTE',
  'MODELLED_FLOW',
  'MODELLED_IMPACT',
  'AI_SPECULATION',
  'HISTORICAL_SNAPSHOT',
  'UNVERIFIED',
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const AGGREGATION_LEVELS = [
  'GLOBAL',
  'COUNTRY',
  'STATE_PROVINCE',
  'CITY',
  'COUNTY_DISTRICT',
  'TOWN',
  'INDUSTRIAL_PARK',
  'CLUSTER',
  'COMPANY',
  'FACILITY',
  'PORT',
  'ROUTE',
  'SHIPMENT',
] as const;

export type AggregationLevel = (typeof AGGREGATION_LEVELS)[number];

export const COVERAGE_STATUSES = [
  'COMPLETE',
  'PARTIAL',
  'REFERENCE_ONLY',
  'OUT_OF_SCOPE',
  'UNKNOWN',
] as const;

export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const LICENSE_STATUSES = [
  'VERIFIED',
  'RESTRICTED',
  'REVIEW_REQUIRED',
  'NOT_CONFIGURED',
  'UNKNOWN',
] as const;

export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const FRESHNESS_STATUSES = [
  'REALTIME',
  'CURRENT',
  'STALE',
  'TIMESTAMP_UNKNOWN',
  'NOT_APPLICABLE',
  'UNAVAILABLE',
] as const;

export type FreshnessStatus = (typeof FRESHNESS_STATUSES)[number];

export const QUALITY_STATUSES = [
  'VERIFIED',
  'CORROBORATED',
  'CONFLICTED',
  'PARTIAL',
  'MODELLED',
  'UNVERIFIED',
] as const;

export type QualityStatus = (typeof QUALITY_STATUSES)[number];

export const DATA_DISPLAY_STATUSES = [
  'NOT_CONFIGURED',
  'UNAVAILABLE',
  'DELAYED_UNVERIFIED',
  'STALE',
  'OBSERVED',
  'REALTIME_VERIFIED',
  'MODELLED_ESTIMATE',
  'AI_SPECULATION',
  'SOURCE_REQUIRED',
] as const;

export type DataDisplayStatus = (typeof DATA_DISPLAY_STATUSES)[number];

export const EVIDENCE_NULL_REASON_CODES = [
  'NOT_APPLICABLE',
  'NOT_PROVIDED',
  'UNKNOWN',
  'WITHHELD_BY_LICENSE',
  'PROVIDER_UNAVAILABLE',
  'NOT_YET_OBSERVED',
  'INVALID_SOURCE',
  'AGGREGATION_MISMATCH',
] as const;

export type EvidenceNullReasonCode = (typeof EVIDENCE_NULL_REASON_CODES)[number];

export type ExplainedNull = Readonly<{
  code: EvidenceNullReasonCode;
  explanation: string;
}>;

export const STABLE_ENTITY_PREFIXES = [
  'geo',
  'cluster',
  'product',
  'company',
  'facility',
  'brand',
  'security',
  'exchange',
  'node',
  'event',
  'item',
  'flow',
  'shipment',
  'route',
  'pred',
  'source',
  'trend',
] as const;

export type StableEntityPrefix = (typeof STABLE_ENTITY_PREFIXES)[number];
export type StableEntityId = string & { readonly __stableEntityId: unique symbol };

const STABLE_ENTITY_ID_PATTERN = new RegExp(
  `^(${STABLE_ENTITY_PREFIXES.join('|')})_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$`,
);

export function isStableEntityId(value: unknown): value is StableEntityId {
  return typeof value === 'string' && STABLE_ENTITY_ID_PATTERN.test(value);
}

export function assertStableEntityId(value: unknown, expectedPrefix?: StableEntityPrefix): asserts value is StableEntityId {
  if (!isStableEntityId(value)) {
    throw new Error(`Invalid stable entity ID: ${String(value)}`);
  }
  if (expectedPrefix && !value.startsWith(`${expectedPrefix}_`)) {
    throw new Error(`Stable entity ID ${value} must use ${expectedPrefix}_ prefix`);
  }
}

export function createStableEntityId(prefix: StableEntityPrefix, opaqueId: string): StableEntityId {
  const value = `${prefix}_${opaqueId}`;
  assertStableEntityId(value, prefix);
  return value;
}

export type StableEntityAlias = Readonly<{
  entityId: StableEntityId;
  namespace: string;
  externalId: string;
}>;

export function assertStableEntityAlias(alias: StableEntityAlias): void {
  assertStableEntityId(alias.entityId);
  if (!alias.namespace.trim()) throw new Error('Stable entity alias namespace is required');
  if (!alias.externalId.trim()) throw new Error('Stable entity alias externalId is required');
}

export const NULLABLE_SOURCE_EVIDENCE_FIELDS = [
  'sourceUrl',
  'sourceReference',
  'sourcePublishedAt',
  'observedAt',
  'retrievedAt',
  'validFrom',
  'validTo',
  'periodStart',
  'periodEnd',
  'confidence',
  'methodologyVersion',
] as const;

export type NullableSourceEvidenceField = (typeof NULLABLE_SOURCE_EVIDENCE_FIELDS)[number];

export type SourceEvidence = Readonly<{
  sourceId: StableEntityId;
  providerId: string;
  sourceType: string;
  sourceTitle: string;
  sourceUrl: string | null;
  sourceReference: string | null;
  sourcePublishedAt: string | null;
  observedAt: string | null;
  retrievedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  evidenceClass: EvidenceClass;
  aggregationLevel: AggregationLevel;
  licenseStatus: LicenseStatus;
  freshnessStatus: FreshnessStatus;
  qualityStatus: QualityStatus;
  confidence: number | null;
  methodologyVersion: string | null;
  nullReasons: Readonly<Partial<Record<NullableSourceEvidenceField, ExplainedNull>>>;
}>;

const NON_EMPTY_SOURCE_FIELDS = [
  'providerId',
  'sourceType',
  'sourceTitle',
] as const satisfies readonly (keyof SourceEvidence)[];

const TIMESTAMP_SOURCE_FIELDS = [
  'sourcePublishedAt',
  'observedAt',
  'retrievedAt',
  'validFrom',
  'validTo',
  'periodStart',
  'periodEnd',
] as const satisfies readonly NullableSourceEvidenceField[];

function isValidTimestamp(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function validateExplainedNull(field: NullableSourceEvidenceField, reason: ExplainedNull | undefined): string[] {
  if (!reason) return [`${field} is null but has no explicit null reason`];
  if (!EVIDENCE_NULL_REASON_CODES.includes(reason.code)) return [`${field} has an invalid null reason code`];
  if (!reason.explanation.trim()) return [`${field} has an empty null explanation`];
  return [];
}

export function validateSourceEvidence(evidence: SourceEvidence): string[] {
  const errors: string[] = [];
  try {
    assertStableEntityId(evidence.sourceId, 'source');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'sourceId is invalid');
  }
  for (const field of NON_EMPTY_SOURCE_FIELDS) {
    if (typeof evidence[field] !== 'string' || !evidence[field].trim()) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (evidence.sourceUrl === null && evidence.sourceReference === null) {
    errors.push('sourceUrl or sourceReference is required');
  }
  if (evidence.sourceUrl !== null) {
    try {
      const url = new URL(evidence.sourceUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') errors.push('sourceUrl must use http or https');
    } catch {
      errors.push('sourceUrl must be an absolute URL');
    }
  }
  for (const field of NULLABLE_SOURCE_EVIDENCE_FIELDS) {
    const value = evidence[field];
    const reason = evidence.nullReasons[field];
    if (value === null) {
      errors.push(...validateExplainedNull(field, reason));
    } else if (reason) {
      errors.push(`${field} is present but also has a null reason`);
    }
  }
  for (const field of TIMESTAMP_SOURCE_FIELDS) {
    const value = evidence[field];
    if (value !== null && !isValidTimestamp(value)) errors.push(`${field} must be an ISO-compatible timestamp`);
  }
  if (evidence.confidence !== null && (!Number.isFinite(evidence.confidence) || evidence.confidence < 0 || evidence.confidence > 1)) {
    errors.push('confidence must be between 0 and 1');
  }
  return errors;
}

export function assertSourceEvidence(evidence: SourceEvidence): void {
  const errors = validateSourceEvidence(evidence);
  if (errors.length > 0) throw new Error(`Invalid SourceEvidence: ${errors.join('; ')}`);
}

const GEOGRAPHIC_AGGREGATION_RANK: Partial<Record<AggregationLevel, number>> = {
  GLOBAL: 0,
  COUNTRY: 1,
  STATE_PROVINCE: 2,
  CITY: 3,
  COUNTY_DISTRICT: 4,
  TOWN: 5,
  INDUSTRIAL_PARK: 6,
};

/**
 * Whether evidence may be presented in a target context. Geographic evidence
 * may be the same level or finer; non-geographic relationships are explicit.
 */
export function isAggregationCompatible(source: AggregationLevel, target: AggregationLevel): boolean {
  if (source === target) return true;
  const sourceRank = GEOGRAPHIC_AGGREGATION_RANK[source];
  const targetRank = GEOGRAPHIC_AGGREGATION_RANK[target];
  if (sourceRank !== undefined && targetRank !== undefined) return sourceRank >= targetRank;
  if (target === 'CLUSTER') return source === 'COMPANY' || source === 'FACILITY';
  if (target === 'COMPANY') return source === 'FACILITY';
  return false;
}

export function assertAggregationCompatible(source: AggregationLevel, target: AggregationLevel): void {
  if (!isAggregationCompatible(source, target)) {
    throw new Error(`Aggregation mismatch: ${source} evidence cannot be asserted as ${target}`);
  }
}

export const MODEL_OR_NON_FACT_EVIDENCE_CLASSES = [
  'SOCIAL_SIGNAL',
  'MODELLED_ROUTE',
  'MODELLED_FLOW',
  'MODELLED_IMPACT',
  'AI_SPECULATION',
  'UNVERIFIED',
] as const satisfies readonly EvidenceClass[];

export type FactEvidenceClass = Exclude<EvidenceClass, (typeof MODEL_OR_NON_FACT_EVIDENCE_CLASSES)[number]>;

export function isFactEvidenceClass(value: EvidenceClass): value is FactEvidenceClass {
  return !MODEL_OR_NON_FACT_EVIDENCE_CLASSES.includes(value as (typeof MODEL_OR_NON_FACT_EVIDENCE_CLASSES)[number]);
}

export function assertEvidenceCanEnterFactTable(evidence: SourceEvidence): asserts evidence is SourceEvidence & { evidenceClass: FactEvidenceClass } {
  assertSourceEvidence(evidence);
  if (!isFactEvidenceClass(evidence.evidenceClass)) {
    throw new Error(`${evidence.evidenceClass} evidence cannot enter a fact table`);
  }
}

export const EVIDENCE_CONFLICT_STATUSES = [
  'UNRESOLVED',
  'RESOLVED_WITH_RULE',
] as const;

export type EvidenceConflictStatus = (typeof EVIDENCE_CONFLICT_STATUSES)[number];

export type EvidenceConflict<T> = Readonly<{
  conflictId: string;
  status: EvidenceConflictStatus;
  candidates: readonly Readonly<{ value: T; evidenceId: StableEntityId }>[];
  preferredEvidenceId: StableEntityId | null;
  selectionRule: string | null;
}>;

export function validateEvidenceConflict<T>(conflict: EvidenceConflict<T>): string[] {
  const errors: string[] = [];
  if (!conflict.conflictId.trim()) errors.push('conflictId is required');
  if (conflict.candidates.length < 2) errors.push('a conflict must retain at least two candidates');
  const candidateIds = new Set<string>();
  for (const candidate of conflict.candidates) {
    try {
      assertStableEntityId(candidate.evidenceId, 'source');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'candidate evidenceId is invalid');
    }
    if (candidateIds.has(candidate.evidenceId)) errors.push(`duplicate candidate evidenceId: ${candidate.evidenceId}`);
    candidateIds.add(candidate.evidenceId);
  }
  if (conflict.status === 'UNRESOLVED') {
    if (conflict.preferredEvidenceId !== null) errors.push('unresolved conflict cannot select a preferred value');
    if (conflict.selectionRule !== null) errors.push('unresolved conflict cannot claim a selection rule');
  } else {
    if (conflict.preferredEvidenceId === null || !candidateIds.has(conflict.preferredEvidenceId)) {
      errors.push('resolved conflict preferredEvidenceId must reference a retained candidate');
    }
    if (!conflict.selectionRule?.trim()) errors.push('resolved conflict requires a selection rule');
  }
  return errors;
}

export type ProviderTruth = Readonly<{
  providerId: string;
  configured: boolean;
  coverageStatus: CoverageStatus;
  licenseStatus: LicenseStatus;
  lastVerifiedAt: string | null;
  lastVerifiedAtNullReason: ExplainedNull | null;
}>;

export type GlobalIntelligenceResponse<T> = Readonly<{
  contractVersion: typeof GLOBAL_INTELLIGENCE_CONTRACT_VERSION;
  status: DataDisplayStatus;
  data: T | null;
  evidence: readonly SourceEvidence[];
  conflicts: readonly EvidenceConflict<unknown>[];
  nullReason: ExplainedNull | null;
  generatedAt: string;
  provider: ProviderTruth;
}>;

const EMPTY_RESPONSE_STATUSES = new Set<DataDisplayStatus>([
  'NOT_CONFIGURED',
  'UNAVAILABLE',
  'SOURCE_REQUIRED',
]);

export function validateGlobalIntelligenceResponse<T>(response: GlobalIntelligenceResponse<T>): string[] {
  const errors: string[] = [];
  if (!isValidTimestamp(response.generatedAt)) errors.push('generatedAt must be an ISO-compatible timestamp');
  if (!response.provider.providerId.trim()) errors.push('provider.providerId is required');
  if (response.provider.lastVerifiedAt === null) {
    if (!response.provider.lastVerifiedAtNullReason?.explanation.trim()) {
      errors.push('provider.lastVerifiedAt requires an explicit null reason');
    }
  } else {
    if (!isValidTimestamp(response.provider.lastVerifiedAt)) errors.push('provider.lastVerifiedAt must be an ISO-compatible timestamp');
    if (response.provider.lastVerifiedAtNullReason !== null) errors.push('provider.lastVerifiedAt is present but also has a null reason');
  }
  if (!response.provider.configured && response.status !== 'NOT_CONFIGURED') {
    errors.push('an unconfigured Provider must use NOT_CONFIGURED status');
  }
  const emptyStatus = EMPTY_RESPONSE_STATUSES.has(response.status);
  if (response.data === null) {
    if (!emptyStatus) errors.push(`${response.status} cannot return an empty success`);
    if (!response.nullReason?.explanation.trim()) errors.push('empty response requires an explicit null reason');
  } else {
    if (emptyStatus) errors.push(`${response.status} cannot include data`);
    if (response.nullReason !== null) errors.push('non-empty response cannot include a null reason');
  }
  for (const evidence of response.evidence) errors.push(...validateSourceEvidence(evidence));
  for (const conflict of response.conflicts) errors.push(...validateEvidenceConflict(conflict));
  if (response.data !== null && ['OBSERVED', 'REALTIME_VERIFIED', 'STALE', 'DELAYED_UNVERIFIED'].includes(response.status) && response.evidence.length === 0) {
    errors.push(`${response.status} data requires SourceEvidence`);
  }
  if (response.status === 'REALTIME_VERIFIED') {
    if (response.provider.licenseStatus !== 'VERIFIED') errors.push('REALTIME_VERIFIED requires a verified Provider license');
    if (!response.evidence.some((item) => item.licenseStatus === 'VERIFIED' && item.freshnessStatus === 'REALTIME')) {
      errors.push('REALTIME_VERIFIED requires realtime, license-verified evidence');
    }
  }
  if (response.status === 'MODELLED_ESTIMATE' && !response.evidence.some((item) => item.evidenceClass.startsWith('MODELLED_'))) {
    errors.push('MODELLED_ESTIMATE requires model evidence');
  }
  if (response.status === 'AI_SPECULATION' && !response.evidence.some((item) => item.evidenceClass === 'AI_SPECULATION')) {
    errors.push('AI_SPECULATION status requires AI_SPECULATION evidence');
  }
  return errors;
}

export function assertGlobalIntelligenceResponse<T>(response: GlobalIntelligenceResponse<T>): void {
  const errors = validateGlobalIntelligenceResponse(response);
  if (errors.length > 0) throw new Error(`Invalid GlobalIntelligenceResponse: ${errors.join('; ')}`);
}
