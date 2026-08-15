import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  COMPANY_FACILITY_REGISTRY,
  companyFacilityCoverageForScope,
  createMicSecurityId,
  createRegisteredCompanyId,
  isProductionFacility,
  resolveStockIndustryProfile,
  searchVerifiedCompaniesAndFacilities,
  validateCompanyFacilityRegistry,
  verifiedEntitiesForScope,
  type Brand,
  type Company,
  type CompanyFacilityRegistry,
  type Facility,
  type Security,
  type VerifiedEntityRelationship,
} from '../shared/company-facility-registry';
import {
  createStableEntityId,
  validateSourceEvidence,
  type EvidenceClass,
  type SourceEvidence,
  type StableEntityId,
} from '../shared/global-intelligence-contract';
import {
  industryMapCompanyUrl,
  industryMapFacilityUrl,
  parseIndustryMapRoute,
} from '../src/features/industry-map/industry-map-route';
import { isIndustryMapPath } from '../src/features/industry-map/industry-map-path';
import {
  BRAND_CSV_HEADERS,
  COMPANY_CSV_HEADERS,
  FACILITY_CSV_HEADERS,
  SECURITY_CSV_HEADERS,
  validateCompanyFacilityCsvTexts,
} from '../scripts/validate-company-facility-csv.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMPANY_SOURCE_ID = createStableEntityId('source', 'test-company-registry');
const FACILITY_SOURCE_ID = createStableEntityId('source', 'test-facility-registry');
const GEO_ID = createStableEntityId('geo', 'cn-guangdong-huidong');
const PRODUCT_ID = createStableEntityId('product', 'womens-footwear');
const CLUSTER_ID = createStableEntityId('cluster', 'cn-huidong-womens-footwear');

function testEvidence(sourceId: StableEntityId, evidenceClass: EvidenceClass, aggregationLevel: 'COMPANY' | 'FACILITY'): SourceEvidence {
  return {
    sourceId,
    providerId: 'test-only-fixture',
    sourceType: 'TEST_FIXTURE',
    sourceTitle: 'Phase 16 isolated contract fixture',
    sourceUrl: null,
    sourceReference: 'tests/global-company-facility-registry.test.mts',
    sourcePublishedAt: '2026-08-15T00:00:00Z',
    observedAt: null,
    retrievedAt: '2026-08-15T00:00:00Z',
    validFrom: null,
    validTo: null,
    periodStart: null,
    periodEnd: null,
    evidenceClass,
    aggregationLevel,
    licenseStatus: 'VERIFIED',
    freshnessStatus: 'NOT_APPLICABLE',
    qualityStatus: 'VERIFIED',
    confidence: null,
    methodologyVersion: null,
    nullReasons: {
      sourceUrl: { code: 'NOT_APPLICABLE', explanation: 'The evidence is an isolated test fixture.' },
      observedAt: { code: 'NOT_APPLICABLE', explanation: 'The fixture is not a live observation.' },
      validFrom: { code: 'NOT_PROVIDED', explanation: 'No validity start is needed in this fixture.' },
      validTo: { code: 'NOT_PROVIDED', explanation: 'No validity end is needed in this fixture.' },
      periodStart: { code: 'NOT_APPLICABLE', explanation: 'No numeric period is asserted.' },
      periodEnd: { code: 'NOT_APPLICABLE', explanation: 'No numeric period is asserted.' },
      confidence: { code: 'NOT_APPLICABLE', explanation: 'This is not a model output.' },
      methodologyVersion: { code: 'NOT_APPLICABLE', explanation: 'This is not a model output.' },
    },
  };
}

function edge(
  edgeId: string,
  fromId: StableEntityId,
  toId: StableEntityId,
  relationshipType: VerifiedEntityRelationship['relationship_type'],
  evidenceClass: EvidenceClass,
  sourceId: StableEntityId,
): VerifiedEntityRelationship {
  return {
    edge_id: edgeId,
    from_id: fromId,
    to_id: toId,
    relationship_type: relationshipType,
    evidence_class: evidenceClass,
    source_evidence_ids: [sourceId],
    confidence: null,
    valid_from: null,
    valid_to: null,
    methodology_version: null,
  };
}

