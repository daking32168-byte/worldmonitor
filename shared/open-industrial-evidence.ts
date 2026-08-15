/**
 * Phase 15–18 independently captured open-data evidence.
 *
 * These records are deliberately small and immutable. They describe the exact
 * public snapshots reviewed during the independent audit; they do not turn a
 * web page, search result, or brand name into a company/facility relationship.
 */

import {
  assertSourceEvidence,
  createStableEntityId,
  type EvidenceNullReasonCode,
  type SourceEvidence,
} from './global-intelligence-contract';

function explainedNull(code: EvidenceNullReasonCode, explanation: string) {
  return { code, explanation } as const;
}

export const GLEIF_TESLA_SOURCE_ID = createStableEntityId('source', 'gleif-lei-54930043xzgb27ctov49');
export const WIKIDATA_GIGA_BERLIN_SOURCE_ID = createStableEntityId('source', 'wikidata-q75327597-rev2513149012');

export const GLEIF_TESLA_EVIDENCE: SourceEvidence = Object.freeze({
  sourceId: GLEIF_TESLA_SOURCE_ID,
  providerId: 'gleif-open-data',
  sourceType: 'OPEN_DATA_API_SNAPSHOT',
  sourceTitle: 'GLEIF LEI record 54930043XZGB27CTOV49 — TESLA, INC.',
  sourceUrl: 'https://api.gleif.org/api/v1/lei-records/54930043XZGB27CTOV49',
  sourceReference: 'sha256:C9288786CF556B96AF7CB8A3970385D8D86B60918F88E7204A7075368CC7A1BD; JSON paths: data.id, data.attributes.entity.legalName, .jurisdiction, .registeredAs, .status, data.attributes.registration.corroborationLevel',
  sourcePublishedAt: '2026-08-15T00:00:00Z',
  observedAt: null,
  retrievedAt: '2026-08-15T11:05:11.799Z',
  validFrom: null,
  validTo: null,
  periodStart: null,
  periodEnd: null,
  evidenceClass: 'OFFICIAL_REGISTRY',
  aggregationLevel: 'COMPANY',
  licenseStatus: 'VERIFIED',
  freshnessStatus: 'CURRENT',
  qualityStatus: 'VERIFIED',
  confidence: null,
  methodologyVersion: 'open-industrial-snapshot/v1',
  nullReasons: {
    observedAt: explainedNull('NOT_APPLICABLE', 'This is a legal-entity registry snapshot, not a live market observation.'),
    validFrom: explainedNull('NOT_PROVIDED', 'The record does not state when the legal identity first became valid.'),
    validTo: explainedNull('NOT_PROVIDED', 'The active record does not state a validity end.'),
    periodStart: explainedNull('NOT_APPLICABLE', 'No numeric observation period is asserted.'),
    periodEnd: explainedNull('NOT_APPLICABLE', 'No numeric observation period is asserted.'),
    confidence: explainedNull('NOT_APPLICABLE', 'An official registry fact is not assigned a model confidence.'),
  },
});

export const WIKIDATA_GIGA_BERLIN_EVIDENCE: SourceEvidence = Object.freeze({
  sourceId: WIKIDATA_GIGA_BERLIN_SOURCE_ID,
  providerId: 'wikimedia-wikidata-open-data',
  sourceType: 'CC0_STRUCTURED_ENTITY_SNAPSHOT',
  sourceTitle: 'Wikidata Q75327597 — Gigafactory Berlin-Brandenburg',
  sourceUrl: 'https://www.wikidata.org/wiki/Special:EntityData/Q75327597.json',
  sourceReference: 'revision:2513149012; browser-independent Wikimedia API receipt sha256:76C700C02E63AE161077329A83A995A90D8636CD6F6802FEE07CFD4F5AAF2D45; reviewed statements P127, P625, P131 and P1056; corroborated 2026-08-15 against https://www.tesla.com/en_gb/giga-berlin and https://www.tesla.com/contact',
  sourcePublishedAt: '2026-07-02T15:17:39Z',
  observedAt: null,
  retrievedAt: '2026-08-15T11:15:25.569Z',
  validFrom: null,
  validTo: null,
  periodStart: null,
  periodEnd: null,
  evidenceClass: 'VERIFIED_FACILITY',
  aggregationLevel: 'FACILITY',
  licenseStatus: 'VERIFIED',
  freshnessStatus: 'CURRENT',
  qualityStatus: 'CORROBORATED',
  confidence: null,
  methodologyVersion: 'open-industrial-cross-source-review/v1',
  nullReasons: {
    observedAt: explainedNull('NOT_APPLICABLE', 'This is a reviewed entity statement, not a live observation.'),
    validFrom: explainedNull('NOT_PROVIDED', 'The reviewed sources do not attach one validity start to every statement.'),
    validTo: explainedNull('NOT_PROVIDED', 'The reviewed sources do not attach one validity end to every statement.'),
    periodStart: explainedNull('NOT_APPLICABLE', 'No numeric observation period is asserted.'),
    periodEnd: explainedNull('NOT_APPLICABLE', 'No numeric observation period is asserted.'),
    confidence: explainedNull('NOT_APPLICABLE', 'Cross-source fact review is not a probabilistic model output.'),
  },
});

export const OPEN_INDUSTRIAL_SOURCE_EVIDENCE: readonly SourceEvidence[] = Object.freeze([
  GLEIF_TESLA_EVIDENCE,
  WIKIDATA_GIGA_BERLIN_EVIDENCE,
]);

for (const evidence of OPEN_INDUSTRIAL_SOURCE_EVIDENCE) assertSourceEvidence(evidence);
