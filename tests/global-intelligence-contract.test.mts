import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AGGREGATION_LEVELS,
  DATA_DISPLAY_STATUSES,
  EVIDENCE_CLASSES,
  GLOBAL_INTELLIGENCE_CONTRACT_VERSION,
  assertAggregationCompatible,
  assertEvidenceCanEnterFactTable,
  assertGlobalIntelligenceResponse,
  assertSourceEvidence,
  assertStableEntityAlias,
  createStableEntityId,
  isAggregationCompatible,
  isStableEntityId,
  validateEvidenceConflict,
  validateGlobalIntelligenceResponse,
  validateSourceEvidence,
  type EvidenceConflict,
  type ExplainedNull,
  type GlobalIntelligenceResponse,
  type SourceEvidence,
} from '../shared/global-intelligence-contract.ts';
import {
  LEGACY_MARKET_PROVIDER_STATUSES,
  chinaFactoryClusterSourceEvidence,
  chinaFactoryStableAlias,
  mapChinaFactoryEvidenceClass,
  mapLegacyMaritimeSnapshotState,
  mapLegacyMarketProviderStatus,
} from '../shared/global-intelligence-compatibility.ts';
import { CHINA_FACTORY_REVIEWED_CLUSTERS } from '../shared/china-factory-clusters.ts';
import {
  GLOBAL_INTELLIGENCE_STATUS_DISPLAY,
  assertCompleteGlobalIntelligenceStatusDisplay,
  globalIntelligenceStatusDisplay,
} from '../src/services/global-intelligence-status.ts';
import {
  PROVIDER_OPERATIONS,
  PROVIDER_OPERATION_TRUTH,
  providerOperationDataStatus,
  type ProviderOperationTelemetry,
} from '../src/services/provider-operations.ts';

const nullReason = (code: ExplainedNull['code'], explanation: string): ExplainedNull => ({ code, explanation });

function evidence(overrides: Partial<SourceEvidence> = {}): SourceEvidence {
  return {
    sourceId: createStableEntityId('source', 'test-observation-1'),
    providerId: 'test-provider',
    sourceType: 'official-dataset',
    sourceTitle: 'Test observation source',
    sourceUrl: 'https://example.test/observation/1',
    sourceReference: null,
    sourcePublishedAt: '2026-08-14T12:00:00Z',
    observedAt: '2026-08-14T11:55:00Z',
    retrievedAt: '2026-08-14T12:05:00Z',
    validFrom: '2026-08-14T11:55:00Z',
    validTo: null,
    periodStart: null,
    periodEnd: null,
    evidenceClass: 'OFFICIAL_REGISTRY',
    aggregationLevel: 'COUNTRY',
    licenseStatus: 'VERIFIED',
    freshnessStatus: 'CURRENT',
    qualityStatus: 'VERIFIED',
    confidence: 0.95,
    methodologyVersion: 'test-method/v1',
    nullReasons: {
      sourceReference: nullReason('NOT_APPLICABLE', 'The canonical source URL is present.'),
      validTo: nullReason('UNKNOWN', 'The publisher has not supplied an end date.'),
      periodStart: nullReason('NOT_APPLICABLE', 'This registry statement has no measurement period.'),
      periodEnd: nullReason('NOT_APPLICABLE', 'This registry statement has no measurement period.'),
    },
    ...overrides,
  };
}

function response(overrides: Partial<GlobalIntelligenceResponse<{ value: number }>> = {}): GlobalIntelligenceResponse<{ value: number }> {
  return {
    contractVersion: GLOBAL_INTELLIGENCE_CONTRACT_VERSION,
    status: 'OBSERVED',
    data: { value: 7 },
    evidence: [evidence()],
    conflicts: [],
    nullReason: null,
    generatedAt: '2026-08-14T12:06:00Z',
    provider: {
      providerId: 'test-provider',
      configured: true,
      coverageStatus: 'PARTIAL',
      licenseStatus: 'VERIFIED',
      lastVerifiedAt: '2026-08-14T12:05:00Z',
      lastVerifiedAtNullReason: null,
    },
    ...overrides,
  };
}