function positiveRegistry(secondMarket = false): CompanyFacilityRegistry {
  const companyId = createRegisteredCompanyId('CN', '91330000TEST001');
  const company: Company = {
    company_id: companyId,
    legal_name: '测试制造股份有限公司',
    registration_country: 'CN',
    registration_number: '91330000TEST001',
    canonical_name: '测试制造',
    alternate_names: ['Test Manufacturing'],
    company_type: 'LISTED_ENTITY',
    parent_company_id: null,
    ultimate_parent_id: null,
    headquarters_geo_id: GEO_ID,
    website: 'https://example.test',
    listed_status: 'LISTED',
    source_evidence_ids: [COMPANY_SOURCE_ID],
    coverage_tier: 'TIER_A',
    last_verified_at: '2026-08-15T00:00:00Z',
  };
  const facilityId = createStableEntityId('facility', 'cn-test-huidong-plant');
  const facility: Facility = {
    facility_id: facilityId,
    company_id: companyId,
    company_relationship_type: 'OPERATES',
    facility_name: '测试惠东生产基地',
    facility_type: 'MANUFACTURING_PLANT',
    geo_id: GEO_ID,
    address: null,
    lat: null,
    lon: null,
    industrial_park_id: null,
    operational_status: 'ACTIVE',
    product_ids: [PRODUCT_ID],
    process_tags: ['成鞋组装'],
    capacity_disclosures: [],
    employment_range: null,
    oem_odm_brand_mode: ['OEM'],
    source_evidence_ids: [FACILITY_SOURCE_ID],
    last_verified_at: '2026-08-15T00:00:00Z',
  };
  const brandId = createStableEntityId('brand', 'test-manufacturing');
  const brand: Brand = {
    brand_id: brandId,
    brand_name: '测试品牌',
    owner_company_id: companyId,
    operator_company_ids: [],
    source_evidence_ids: [COMPANY_SOURCE_ID],
  };
  const xnasSecurityId = createMicSecurityId('XNAS', 'TEST');
  const securities: Security[] = [{
    security_id: xnasSecurityId,
    issuer_company_id: companyId,
    instrument_type: 'COMMON_STOCK',
    local_ticker: 'TEST',
    mic: 'XNAS',
    isin: null,
    currency: 'USD',
    primary_listing: true,
    provider_instrument_ids: {},
    valid_from: null,
    valid_to: null,
    source_evidence_ids: [COMPANY_SOURCE_ID],
  }];
  const relationships: VerifiedEntityRelationship[] = [
    edge('edge_company-headquarters', companyId, GEO_ID, 'LOCATED_IN', 'VERIFIED_COMPANY', COMPANY_SOURCE_ID),
    edge('edge_company-operates-facility', companyId, facilityId, 'OPERATES', 'VERIFIED_FACILITY', FACILITY_SOURCE_ID),
    edge('edge_facility-location', facilityId, GEO_ID, 'LOCATED_IN', 'VERIFIED_FACILITY', FACILITY_SOURCE_ID),
    edge('edge_facility-product', facilityId, PRODUCT_ID, 'PRODUCES', 'VERIFIED_FACILITY', FACILITY_SOURCE_ID),
    edge('edge_facility-cluster', facilityId, CLUSTER_ID, 'RELATED_TO', 'VERIFIED_FACILITY', FACILITY_SOURCE_ID),
    edge('edge_company-brand', companyId, brandId, 'BRANDS', 'VERIFIED_COMPANY', COMPANY_SOURCE_ID),
    edge('edge_company-xnas-security', companyId, xnasSecurityId, 'LISTED_AS', 'VERIFIED_COMPANY', COMPANY_SOURCE_ID),
  ];
  if (secondMarket) {
    const xnysSecurityId = createMicSecurityId('XNYS', 'TEST');
    securities.push({ ...securities[0]!, security_id: xnysSecurityId, mic: 'XNYS', primary_listing: false });
    relationships.push(edge('edge_company-xnys-security', companyId, xnysSecurityId, 'LISTED_AS', 'VERIFIED_COMPANY', COMPANY_SOURCE_ID));
  }
  return {
    companies: [company],
    facilities: [facility],
    brands: [brand],
    securities,
    relationships,
    evidence: [
      testEvidence(COMPANY_SOURCE_ID, 'VERIFIED_COMPANY', 'COMPANY'),
      testEvidence(FACILITY_SOURCE_ID, 'VERIFIED_FACILITY', 'FACILITY'),
    ],
  };
}

