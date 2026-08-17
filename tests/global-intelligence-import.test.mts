import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GLOBAL_INTELLIGENCE_IMPORT_HEADERS,
  commitGlobalIntelligenceImport,
  createEmptyGlobalIntelligenceSnapshot,
  planGlobalIntelligenceImport,
  type GlobalIntelligenceImportManifest,
  type GlobalIntelligenceImportSubmission,
} from '../shared/global-intelligence-import.ts';
import { createStableEntityId } from '../shared/global-intelligence-contract.ts';
import {
  createGlobalIntelligenceLocalRepository,
  type GlobalIntelligenceRepositoryAdapter,
} from '../src/services/global-intelligence-local-repository.ts';

const SOURCE_ID = createStableEntityId('source', 'cc0-industry-import-20260815');

function manifest(overrides: Partial<GlobalIntelligenceImportManifest> = {}): GlobalIntelligenceImportManifest {
  return {
    sourceId: SOURCE_ID,
    providerId: 'operator-local-import',
    publisher: 'Fixture Open Data Publisher',
    sourceTitle: 'Fixture reviewed master data',
    sourceUrl: 'https://example.test/open-data',
    sourceReference: 'fixture dataset release 2026-08-15',
    sourcePublishedAt: '2026-08-15T00:00:00Z',
    licenseStatus: 'VERIFIED',
    licenseReference: 'CC0-1.0 fixture declaration',
    permittedUses: ['LOCAL_ANALYSIS', 'DISPLAY', 'EXPORT'],
    evidenceClass: 'OFFICIAL_REGISTRY',
    aggregationLevel: 'COUNTY_DISTRICT',
    qualityStatus: 'VERIFIED',
    ...overrides,
  };
}

function csv(headers: readonly string[], values: readonly string[]): string {
  assert.equal(headers.length, values.length);
  return `${headers.join(',')}\n${values.join(',')}\n`;
}

function geoSubmission(overrides: Partial<GlobalIntelligenceImportSubmission> = {}): GlobalIntelligenceImportSubmission {
  return {
    dataset: 'geo_units',
    fileName: 'geo_units.csv',
    csvText: csv(GLOBAL_INTELLIGENCE_IMPORT_HEADERS.geo_units, [
      'geo_cn-gd-huidong', '', 'COUNTY_DISTRICT', 'CN', 'CHN', 'CN-GD',
      '惠东县', '惠东县', 'Huidong County', '惠东|Huidong', '22.98', '114.72',
      'wikidata:Q1378348', 'REVIEWED', 'Asia/Shanghai', SOURCE_ID,
    ]),
    manifest: manifest(),
    ...overrides,
  };
}

function memoryAdapter() {
  const values = new Map<string, unknown>();
  const adapter: GlobalIntelligenceRepositoryAdapter = {
    async read<T>(key: string): Promise<T | null> {
      return (values.get(key) as T | undefined) ?? null;
    },
    async write<T>(key: string, value: T): Promise<void> {
      values.set(key, structuredClone(value));
    },
  };
  return { adapter, values };
}

