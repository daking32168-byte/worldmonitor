import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createStableEntityId, type SourceEvidence } from '../shared/global-intelligence-contract.ts';
import {
  adaptComtradeObservation,
  assertLawfulCustomsImport,
  assertShipmentObservation,
  canDisplayFlowAsActualAt,
  exportTradeFlowsCsv,
  tradeFlowAvailability,
  TRADE_LOGISTICS_REGISTRY,
  TRANSPORT_MODES,
  type ShipmentObservation,
  type ShipmentProviderContract,
} from '../shared/trade-logistics.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function evidence(evidenceClass: SourceEvidence['evidenceClass'], aggregationLevel: SourceEvidence['aggregationLevel']): SourceEvidence {
  return {
    sourceId: createStableEntityId('source', `phase17-${evidenceClass.toLowerCase().replaceAll('_', '-')}`),
    providerId: evidenceClass === 'AIS_OBSERVATION' ? 'ais-test' : 'licensed-test-provider',
    sourceType: 'TEST_FIXTURE',
    sourceTitle: 'Synthetic contract test evidence',
    sourceUrl: 'https://example.invalid/contract-fixture',
    sourceReference: 'fixture-only',
    sourcePublishedAt: '2025-01-02T00:00:00Z',
    observedAt: '2025-01-02T00:00:00Z',
    retrievedAt: '2025-01-03T00:00:00Z',
    validFrom: '2025-01-01T00:00:00Z',
    validTo: '2025-12-31T23:59:59Z',
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-01-31T23:59:59Z',
    evidenceClass,
    aggregationLevel,
    licenseStatus: 'VERIFIED',
    freshnessStatus: 'CURRENT',
    qualityStatus: 'VERIFIED',
    confidence: 1,
    methodologyVersion: 'fixture-v1',
    nullReasons: {},
  };
}