test('production registry exposes only the licensed reviewed company/facility path and fails closed for securities', () => {
  assert.deepEqual(validateCompanyFacilityRegistry(COMPANY_FACILITY_REGISTRY), []);
  assert.equal(COMPANY_FACILITY_REGISTRY.companies.length, 1);
  assert.equal(COMPANY_FACILITY_REGISTRY.facilities.length, 1);
  assert.equal(COMPANY_FACILITY_REGISTRY.facilities[0]?.company_relationship_type, 'OWNS');
  assert.equal(COMPANY_FACILITY_REGISTRY.brands.length, 0);
  assert.equal(COMPANY_FACILITY_REGISTRY.securities.length, 0);
  assert.equal(resolveStockIndustryProfile('AAPL').status, 'SOURCE_REQUIRED');
});

test('same-name companies remain distinct by registration identity', () => {
  const first = positiveRegistry();
  const secondId = createRegisteredCompanyId('CN', '91330000TEST002');
  const second: Company = {
    ...first.companies[0]!,
    company_id: secondId,
    registration_number: '91330000TEST002',
    headquarters_geo_id: null,
  };
  const registry = { ...first, companies: [...first.companies, second] };
  assert.notEqual(first.companies[0]!.company_id, second.company_id);
  assert.equal(first.companies[0]!.canonical_name, second.canonical_name);
  assert.deepEqual(validateCompanyFacilityRegistry(registry), []);
});

test('same ticker on different MICs never merges and requires an explicit market', () => {
  const registry = positiveRegistry(true);
  assert.deepEqual(validateCompanyFacilityRegistry(registry), []);
  const ambiguous = resolveStockIndustryProfile('TEST', null, registry);
  assert.equal(ambiguous.status, 'MIC_REQUIRED');
  if (ambiguous.status === 'MIC_REQUIRED') assert.deepEqual(ambiguous.candidate_mics, ['XNAS', 'XNYS']);
  const selected = resolveStockIndustryProfile('TEST', 'XNAS', registry);
  assert.equal(selected.status, 'VERIFIED');
  if (selected.status === 'VERIFIED') {
    assert.equal(selected.security.security_id, 'security_xnas-test');
    assert.equal(selected.facilities.length, 1);
    assert.deepEqual(selected.cluster_ids, [CLUSTER_ID]);
  }
});

test('unsourced entities and relationships cannot enter the fact registry', () => {
  const registry = positiveRegistry();
  const unsourcedCompany = { ...registry.companies[0]!, source_evidence_ids: [] };
  assert.ok(validateCompanyFacilityRegistry({ ...registry, companies: [unsourcedCompany] })
    .some((error) => /has no source evidence/.test(error)));
  const unsourcedEdge = { ...registry.relationships[0]!, source_evidence_ids: [] };
  assert.ok(validateCompanyFacilityRegistry({ ...registry, relationships: [unsourcedEdge, ...registry.relationships.slice(1)] })
    .some((error) => /has no source evidence/.test(error)));
});

test('review-required evidence cannot enter the fact registry', () => {
  const registry = positiveRegistry();
  const reviewOnlyEvidence = registry.evidence.map((item, index) => index === 0
    ? { ...item, licenseStatus: 'REVIEW_REQUIRED' as const }
    : item);
  assert.ok(validateCompanyFacilityRegistry({ ...registry, evidence: reviewOnlyEvidence })
    .some((error) => /VERIFIED license is required/.test(error)));
});