describe('Global Intelligence local import pipeline', () => {
  it('performs a non-mutating dry run with schema normalization and SHA-256 evidence', async () => {
    const memory = memoryAdapter();
    const repository = createGlobalIntelligenceLocalRepository(memory.adapter);
    const result = await repository.dryRun(geoSubmission());
    assert.equal(result.status, 'READY');
    assert.match(result.plan.fileSha256, /^[a-f0-9]{64}$/);
    assert.equal(result.plan.inserts.length, 1);
    assert.equal(result.plan.inserts[0]?.values.centroid_lat, 22.98);
    assert.deepEqual(result.plan.inserts[0]?.values.alternate_names, ['惠东', 'Huidong']);
    assert.equal(result.plan.sourceEvidence?.evidence.retrievedAt, result.plan.processedAt);
    assert.equal(memory.values.size, 0);
  });

  it('commits atomically, remains idempotent, and rolls back to the exact prior revision', async () => {
    const memory = memoryAdapter();
    const repository = createGlobalIntelligenceLocalRepository(memory.adapter);
    const first = await repository.import(geoSubmission());
    assert.equal(first.status, 'COMMITTED');
    assert.equal(first.snapshot.revision, 1);
    assert.ok(first.snapshot.records.geo_units['geo_cn-gd-huidong']);
    assert.equal(first.snapshot.history.length, 1);

    const repeated = await repository.import(geoSubmission());
    assert.equal(repeated.status, 'NO_CHANGE');
    assert.equal(repeated.snapshot.revision, 1);
    assert.equal(repeated.snapshot.history.length, 1);

    const rollback = await repository.rollback();
    assert.equal(rollback.status, 'ROLLED_BACK');
    assert.equal(rollback.rolledBackRevision, 1);
    assert.equal(rollback.snapshot.revision, 0);
    assert.deepEqual(rollback.snapshot.records.geo_units, {});
    assert.equal((await repository.load()).revision, 0);
  });

  it('binds a blank CSV source to the verified manifest without a hash fixed-point and rejects an explicit mismatch', async () => {
    const blankSource = geoSubmission({
      csvText: geoSubmission().csvText.replace(`,${SOURCE_ID}\n`, ',\n'),
    });
    const accepted = await planGlobalIntelligenceImport(blankSource, createEmptyGlobalIntelligenceSnapshot(), '2026-08-15T12:00:00Z');
    assert.equal(accepted.status, 'READY');
    assert.equal(accepted.inserts[0]?.sourceEvidenceId, SOURCE_ID);

    const mismatched = geoSubmission({
      csvText: geoSubmission().csvText.replace(`,${SOURCE_ID}\n`, ',source_another-reviewed-file\n'),
    });
    const rejected = await planGlobalIntelligenceImport(mismatched, createEmptyGlobalIntelligenceSnapshot(), '2026-08-15T12:00:00Z');
    assert.equal(rejected.status, 'INVALID');
    assert.ok(rejected.issues.some((item) => item.code === 'SOURCE_MISMATCH'));
  });

  it('never overwrites a conflicting record or reuses a source ID for another file', async () => {
    const repository = createGlobalIntelligenceLocalRepository(memoryAdapter().adapter);
    assert.equal((await repository.import(geoSubmission())).status, 'COMMITTED');
    const changed = geoSubmission({
      csvText: geoSubmission().csvText.replace('惠东县,惠东县', '错误名称,惠东县'),
    });
    const result = await repository.import(changed);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.plan.issues.some((item) => item.code === 'RECORD_CONFLICT'));
    assert.ok(result.plan.issues.some((item) => item.code === 'SOURCE_CONFLICT'));
    assert.equal((await repository.load()).records.geo_units['geo_cn-gd-huidong']?.values.local_name, '惠东县');
  });

  it('rejects unlicensed, unverified, insecure, malformed and cross-dataset inputs with line-level issues', async () => {
    const empty = createEmptyGlobalIntelligenceSnapshot();
    for (const invalidManifest of [
      manifest({ licenseStatus: 'REVIEW_REQUIRED' }),
      manifest({ qualityStatus: 'UNVERIFIED' }),
      manifest({ sourceUrl: 'http://example.test/insecure' }),
      manifest({ permittedUses: ['LOCAL_ANALYSIS'] }),
    ]) {
      const plan = await planGlobalIntelligenceImport(geoSubmission({ manifest: invalidManifest }), empty, '2026-08-15T12:00:00Z');
      assert.equal(plan.status, 'INVALID');
      assert.ok(plan.issues.some((item) => item.code === 'FACT_ADMISSION' || item.code === 'LICENSE_SCOPE'));
    }

    const badCoordinate = geoSubmission({ csvText: geoSubmission().csvText.replace(',22.98,114.72,', ',999,,') });
    const badCoordinatePlan = await planGlobalIntelligenceImport(badCoordinate, empty, '2026-08-15T12:00:00Z');
    assert.equal(badCoordinatePlan.status, 'INVALID');
    assert.ok(badCoordinatePlan.issues.some((item) => item.line === 2 && item.code === 'COORDINATE_PAIR'));

    const clusterSubmission: GlobalIntelligenceImportSubmission = {
      dataset: 'industry_clusters',
      fileName: 'industry_clusters.csv',
      csvText: csv(GLOBAL_INTELLIGENCE_IMPORT_HEADERS.industry_clusters, [
        'cluster_cn-huidong-footwear', '惠东女鞋产业集群', '惠东女鞋', 'geo_missing',
        'REGIONAL_INDUSTRY_CLUSTER', 'OFFICIALLY_LISTED', 'Fixture authority',
        '2026-08-15', 'industry_footwear', 'PARTIAL', '仅含已审记录', SOURCE_ID,
      ]),
      manifest: manifest(),
    };
    const missingReferencePlan = await planGlobalIntelligenceImport(clusterSubmission, empty, '2026-08-15T12:00:00Z');
    assert.equal(missingReferencePlan.status, 'INVALID');
    assert.ok(missingReferencePlan.issues.some((item) => item.line === 2 && item.code === 'MISSING_REFERENCE'));
  });

  it('rejects unknown headers, empty files, duplicate IDs and stale plans', async () => {
    const empty = createEmptyGlobalIntelligenceSnapshot();
    const unknownHeader = geoSubmission({ csvText: geoSubmission().csvText.replace('source_id', 'unexpected') });
    const headerPlan = await planGlobalIntelligenceImport(unknownHeader, empty, '2026-08-15T12:00:00Z');
    assert.equal(headerPlan.status, 'INVALID');
    assert.ok(headerPlan.issues.some((item) => item.code === 'MISSING_HEADER'));
    assert.ok(headerPlan.issues.some((item) => item.code === 'UNKNOWN_HEADER'));

    const emptyFile = geoSubmission({ csvText: `${GLOBAL_INTELLIGENCE_IMPORT_HEADERS.geo_units.join(',')}\n` });
    const emptyPlan = await planGlobalIntelligenceImport(emptyFile, empty, '2026-08-15T12:00:00Z');
    assert.ok(emptyPlan.issues.some((item) => item.code === 'NO_ROWS'));

    const oneRow = geoSubmission().csvText.trimEnd().split('\n')[1]!;
    const duplicate = geoSubmission({ csvText: `${GLOBAL_INTELLIGENCE_IMPORT_HEADERS.geo_units.join(',')}\n${oneRow}\n${oneRow}\n` });
    const duplicatePlan = await planGlobalIntelligenceImport(duplicate, empty, '2026-08-15T12:00:00Z');
    assert.equal(duplicatePlan.status, 'INVALID');
    assert.ok(duplicatePlan.issues.some((item) => item.code === 'DUPLICATE_ID'));

    const ready = await planGlobalIntelligenceImport(geoSubmission(), empty, '2026-08-15T12:00:00Z');
    assert.equal(ready.status, 'READY');
    assert.throws(
      () => commitGlobalIntelligenceImport(ready, { ...empty, revision: 1 }),
      /stale/,
    );
  });
});
