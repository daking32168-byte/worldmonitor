import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GLOBAL_INTELLIGENCE_IMPORT_HEADERS,
  type GlobalIntelligenceImportManifest,
  type GlobalIntelligenceImportSubmission,
} from '../shared/global-intelligence-import.ts';
import { createStableEntityId } from '../shared/global-intelligence-contract.ts';
import {
  createGlobalIntelligenceLocalRepository,
  type GlobalIntelligenceRepositoryAdapter,
} from '../src/services/global-intelligence-local-repository.ts';
import { tradeLogisticsRegistryFromSnapshot } from '../src/services/trade-logistics-repository.ts';
import { tradeFlowAvailability } from '../shared/trade-logistics.ts';

function csv(headers: readonly string[], values: readonly string[]): string {
  assert.equal(headers.length, values.length);
  return `${headers.join(',')}\n${values.join(',')}\n`;
}

function manifest(sourceOpaqueId: string, overrides: Partial<GlobalIntelligenceImportManifest> = {}): GlobalIntelligenceImportManifest {
  return {
    sourceId: createStableEntityId('source', sourceOpaqueId),
    providerId: 'operator-local-import',
    publisher: 'Licensed local fixture publisher',
    sourceTitle: 'Isolated licensed import fixture',
    sourceUrl: 'https://example.test/licensed-fixture',
    sourceReference: 'test release 2026-08-15',
    sourcePublishedAt: '2026-08-15T00:00:00Z',
    licenseStatus: 'VERIFIED',
    licenseReference: 'fixture grants LOCAL_ANALYSIS, DISPLAY and EXPORT',
    permittedUses: ['LOCAL_ANALYSIS', 'DISPLAY', 'EXPORT'],
    evidenceClass: 'OFFICIAL_REGISTRY',
    aggregationLevel: 'COUNTRY',
    qualityStatus: 'VERIFIED',
    ...overrides,
  };
}

function memoryAdapter(): GlobalIntelligenceRepositoryAdapter {
  const values = new Map<string, unknown>();
  return {
    async read<T>(key: string): Promise<T | null> { return (values.get(key) as T | undefined) ?? null; },
    async write<T>(key: string, value: T): Promise<void> { values.set(key, structuredClone(value)); },
  };
}

function geoSubmission(country: 'cn' | 'us'): GlobalIntelligenceImportSubmission {
  const upper = country.toUpperCase();
  const sourceId = createStableEntityId('source', `trade-geo-${country}`);
  return {
    dataset: 'geo_units',
    fileName: `geo-${country}.csv`,
    csvText: csv(GLOBAL_INTELLIGENCE_IMPORT_HEADERS.geo_units, [
      `geo_country-${country}`, '', 'COUNTRY', upper, country === 'cn' ? 'CHN' : 'USA', '',
      upper, upper, upper, '', '', '', '', 'SOURCE_REQUIRED', country === 'cn' ? 'Asia/Shanghai' : 'America/New_York', sourceId,
    ]),
    manifest: manifest(`trade-geo-${country}`),
  };
}

function productSubmission(): GlobalIntelligenceImportSubmission {
  return {
    dataset: 'product_taxonomy',
    fileName: 'trade-product.csv',
    csvText: csv(GLOBAL_INTELLIGENCE_IMPORT_HEADERS.product_taxonomy, [
      'product_hs-64-footwear', '', 'industry_footwear', 'Footwear', '鞋类', 'Footwear', 'HS64', '', '',
    ]),
    manifest: manifest('trade-product'),
  };
}

function tradeSubmission(overrides: Partial<GlobalIntelligenceImportManifest> = {}, value = '1250'): GlobalIntelligenceImportSubmission {
  const sourceId = createStableEntityId('source', 'trade-flow-country-cn-us-2025');
  return {
    dataset: 'trade_flows',
    fileName: 'trade-flows.csv',
    csvText: csv(GLOBAL_INTELLIGENCE_IMPORT_HEADERS.trade_flows, [
      'flow_local-cn-us-64-2025', 'geo_country-cn', 'geo_country-cn', 'COUNTRY', 'geo_country-us',
      'product_hs-64-footwear', 'HS2022', '64', '2025-01-01T00:00:00Z', '2025-12-31T23:59:59Z',
      'EXPORT', value, 'USD', '10', 'pairs', '8', 'SEA', '', sourceId,
    ]),
    manifest: manifest('trade-flow-country-cn-us-2025', {
      evidenceClass: 'OBSERVED_TRADE',
      aggregationLevel: 'COUNTRY',
      ...overrides,
    }),
  };
}

describe('lawful local trade-flow import and rendering repository', () => {
  it('dry-runs, persists, verifies and renders a licensed positive path without a Provider', async () => {
    const repository = createGlobalIntelligenceLocalRepository(memoryAdapter());
    assert.equal((await repository.import(geoSubmission('cn'))).status, 'COMMITTED');
    assert.equal((await repository.import(geoSubmission('us'))).status, 'COMMITTED');
    assert.equal((await repository.import(productSubmission())).status, 'COMMITTED');
    const dryRun = await repository.dryRun(tradeSubmission());
    assert.equal(dryRun.status, 'READY');
    assert.equal(dryRun.plan.inserts[0]?.values.provider_id, 'operator-local-import');
    const committed = await repository.import(tradeSubmission());
    assert.equal(committed.status, 'COMMITTED');
    const registry = tradeLogisticsRegistryFromSnapshot(await repository.load());
    assert.deepEqual(tradeFlowAvailability(registry), {
      status: 'OBSERVED', observedFlowCount: 1, shipmentCount: 0, observedRouteCount: 0, modelledRouteCount: 0,
    });
    assert.equal(registry.flows[0]?.origin_aggregation_level, 'COUNTRY');
    assert.equal(registry.flows[0]?.value, 1250);
    assert.equal(registry.evidence[0]?.licenseStatus, 'VERIFIED');
  });

  it('rejects wrong evidence classes, aggregation drift and negative amounts before commit', async () => {
    const repository = createGlobalIntelligenceLocalRepository(memoryAdapter());
    assert.equal((await repository.import(geoSubmission('cn'))).status, 'COMMITTED');
    assert.equal((await repository.import(geoSubmission('us'))).status, 'COMMITTED');
    assert.equal((await repository.import(productSubmission())).status, 'COMMITTED');
    const wrongClass = await repository.dryRun(tradeSubmission({ evidenceClass: 'OFFICIAL_REGISTRY' }));
    assert.equal(wrongClass.status, 'INVALID');
    assert.ok(wrongClass.plan.issues.some((item) => item.code === 'EVIDENCE_CLASS'));
    const drift = await repository.dryRun(tradeSubmission({ aggregationLevel: 'STATE_PROVINCE' }));
    assert.equal(drift.status, 'INVALID');
    assert.ok(drift.plan.issues.some((item) => item.code === 'AGGREGATION_MISMATCH'));
    const negative = await repository.dryRun(tradeSubmission({}, '-1'));
    assert.equal(negative.status, 'INVALID');
    assert.ok(negative.plan.issues.some((item) => item.code === 'RANGE'));
  });
});