test('company headquarters, production facility and coverage remain separate and traceable', () => {
  const registry = positiveRegistry();
  assert.deepEqual(validateCompanyFacilityRegistry(registry), []);
  for (const evidence of registry.evidence) assert.deepEqual(validateSourceEvidence(evidence), []);
  assert.equal(registry.companies[0]!.headquarters_geo_id, GEO_ID);
  assert.equal(isProductionFacility(registry.facilities[0]!), true);
  const entities = verifiedEntitiesForScope(GEO_ID, registry);
  assert.equal(entities.companies.length, 1);
  assert.equal(entities.facilities.length, 1);
  const coverage = companyFacilityCoverageForScope(GEO_ID, registry);
  assert.equal(coverage.verified_company_count, 1);
  assert.equal(coverage.verified_facility_count, 1);
  assert.equal(coverage.coverage_rate, null);
  assert.equal(coverage.complete, false);
  assert.match(coverage.gap_note, /分母/);
  assert.equal(searchVerifiedCompaniesAndFacilities('惠东生产', registry)[0]?.entity_type, 'FACILITY');
});

test('company and facility routes are stable and reject unknown production entities', () => {
  const companyUrl = industryMapCompanyUrl('company_cn-example');
  const facilityUrl = industryMapFacilityUrl('facility_cn-example');
  assert.equal(isIndustryMapPath(companyUrl), true);
  assert.equal(isIndustryMapPath(facilityUrl), true);
  assert.equal(parseIndustryMapRoute(companyUrl).kind, 'not-found');
  assert.equal(parseIndustryMapRoute(facilityUrl).kind, 'not-found');
});

test('operator templates validate while unsafe completeness and unsourced reviewed rows fail', () => {
  const input = {
    companies: readFileSync(join(ROOT, 'docs/integration/templates/companies.csv'), 'utf8'),
    facilities: readFileSync(join(ROOT, 'docs/integration/templates/facilities.csv'), 'utf8'),
    brands: readFileSync(join(ROOT, 'docs/integration/templates/brands.csv'), 'utf8'),
    securities: readFileSync(join(ROOT, 'docs/integration/templates/securities.csv'), 'utf8'),
  };
  assert.deepEqual(validateCompanyFacilityCsvTexts(input), []);
  const unsafeCompanies = [
    COMPANY_CSV_HEADERS.join(','),
    'REVIEWED,company_cn-unsafe,全部工厂公司,CN,UNSAFE,全部工厂公司,,LEGAL_ENTITY,,,,,UNKNOWN,TIER_D,,,2026-08-15T00:00:00Z',
  ].join('\n');
  const errors = validateCompanyFacilityCsvTexts({ ...input, companies: unsafeCompanies });
  assert.ok(errors.some((error) => /prohibited completeness claim/.test(error)));
  assert.ok(errors.some((error) => /reviewed row requires stable source_id/.test(error)));
});

test('maintenance templates and test fixtures stay outside production imports', () => {
  const productionSources = [
    readFileSync(join(ROOT, 'shared/company-facility-registry.ts'), 'utf8'),
    readFileSync(join(ROOT, 'src/features/industry-map/industry-map.ts'), 'utf8'),
    readFileSync(join(ROOT, 'src/features/pokieticker/stock-workspace.ts'), 'utf8'),
  ];
  for (const source of productionSources) {
    assert.doesNotMatch(source, /tests[\\/]fixtures/);
    assert.doesNotMatch(source, /docs[\\/]integration[\\/]templates/);
    assert.doesNotMatch(source, /全部工厂/);
  }
  assert.deepEqual(COMPANY_CSV_HEADERS.slice(1, 6), ['company_id', 'legal_name', 'registration_country', 'registration_number', 'canonical_name']);
  assert.equal(FACILITY_CSV_HEADERS[1], 'facility_id');
  assert.equal(BRAND_CSV_HEADERS[1], 'brand_id');
  assert.equal(SECURITY_CSV_HEADERS[1], 'security_id');
});
