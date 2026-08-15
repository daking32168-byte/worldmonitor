import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  INDUSTRY_MAP_CLUSTERS,
  INDUSTRY_MAP_GEO_UNITS,
  INDUSTRY_MAP_HS_MAPPINGS,
  INDUSTRY_MAP_LEGACY_CLUSTER_ALIASES,
  INDUSTRY_MAP_MODE_OPTIONS,
  INDUSTRY_MAP_PRODUCTS,
  INDUSTRY_MAP_SOURCE_EVIDENCE,
  industryClusterById,
  industryGeoUnitById,
  searchIndustryMap,
  validateIndustryMapRegistry,
} from '../shared/industry-map';
import { validateSourceEvidence } from '../shared/global-intelligence-contract';
import {
  industryMapClusterUrl,
  industryMapLocationUrl,
  parseIndustryMapRoute,
} from '../src/features/industry-map/industry-map-route';
import { isIndustryMapPath } from '../src/features/industry-map/industry-map-path';
import {
  INDUSTRY_MAP_CSV_HEADERS,
  validateIndustryMapCsvText,
} from '../scripts/validate-industry-map-csv.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('Phase 15 adapts exactly 22 sourced seeds into the four required domain models', () => {
  assert.equal(INDUSTRY_MAP_CLUSTERS.length, 22);
  assert.equal(INDUSTRY_MAP_GEO_UNITS.length, 22);
  assert.equal(INDUSTRY_MAP_PRODUCTS.length, 22);
  assert.equal(INDUSTRY_MAP_HS_MAPPINGS.length, 2);
  assert.deepEqual(validateIndustryMapRegistry(), []);
  for (const source of INDUSTRY_MAP_SOURCE_EVIDENCE) {
    assert.deepEqual(validateSourceEvidence(source), [], source.sourceId);
  }
  for (const cluster of INDUSTRY_MAP_CLUSTERS) {
    assert.ok(cluster.cluster_id.startsWith('cluster_'));
    assert.ok(cluster.geo_scope_ids.every((id) => industryGeoUnitById(id)));
    assert.ok(cluster.source_evidence_ids.length >= 1);
  }
});

test('searching 女鞋 returns the sourced Huidong record and no fabricated candidate', () => {
  const results = searchIndustryMap('女鞋');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.cluster_id, 'cluster_cn-huidong-womens-footwear');
  assert.equal(results[0]?.source_status, 'SOURCED');
  assert.match(results[0]?.location ?? '', /广东省.*惠州市.*惠东县/);
  assert.ok((results[0]?.source_evidence_ids.length ?? 0) >= 2);
  assert.equal(searchIndustryMap('没有来源的虚构量子鞋产业').length, 0);
});

test('only Huidong and Putian retain reviewed HS 64 while 20 reference clusters stay disabled', () => {
  const mappingClusters = INDUSTRY_MAP_CLUSTERS.filter((cluster) => cluster.hs_mapping_ids.length > 0);
  assert.deepEqual(mappingClusters.map((cluster) => cluster.cluster_id), [
    'cluster_cn-huidong-womens-footwear',
    'cluster_cn-putian-licheng-sports-footwear',
  ]);
  assert.ok(INDUSTRY_MAP_HS_MAPPINGS.every((mapping) => (
    mapping.hs_version === 'HS 2012'
      && mapping.hs_code === '64'
      && mapping.mapping_scope === 'HS2'
      && mapping.mapping_status === 'REVIEWED'
  )));
  const referenceIds = Object.entries(INDUSTRY_MAP_LEGACY_CLUSTER_ALIASES)
    .filter(([legacyId]) => legacyId.startsWith('miit-2024-'))
    .map(([, clusterId]) => clusterId);
  assert.equal(referenceIds.length, 20);
  for (const clusterId of referenceIds) {
    const cluster = industryClusterById(clusterId)!;
    assert.equal(cluster.coverage_status, 'REFERENCE_ONLY');
    assert.equal(cluster.statistics_enabled, false);
    assert.equal(cluster.statistics_status, 'DISABLED_PENDING_HS_REVIEW');
    assert.deepEqual(cluster.hs_mapping_ids, []);
  }
});