describe('Phase 17 trade and logistics truth boundary', () => {
  it('keeps the production registry empty and reports an explicit disabled state', () => {
    assert.deepEqual(tradeFlowAvailability(), {
      status: 'NOT_CONFIGURED',
      observedFlowCount: 0,
      shipmentCount: 0,
      observedRouteCount: 0,
      modelledRouteCount: 0,
    });
    assert.equal(Object.isFrozen(TRADE_LOGISTICS_REGISTRY), true);
    assert.deepEqual(TRANSPORT_MODES, ['SEA', 'AIR', 'RAIL', 'ROAD', 'MULTIMODAL']);
  });

  it('adapts Comtrade only as a country-level aggregate and preserves export truth fields', () => {
    const source = evidence('OBSERVED_TRADE', 'COUNTRY');
    const flow = adaptComtradeObservation({
      providerRecordId: 'cn-us-64-2025',
      reporterGeoId: createStableEntityId('geo', 'country-cn'),
      partnerGeoId: createStableEntityId('geo', 'country-us'),
      productId: createStableEntityId('product', 'hs-64-footwear'),
      hsVersion: 'HS2022',
      hsCode: '64',
      periodStart: '2025-01-01T00:00:00Z',
      periodEnd: '2025-12-31T23:59:59Z',
      tradeDirection: 'EXPORT',
      value: 1250,
      valueCurrency: 'USD',
      quantity: 10,
      quantityUnit: 'pairs',
      netWeightKg: 20,
      transportMode: null,
    }, source);
    assert.equal(flow.origin_aggregation_level, 'COUNTRY');
    assert.equal(canDisplayFlowAsActualAt(flow, createStableEntityId('geo', 'country-cn'), 'COUNTRY'), true);
    assert.equal(canDisplayFlowAsActualAt(flow, createStableEntityId('geo', 'huidong-county'), 'COUNTY_DISTRICT'), false);
    const csv = exportTradeFlowsCsv([flow]);
    for (const header of ['period_start', 'period_end', 'quantity_unit', 'provider_id', 'evidence_id', 'origin_aggregation_level']) {
      assert.match(csv, new RegExp(header));
    }
    assert.match(csv, /COUNTRY/);
    assert.match(csv, /licensed-test-provider/);
  });

  it('rejects down-scoped Comtrade evidence', () => {
    assert.throws(() => adaptComtradeObservation({
      providerRecordId: 'bad-town-flow',
      reporterGeoId: createStableEntityId('geo', 'huidong-county'),
      partnerGeoId: createStableEntityId('geo', 'country-us'),
      productId: createStableEntityId('product', 'hs-64-footwear'),
      hsVersion: 'HS2022',
      hsCode: '64',
      periodStart: '2025-01-01T00:00:00Z',
      periodEnd: '2025-12-31T23:59:59Z',
      tradeDirection: 'EXPORT',
      value: null,
      valueCurrency: null,
      quantity: null,
      quantityUnit: null,
      netWeightKg: null,
    }, evidence('OBSERVED_TRADE', 'TOWN')), /COUNTRY aggregation/);
  });

  it('requires a lawful customs manifest and a local-analysis use right', () => {
    assert.doesNotThrow(() => assertLawfulCustomsImport({
      file_sha256: 'ab'.repeat(32),
      publisher: 'Fixture publisher',
      publication_date: '2025-02-01T00:00:00Z',
      aggregation_level: 'CITY',
      license_status: 'RESTRICTED',
      permitted_uses: ['LOCAL_ANALYSIS'],
      source_reference: 'fixture-only',
    }));
    assert.throws(() => assertLawfulCustomsImport({
      file_sha256: 'ab'.repeat(32),
      publisher: 'Fixture publisher',
      publication_date: '2025-02-01T00:00:00Z',
      aggregation_level: 'CITY',
      license_status: 'RESTRICTED',
      permitted_uses: ['DISPLAY'],
      source_reference: 'fixture-only',
    }), /not licensed for local analysis/);
  });

  it('never allows AIS to populate cargo, buyer, factory or bill-of-lading fields', () => {
    const shipment: ShipmentObservation = {
      shipment_id: createStableEntityId('shipment', 'fixture-001'),
      provider_shipment_id: 'fixture-001',
      shipper_company_id: null,
      consignee_company_id: null,
      origin_facility_id: null,
      origin_node_id: createStableEntityId('node', 'fixture-origin'),
      destination_node_id: createStableEntityId('node', 'fixture-destination'),
      product_description: 'fixture cargo',
      hs_code: '64',
      container_count: 1,
      weight: 100,
      weight_unit: 'kg',
      vessel_imo: 'IMO1234567',
      bill_of_lading_ref: 'fixture-bol',
      observed_at: '2025-02-02T00:00:00Z',
      license_scope: 'fixture-only',
      provider_id: 'ais-test',
      evidence_id: evidence('AIS_OBSERVATION', 'ROUTE').sourceId,
    };
    const contract: ShipmentProviderContract = {
      provider_id: 'ais-test',
      enabled: true,
      license_status: 'VERIFIED',
      permitted_fields: Object.keys(shipment) as (keyof ShipmentObservation)[],
      permits_display: true,
      permits_export: false,
    };
    assert.throws(() => assertShipmentObservation(shipment, contract, evidence('AIS_OBSERVATION', 'ROUTE')), /AIS evidence cannot/);
  });

  it('owns /trade-flows, renders distinct legends and keeps fixtures/templates out of the production graph', () => {
    const main = read('src/main.ts');
    const ui = read('src/features/trade-flows/trade-flows.ts');
    assert.match(main, /isTradeFlowsPath/);
    assert.match(main, /initTradeFlowsWorkspace/);
    assert.match(ui, /实际观测/);
    assert.match(ui, /企业披露/);
    assert.match(ui, /模型路线/);
    assert.match(ui, /Provider 未配置/);
    assert.doesNotMatch(main, /trade-flows\.import-template\.csv/);
  });

  it('extends Provider Operations with a disabled shipment contract', () => {
    const operations = read('src/services/provider-operations.ts');
    assert.match(operations, /shipment-provider-import/);
    assert.match(operations, /CONTRACTED_SHIPMENT/);
    assert.match(operations, /licenseStatus: 'NOT_CONFIGURED'/);
    assert.match(operations, /不得由 AIS/);
  });
});