describe('Phase 14 Global Intelligence shared truth contract', () => {
  it('locks the complete evidence, aggregation, and UI status vocabularies', () => {
    assert.equal(EVIDENCE_CLASSES.length, 18);
    assert.equal(AGGREGATION_LEVELS.length, 13);
    assert.deepEqual(DATA_DISPLAY_STATUSES, [
      'NOT_CONFIGURED',
      'UNAVAILABLE',
      'DELAYED_UNVERIFIED',
      'STALE',
      'OBSERVED',
      'REALTIME_VERIFIED',
      'MODELLED_ESTIMATE',
      'AI_SPECULATION',
      'SOURCE_REQUIRED',
    ]);
  });

  it('requires opaque prefixed stable IDs while preserving legacy IDs as aliases', () => {
    const id = createStableEntityId('company', '01j5abc123');
    assert.equal(id, 'company_01j5abc123');
    assert.equal(isStableEntityId(id), true);
    assert.equal(isStableEntityId('Acme Corp'), false);
    assert.throws(() => createStableEntityId('company', 'ACME Corp'), /Invalid stable entity ID/);

    const cluster = CHINA_FACTORY_REVIEWED_CLUSTERS[0]!;
    const alias = chinaFactoryStableAlias(cluster);
    assertStableEntityAlias(alias);
    assert.equal(alias.externalId, cluster.id);
    assert.match(alias.entityId, /^cluster_/);
  });

  it('rejects implicit nulls, blank sentinel values, and untraceable evidence', () => {
    assert.doesNotThrow(() => assertSourceEvidence(evidence()));
    const missingReason = evidence({
      observedAt: null,
      nullReasons: evidence().nullReasons,
    });
    assert.ok(validateSourceEvidence(missingReason).some((error) => /observedAt.*no explicit null reason/.test(error)));
    assert.ok(validateSourceEvidence(evidence({ sourceTitle: '' })).some((error) => /sourceTitle/.test(error)));
    const untraceable = evidence({
      sourceUrl: null,
      sourceReference: null,
      nullReasons: {
        ...evidence().nullReasons,
        sourceUrl: nullReason('UNKNOWN', 'No public URL.'),
      },
    });
    assert.ok(validateSourceEvidence(untraceable).includes('sourceUrl or sourceReference is required'));
  });

  it('prevents country evidence from entering town results while permitting equal or finer geographic context', () => {
    assert.equal(isAggregationCompatible('COUNTRY', 'TOWN'), false);
    assert.equal(isAggregationCompatible('TOWN', 'COUNTRY'), true);
    assert.equal(isAggregationCompatible('FACILITY', 'COMPANY'), true);
    assert.throws(() => assertAggregationCompatible('COUNTRY', 'TOWN'), /Aggregation mismatch/);
  });

  it('keeps model, social, AI, and unverified records out of fact tables', () => {
    assert.doesNotThrow(() => assertEvidenceCanEnterFactTable(evidence()));
    for (const evidenceClass of ['MODELLED_FLOW', 'AI_SPECULATION', 'SOCIAL_SIGNAL', 'UNVERIFIED'] as const) {
      assert.throws(
        () => assertEvidenceCanEnterFactTable(evidence({ evidenceClass })),
        /cannot enter a fact table/,
      );
    }
  });

  it('retains all conflict candidates and requires an explicit preferred-value rule', () => {
    const first = createStableEntityId('source', 'conflict-a');
    const second = createStableEntityId('source', 'conflict-b');
    const conflict: EvidenceConflict<number> = {
      conflictId: 'cluster-output-2026',
      status: 'RESOLVED_WITH_RULE',
      candidates: [{ value: 12, evidenceId: first }, { value: 19, evidenceId: second }],
      preferredEvidenceId: second,
      selectionRule: 'Prefer the later official revision while retaining the original publication.',
    };
    assert.deepEqual(validateEvidenceConflict(conflict), []);
    assert.ok(validateEvidenceConflict({ ...conflict, selectionRule: null }).some((error) => /selection rule/.test(error)));
    assert.ok(validateEvidenceConflict({ ...conflict, candidates: [conflict.candidates[0]!] }).some((error) => /at least two/.test(error)));
  });

  it('fails closed instead of returning empty success and verifies realtime licensing', () => {
    assert.doesNotThrow(() => assertGlobalIntelligenceResponse(response()));
    const emptyObserved = response({
      data: null,
      nullReason: nullReason('NOT_YET_OBSERVED', 'The Provider returned no qualified observation.'),
    });
    assert.ok(validateGlobalIntelligenceResponse(emptyObserved).some((error) => /empty success/.test(error)));

    const notConfigured = response({
      status: 'NOT_CONFIGURED',
      data: null,
      evidence: [],
      nullReason: nullReason('NOT_PROVIDED', 'No Provider configuration is present.'),
      provider: {
        providerId: 'test-provider',
        configured: false,
        coverageStatus: 'UNKNOWN',
        licenseStatus: 'NOT_CONFIGURED',
        lastVerifiedAt: null,
        lastVerifiedAtNullReason: nullReason('NOT_PROVIDED', 'No Provider has been configured.'),
      },
    });
    assert.deepEqual(validateGlobalIntelligenceResponse(notConfigured), []);

    const unlicensedRealtime = response({ status: 'REALTIME_VERIFIED' });
    assert.ok(validateGlobalIntelligenceResponse(unlicensedRealtime).some((error) => /realtime, license-verified evidence/.test(error)));
  });

  it('maps legacy Market, Maritime, and China Factory states without changing their APIs', () => {
    assert.equal(new Set(LEGACY_MARKET_PROVIDER_STATUSES).size, 11);
    assert.equal(mapLegacyMarketProviderStatus('PROVIDER_STATUS_REALTIME_LICENSED'), 'REALTIME_VERIFIED');
    assert.equal(mapLegacyMarketProviderStatus('PROVIDER_STATUS_MARKET_CLOSED'), 'OBSERVED');
    assert.equal(mapLegacyMaritimeSnapshotState({ configured: false, connected: false, observationCount: 0 }), 'NOT_CONFIGURED');
    assert.equal(mapLegacyMaritimeSnapshotState({ configured: true, connected: true, observationCount: 0 }), 'SOURCE_REQUIRED');
    assert.equal(mapLegacyMaritimeSnapshotState({ configured: true, connected: true, observationCount: 3 }), 'OBSERVED');
    assert.equal(mapChinaFactoryEvidenceClass('OBSERVED_OFFICIAL'), 'OFFICIAL_CLUSTER');
    assert.equal(mapChinaFactoryEvidenceClass('MODELLED_ESTIMATE'), 'MODELLED_FLOW');

    const adapted = chinaFactoryClusterSourceEvidence(
      CHINA_FACTORY_REVIEWED_CLUSTERS[0]!,
      '2026-08-15T00:00:00Z',
    );
    assert.doesNotThrow(() => assertSourceEvidence(adapted));
    assert.equal(adapted.aggregationLevel, 'CLUSTER');
    assert.equal(adapted.licenseStatus, 'REVIEW_REQUIRED');
  });

  it('has exactly one complete UI display mapping and extends every Provider operation truth profile', () => {
    assert.doesNotThrow(assertCompleteGlobalIntelligenceStatusDisplay);
    assert.deepEqual(Object.keys(GLOBAL_INTELLIGENCE_STATUS_DISPLAY).sort(), [...DATA_DISPLAY_STATUSES].sort());
    assert.equal(globalIntelligenceStatusDisplay('AI_SPECULATION').isObservedFact, false);
    assert.equal(globalIntelligenceStatusDisplay('REALTIME_VERIFIED').isLive, true);

    assert.equal(Object.keys(PROVIDER_OPERATION_TRUTH).length, PROVIDER_OPERATIONS.length);
    for (const operation of PROVIDER_OPERATIONS) {
      const truth = PROVIDER_OPERATION_TRUTH[operation.id];
      assert.ok(truth.licenseNote.length > 20);
      assert.ok(truth.evidenceClasses.length > 0);
      assert.ok(truth.aggregationLevels.length > 0);
    }
  });

  it('keeps Provider execution readiness separate from evidence-bearing data status', () => {
    const operation = PROVIDER_OPERATIONS.find((item) => item.id === 'market-rest-gap-repair')!;
    const idle: ProviderOperationTelemetry = { consecutiveFailures: 0, lastOutcome: 'IDLE' };
    assert.equal(providerOperationDataStatus(operation, 'NOT_CONFIGURED', idle), 'NOT_CONFIGURED');
    assert.equal(providerOperationDataStatus(operation, 'CONFIG_INVALID', idle), 'UNAVAILABLE');
    assert.equal(providerOperationDataStatus(operation, 'READY_TO_ATTEMPT', idle), 'SOURCE_REQUIRED');
    assert.equal(
      providerOperationDataStatus(operation, 'READY_TO_ATTEMPT', {
        consecutiveFailures: 0,
        lastOutcome: 'SUCCESS',
        lastExecutorSuccessAt: 1_700_000_000_000,
      }),
      'DELAYED_UNVERIFIED',
      'execution success cannot upgrade unverified license rights to observed/live',
    );
  });
});