test('no seed cluster carries a value-bearing trade observation', () => {
  const forbiddenKeys = /(?:trade_value|net_weight|destination|partner|port|shipment|buyer|amount|volume)/i;
  for (const cluster of INDUSTRY_MAP_CLUSTERS) {
    assert.ok(!Object.keys(cluster).some((key) => forbiddenKeys.test(key)), cluster.cluster_id);
    if (cluster.statistics_enabled) {
      assert.equal(cluster.statistics_status, 'MAPPING_REVIEWED_NO_TRADE_DATA');
    }
  }
});

test('every current GeoUnit fails closed without reviewed boundary or invented centroid', () => {
  for (const geo of INDUSTRY_MAP_GEO_UNITS) {
    assert.equal(geo.boundary_review_status, 'NOT_REVIEWED');
    assert.equal(geo.boundary_ref, null);
    assert.equal(geo.centroid_lat, null);
    assert.equal(geo.centroid_lon, null);
  }
});

test('industry-map overview, location and cluster detail routes reject unknown entities', () => {
  const huidongCluster = 'cluster_cn-huidong-womens-footwear';
  const huidongGeo = 'geo_cn-guangdong-huidong';
  assert.equal(isIndustryMapPath('/industry-map'), true);
  assert.equal(isIndustryMapPath(industryMapLocationUrl(huidongGeo)), true);
  assert.equal(isIndustryMapPath(industryMapClusterUrl(huidongCluster)), true);
  assert.equal(parseIndustryMapRoute('/industry-map').kind, 'overview');
  assert.equal(parseIndustryMapRoute(industryMapLocationUrl(huidongGeo)).kind, 'location');
  assert.equal(parseIndustryMapRoute(industryMapClusterUrl(huidongCluster)).kind, 'cluster');
  assert.equal(parseIndustryMapRoute('/industry-map/cluster/cluster_unknown').kind, 'not-found');
  assert.equal(isIndustryMapPath('/industry-map/company/company_unknown'), false);
});

test('the five map modes exist and only industry distribution is enabled in Phase 15', () => {
  assert.deepEqual(INDUSTRY_MAP_MODE_OPTIONS.map((mode) => mode.id), [
    'INDUSTRY_DISTRIBUTION',
    'COMPANY_FACILITY',
    'PRODUCT_FLOW',
    'LOGISTICS_NETWORK',
    'EVENT_IMPACT',
  ]);
  assert.deepEqual(INDUSTRY_MAP_MODE_OPTIONS.filter((mode) => mode.implemented).map((mode) => mode.id), [
    'INDUSTRY_DISTRIBUTION',
  ]);
});

test('maintenance CSV template validates and unsafe statistical promotion is rejected', () => {
  const templatePath = join(ROOT, 'docs/integration/templates/industry-map-maintenance.csv');
  const template = readFileSync(templatePath, 'utf8');
  assert.deepEqual(validateIndustryMapCsvText(template), []);
  const unsafe = [
    INDUSTRY_MAP_CSV_HEADERS.join(','),
    'SOURCE_REQUIRED,cluster_bad,坏记录,,geo_bad,COUNTY_DISTRICT,CN,CHN,省,市,区,,,,NOT_REVIEWED,product_bad,产品,,,,SOURCE_REQUIRED,,,REFERENCE_ONLY,true,缺口',
  ].join('\n');
  assert.ok(validateIndustryMapCsvText(unsafe).some((error) => /statistics require/.test(error)));
});

test('maintenance data and test fixtures stay outside the production import graph', () => {
  const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
  const feature = readFileSync(join(ROOT, 'src/features/industry-map/industry-map.ts'), 'utf8');
  const domain = readFileSync(join(ROOT, 'shared/industry-map.ts'), 'utf8');
  assert.match(main, /import\('\.\/features\/industry-map\/industry-map'\)/);
  for (const source of [main, feature, domain]) {
    assert.doesNotMatch(source, /tests[\\/]fixtures/);
    assert.doesNotMatch(source, /industry-map-maintenance\.csv/);
  }
});

test('mobile layout prevents horizontal overflow and keeps work panes independently scrollable', () => {
  const css = readFileSync(join(ROOT, 'src/features/industry-map/industry-map.css'), 'utf8');
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.industry-map \{[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/s);
  assert.match(css, /\.industry-map__results,[\s\S]*?\.industry-map__detail \{[^}]*overflow-y: auto;/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /min-width:\s*[7-9]\d{2}px/);
});
