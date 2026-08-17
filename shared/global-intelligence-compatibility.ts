/** Additive adapters from legacy WorldMonitor contracts into V2 truth types. */

import type { ChinaFactoryCluster, ChinaFactoryEvidenceLevel } from './china-factory-clusters';
import {
  createStableEntityId,
  type DataDisplayStatus,
  type EvidenceClass,
  type ExplainedNull,
  type SourceEvidence,
  type StableEntityAlias,
} from './global-intelligence-contract';

export const LEGACY_MARKET_PROVIDER_STATUSES = [
  'PROVIDER_STATUS_UNSPECIFIED',
  'PROVIDER_STATUS_REALTIME_LICENSED',
  'PROVIDER_STATUS_DELAYED_15M',
  'PROVIDER_STATUS_DELAYED_UNVERIFIED',
  'PROVIDER_STATUS_END_OF_DAY',
  'PROVIDER_STATUS_HISTORICAL_SNAPSHOT',
  'PROVIDER_STATUS_STALE',
  'PROVIDER_STATUS_DEGRADED',
  'PROVIDER_STATUS_NOT_CONFIGURED',
  'PROVIDER_STATUS_UNAVAILABLE',
  'PROVIDER_STATUS_MARKET_CLOSED',
] as const;

export type LegacyMarketProviderStatus = (typeof LEGACY_MARKET_PROVIDER_STATUSES)[number];

export const LEGACY_MARKET_STATUS_TO_V2: Record<LegacyMarketProviderStatus, DataDisplayStatus> = {
  PROVIDER_STATUS_UNSPECIFIED: 'UNAVAILABLE',
  PROVIDER_STATUS_REALTIME_LICENSED: 'REALTIME_VERIFIED',
  PROVIDER_STATUS_DELAYED_15M: 'DELAYED_VERIFIED',
  PROVIDER_STATUS_DELAYED_UNVERIFIED: 'DELAYED_UNVERIFIED',
  PROVIDER_STATUS_END_OF_DAY: 'END_OF_DAY',
  PROVIDER_STATUS_HISTORICAL_SNAPSHOT: 'HISTORICAL_SNAPSHOT',
  PROVIDER_STATUS_STALE: 'STALE',
  PROVIDER_STATUS_DEGRADED: 'UNAVAILABLE',
  PROVIDER_STATUS_NOT_CONFIGURED: 'NOT_CONFIGURED',
  PROVIDER_STATUS_UNAVAILABLE: 'UNAVAILABLE',
  PROVIDER_STATUS_MARKET_CLOSED: 'MARKET_CLOSED',
};

export function mapLegacyMarketProviderStatus(status: LegacyMarketProviderStatus): DataDisplayStatus {
  return LEGACY_MARKET_STATUS_TO_V2[status];
}

export function mapLegacyMaritimeSnapshotState(input: Readonly<{
  configured: boolean;
  connected: boolean;
  observationCount: number;
}>): DataDisplayStatus {
  if (!input.configured) return 'NOT_CONFIGURED';
  if (!input.connected) return 'UNAVAILABLE';
  if (!Number.isFinite(input.observationCount) || input.observationCount <= 0) return 'SOURCE_REQUIRED';
  return 'OBSERVED';
}

export const CHINA_FACTORY_EVIDENCE_TO_V2: Record<ChinaFactoryEvidenceLevel, EvidenceClass> = {
  OBSERVED_OFFICIAL: 'OFFICIAL_CLUSTER',
  MODELLED_ESTIMATE: 'MODELLED_FLOW',
  BILL_OF_LADING_OBSERVED: 'CONTRACTED_SHIPMENT',
  UNVERIFIED: 'UNVERIFIED',
};

export function mapChinaFactoryEvidenceClass(level: ChinaFactoryEvidenceLevel): EvidenceClass {
  return CHINA_FACTORY_EVIDENCE_TO_V2[level];
}

export function chinaFactoryStableAlias(cluster: ChinaFactoryCluster): StableEntityAlias {
  return {
    entityId: createStableEntityId('cluster', cluster.id),
    namespace: 'worldmonitor.china-factory-cluster.v1',
    externalId: cluster.id,
  };
}

const notApplicable = (explanation: string): ExplainedNull => ({
  code: 'NOT_APPLICABLE',
  explanation,
});

const unknown = (explanation: string): ExplainedNull => ({
  code: 'UNKNOWN',
  explanation,
});

/**
 * Maps only the reviewed cluster-source statement. It never turns national
 * trade aggregates into a town, cluster, company, or shipment observation.
 */
export function chinaFactoryClusterSourceEvidence(
  cluster: ChinaFactoryCluster,
  retrievedAt: string,
): SourceEvidence {
  const publishedAt = cluster.source.publishedAt;
  return {
    sourceId: createStableEntityId('source', `china-factory-${cluster.id}`),
    providerId: 'worldmonitor-reviewed-china-factory-registry',
    sourceType: 'official-registry-reference',
    sourceTitle: cluster.source.title,
    sourceUrl: cluster.source.url,
    sourceReference: null,
    sourcePublishedAt: publishedAt,
    observedAt: null,
    retrievedAt,
    validFrom: publishedAt,
    validTo: null,
    periodStart: null,
    periodEnd: null,
    evidenceClass: mapChinaFactoryEvidenceClass(cluster.clusterEvidence),
    aggregationLevel: 'CLUSTER',
    licenseStatus: 'REVIEW_REQUIRED',
    freshnessStatus: 'NOT_APPLICABLE',
    qualityStatus: cluster.clusterEvidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'VERIFIED',
    confidence: cluster.clusterEvidence === 'UNVERIFIED' ? null : 1,
    methodologyVersion: 'china-factory-registry/v1',
    nullReasons: {
      sourceReference: notApplicable('An absolute reviewed source URL is present.'),
      ...(publishedAt === null ? {
        sourcePublishedAt: unknown('The reviewed source does not publish a source date.'),
        validFrom: unknown('Validity cannot start before an unknown publication date.'),
      } : {}),
      observedAt: notApplicable('This evidence is a registry statement, not a live observation.'),
      validTo: unknown('The publisher has not supplied an end-of-validity date.'),
      periodStart: notApplicable('A registry statement has no measurement period.'),
      periodEnd: notApplicable('A registry statement has no measurement period.'),
      ...(cluster.clusterEvidence === 'UNVERIFIED' ? {
        confidence: unknown('Unverified legacy evidence has no defensible confidence score.'),
      } : {}),
    },
  };
}
