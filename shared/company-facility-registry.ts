/**
 * Phase 16 company, facility, brand and security truth registry.
 *
 * Production facts intentionally start empty. Existing stock symbols, office
 * lists and cluster labels are not identity or factory evidence. Operators may
 * populate this registry only after the entity and every asserted relationship
 * pass the evidence checks below.
 */

import {
  assertEvidenceCanEnterFactTable,
  assertStableEntityId,
  createStableEntityId,
  isFactEvidenceClass,
  type EvidenceClass,
  type SourceEvidence,
  type StableEntityId,
} from './global-intelligence-contract';
import {
  INDUSTRY_MAP_CLUSTERS,
  INDUSTRY_MAP_GEO_UNITS,
  INDUSTRY_MAP_PRODUCTS,
} from './industry-map';
import {
  GLEIF_TESLA_EVIDENCE,
  GLEIF_TESLA_SOURCE_ID,
  WIKIDATA_GIGA_BERLIN_EVIDENCE,
  WIKIDATA_GIGA_BERLIN_SOURCE_ID,
} from './open-industrial-evidence';

export const COMPANY_COVERAGE_TIERS = ['TIER_A', 'TIER_B', 'TIER_C', 'TIER_D'] as const;
export type CompanyCoverageTier = (typeof COMPANY_COVERAGE_TIERS)[number];

export const COMPANY_TYPES = [
  'LEGAL_ENTITY',
  'LISTED_ENTITY',
  'SUBSIDIARY',
  'STATE_OWNED_ENTERPRISE',
  'PRIVATE_ENTERPRISE',
] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const FACILITY_TYPES = [
  'MANUFACTURING_PLANT',
  'ASSEMBLY_PLANT',
  'PROCESSING_PLANT',
  'RESEARCH_AND_DEVELOPMENT',
  'WAREHOUSE',
  'OFFICE',
  'OTHER',
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const PRODUCTION_FACILITY_TYPES = [
  'MANUFACTURING_PLANT',
  'ASSEMBLY_PLANT',
  'PROCESSING_PLANT',
] as const satisfies readonly FacilityType[];

export type Company = Readonly<{
  company_id: StableEntityId;
  legal_name: string;
  registration_country: string;
  registration_number: string;
  canonical_name: string;
  alternate_names: readonly string[];
  company_type: CompanyType;
  parent_company_id: StableEntityId | null;
  ultimate_parent_id: StableEntityId | null;
  headquarters_geo_id: StableEntityId | null;
  website: string | null;
  listed_status: 'LISTED' | 'PRIVATE' | 'UNLISTED' | 'UNKNOWN';
  source_evidence_ids: readonly StableEntityId[];
  coverage_tier: CompanyCoverageTier;
  last_verified_at: string;
}>;

export type Facility = Readonly<{
  facility_id: StableEntityId;
  company_id: StableEntityId;
  company_relationship_type: 'OPERATES' | 'OWNS';
  facility_name: string;
  facility_type: FacilityType;
  geo_id: StableEntityId;
  address: string | null;
  lat: number | null;
  lon: number | null;
  industrial_park_id: StableEntityId | null;
  operational_status: 'ACTIVE' | 'INACTIVE' | 'PLANNED' | 'UNKNOWN';
  product_ids: readonly StableEntityId[];
  process_tags: readonly string[];
  capacity_disclosures: readonly string[];
  employment_range: string | null;
  oem_odm_brand_mode: readonly ('OEM' | 'ODM' | 'OWN_BRAND')[];
  source_evidence_ids: readonly StableEntityId[];
  last_verified_at: string;
}>;

export type Brand = Readonly<{
  brand_id: StableEntityId;
  brand_name: string;
  owner_company_id: StableEntityId;
  operator_company_ids: readonly StableEntityId[];
  source_evidence_ids: readonly StableEntityId[];
}>;

export type Security = Readonly<{
  security_id: StableEntityId;
  issuer_company_id: StableEntityId;
  instrument_type: 'COMMON_STOCK' | 'PREFERRED_STOCK' | 'DEPOSITARY_RECEIPT' | 'OTHER';
  local_ticker: string;
  mic: string;
  isin: string | null;
  currency: string;
  primary_listing: boolean;
  provider_instrument_ids: Readonly<Record<string, string>>;
  valid_from: string | null;
  valid_to: string | null;
  source_evidence_ids: readonly StableEntityId[];
}>;

export const ENTITY_RELATIONSHIP_TYPES = [
  'LOCATED_IN',
  'PRODUCES',
  'OPERATES',
  'OWNS',
  'BRANDS',
  'LISTED_AS',
  'RELATED_TO',
] as const;
export type EntityRelationshipType = (typeof ENTITY_RELATIONSHIP_TYPES)[number];

export type VerifiedEntityRelationship = Readonly<{
  edge_id: string;
  from_id: StableEntityId;
  to_id: StableEntityId;
  relationship_type: EntityRelationshipType;
  evidence_class: EvidenceClass;
  source_evidence_ids: readonly StableEntityId[];
  confidence: number | null;
  valid_from: string | null;
  valid_to: string | null;
  methodology_version: string | null;
}>;

export type CompanyFacilityRegistry = Readonly<{
  companies: readonly Company[];
  facilities: readonly Facility[];
  brands: readonly Brand[];
  securities: readonly Security[];
  relationships: readonly VerifiedEntityRelationship[];
  evidence: readonly SourceEvidence[];
}>;

export type CompanyFacilityCoverage = Readonly<{
  scope_id: StableEntityId;
  verified_company_count: number;
  verified_facility_count: number;
  coverage_tier: CompanyCoverageTier | null;
  source_count: number;
  last_verified_at: string | null;
  coverage_rate: number | null;
  coverage_rate_status: 'DENOMINATOR_UNAVAILABLE';
  complete: false;
  gap_note: string;
}>;

export type CompanyFacilitySearchResult = Readonly<{
  entity_type: 'COMPANY' | 'FACILITY';
  entity_id: StableEntityId;
  title: string;
  subtitle: string;
  coverage_tier: CompanyCoverageTier;
  source_evidence_ids: readonly StableEntityId[];
}>;

export type StockIndustryProfile =
  | Readonly<{ status: 'SOURCE_REQUIRED'; reason: string; ticker: string }>
  | Readonly<{ status: 'MIC_REQUIRED'; reason: string; ticker: string; candidate_mics: readonly string[] }>
  | Readonly<{
    status: 'VERIFIED';
    ticker: string;
    mic: string;
    security: Security;
    company: Company;
    facilities: readonly Facility[];
    cluster_ids: readonly StableEntityId[];
    source_evidence_ids: readonly StableEntityId[];
  }>;

const ASCII_IDENTITY_COMPONENT = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;
const MIC_PATTERN = /^[A-Z0-9]{4}$/;
const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,31}$/;

function normalizeIdentityComponent(value: string, field: string): string {
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  if (!ASCII_IDENTITY_COMPONENT.test(normalized)) {
    throw new Error(`${field} must contain only stable ASCII letters, numbers, dots or hyphens`);
  }
  return normalized;
}

export function createRegisteredCompanyId(registrationCountry: string, registrationNumber: string): StableEntityId {
  const country = registrationCountry.normalize('NFKC').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(country)) throw new Error('registrationCountry must be an ISO alpha-2 code');
  const registration = normalizeIdentityComponent(registrationNumber, 'registrationNumber');
  return createStableEntityId('company', `${country}-${registration}`);
}

export function createMicSecurityId(mic: string, localTicker: string): StableEntityId {
  const normalizedMic = mic.normalize('NFKC').trim().toUpperCase();
  const ticker = localTicker.normalize('NFKC').trim().toUpperCase();
  if (!MIC_PATTERN.test(normalizedMic)) throw new Error('mic must be a four-character ISO 10383 code');
  if (!TICKER_PATTERN.test(ticker)) throw new Error('localTicker has an invalid format');
  return createStableEntityId('security', `${normalizedMic.toLowerCase()}-${ticker.toLowerCase()}`);
}

export function isProductionFacility(facility: Facility): boolean {
  return PRODUCTION_FACILITY_TYPES.includes(facility.facility_type as (typeof PRODUCTION_FACILITY_TYPES)[number]);
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
}

function isIsoTimestamp(value: string | null): boolean {
  return value === null || (value.trim().length > 0 && Number.isFinite(Date.parse(value)));
}

function entityIds(registry: CompanyFacilityRegistry): Set<string> {
  return new Set<string>([
    ...registry.companies.map((item) => item.company_id),
    ...registry.facilities.map((item) => item.facility_id),
    ...registry.brands.map((item) => item.brand_id),
    ...registry.securities.map((item) => item.security_id),
    ...INDUSTRY_MAP_GEO_UNITS.map((item) => item.geo_id),
    ...INDUSTRY_MAP_PRODUCTS.map((item) => item.product_id),
    ...INDUSTRY_MAP_CLUSTERS.map((item) => item.cluster_id),
  ]);
}

function hasSourcedEdge(
  registry: CompanyFacilityRegistry,
  fromId: StableEntityId,
  toId: StableEntityId,
  relationshipType: EntityRelationshipType,
): boolean {
  return registry.relationships.some((edge) => (
    edge.from_id === fromId
    && edge.to_id === toId
    && edge.relationship_type === relationshipType
    && edge.source_evidence_ids.length > 0
  ));
}

function validateRecordEvidence(
  recordId: string,
  sourceIds: readonly StableEntityId[],
  evidenceById: ReadonlyMap<string, SourceEvidence>,
  errors: string[],
): void {
  if (sourceIds.length === 0) errors.push(`${recordId} has no source evidence`);
  for (const sourceId of sourceIds) {
    const evidence = evidenceById.get(sourceId);
    if (!evidence) {
      errors.push(`${recordId} references missing evidence ${sourceId}`);
      continue;
    }
    try {
      assertEvidenceCanEnterFactTable(evidence);
    } catch (error) {
      errors.push(`${recordId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export function validateCompanyFacilityRegistry(registry: CompanyFacilityRegistry): string[] {
  const errors: string[] = [];
  const evidenceById = new Map(registry.evidence.map((item) => [item.sourceId, item]));
  const allEntityIds = entityIds(registry);
  const seenIds = new Set<string>();
  const registerId = (id: StableEntityId, prefix: 'company' | 'facility' | 'brand' | 'security') => {
    try {
      assertStableEntityId(id, prefix);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    if (seenIds.has(id)) errors.push(`duplicate entity ID ${id}`);
    seenIds.add(id);
  };

  for (const company of registry.companies) {
    registerId(company.company_id, 'company');
    if (!company.legal_name.trim() || !company.canonical_name.trim()) errors.push(`${company.company_id} has no legal/canonical name`);
    if (!/^[A-Z]{2}$/.test(company.registration_country)) errors.push(`${company.company_id} has an invalid registration country`);
    if (!company.registration_number.trim()) errors.push(`${company.company_id} has no registration number`);
    try {
      if (company.company_id !== createRegisteredCompanyId(company.registration_country, company.registration_number)) {
        errors.push(`${company.company_id} does not match its registration identity`);
      }
    } catch (error) {
      errors.push(`${company.company_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isIsoTimestamp(company.last_verified_at)) errors.push(`${company.company_id} has an invalid verification time`);
    validateRecordEvidence(company.company_id, company.source_evidence_ids, evidenceById, errors);
    if (company.parent_company_id && !hasSourcedEdge(registry, company.parent_company_id, company.company_id, 'OWNS')) {
      errors.push(`${company.company_id} parent relationship has no sourced OWNS edge`);
    }
    if (company.ultimate_parent_id && company.ultimate_parent_id !== company.parent_company_id
      && !hasSourcedEdge(registry, company.ultimate_parent_id, company.company_id, 'OWNS')) {
      errors.push(`${company.company_id} ultimate parent relationship has no sourced OWNS edge`);
    }
    if (company.headquarters_geo_id && !hasSourcedEdge(registry, company.company_id, company.headquarters_geo_id, 'LOCATED_IN')) {
      errors.push(`${company.company_id} headquarters relationship has no sourced LOCATED_IN edge`);
    }
  }

  for (const facility of registry.facilities) {
    registerId(facility.facility_id, 'facility');
    if (!facility.facility_name.trim()) errors.push(`${facility.facility_id} has no facility name`);
    if (!registry.companies.some((company) => company.company_id === facility.company_id)) {
      errors.push(`${facility.facility_id} references an unknown company`);
    }
    if (!INDUSTRY_MAP_GEO_UNITS.some((geo) => geo.geo_id === facility.geo_id)) {
      errors.push(`${facility.facility_id} references an unknown GeoUnit`);
    }
    if ((facility.lat === null) !== (facility.lon === null)) errors.push(`${facility.facility_id} has a partial coordinate pair`);
    if (facility.lat !== null && (facility.lat < -90 || facility.lat > 90)) errors.push(`${facility.facility_id} latitude is out of range`);
    if (facility.lon !== null && (facility.lon < -180 || facility.lon > 180)) errors.push(`${facility.facility_id} longitude is out of range`);
    if (!isIsoTimestamp(facility.last_verified_at)) errors.push(`${facility.facility_id} has an invalid verification time`);
    validateRecordEvidence(facility.facility_id, facility.source_evidence_ids, evidenceById, errors);
    if (!hasSourcedEdge(registry, facility.company_id, facility.facility_id, facility.company_relationship_type)) {
      errors.push(`${facility.facility_id} company relationship has no sourced ${facility.company_relationship_type} edge`);
    }
    if (!hasSourcedEdge(registry, facility.facility_id, facility.geo_id, 'LOCATED_IN')) {
      errors.push(`${facility.facility_id} location relationship has no sourced LOCATED_IN edge`);
    }
    for (const productId of facility.product_ids) {
      if (!INDUSTRY_MAP_PRODUCTS.some((product) => product.product_id === productId)) {
        errors.push(`${facility.facility_id} references an unknown product ${productId}`);
      }
      if (!hasSourcedEdge(registry, facility.facility_id, productId, 'PRODUCES')) {
        errors.push(`${facility.facility_id} product relationship has no sourced PRODUCES edge`);
      }
    }
  }

  for (const brand of registry.brands) {
    registerId(brand.brand_id, 'brand');
    if (!brand.brand_name.trim()) errors.push(`${brand.brand_id} has no brand name`);
    validateRecordEvidence(brand.brand_id, brand.source_evidence_ids, evidenceById, errors);
    for (const companyId of new Set([brand.owner_company_id, ...brand.operator_company_ids])) {
      if (!registry.companies.some((company) => company.company_id === companyId)) errors.push(`${brand.brand_id} references an unknown company`);
      if (!hasSourcedEdge(registry, companyId, brand.brand_id, 'BRANDS')) errors.push(`${brand.brand_id} relationship has no sourced BRANDS edge`);
    }
  }

  const securityIdentityKeys = new Set<string>();
  for (const security of registry.securities) {
    registerId(security.security_id, 'security');
    const identityKey = `${security.mic}:${security.local_ticker}`;
    if (securityIdentityKeys.has(identityKey)) errors.push(`duplicate security identity ${identityKey}`);
    securityIdentityKeys.add(identityKey);
    try {
      if (security.security_id !== createMicSecurityId(security.mic, security.local_ticker)) {
        errors.push(`${security.security_id} does not match its MIC+ticker identity`);
      }
    } catch (error) {
      errors.push(`${security.security_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!registry.companies.some((company) => company.company_id === security.issuer_company_id)) {
      errors.push(`${security.security_id} references an unknown issuer`);
    }
    validateRecordEvidence(security.security_id, security.source_evidence_ids, evidenceById, errors);
    if (!hasSourcedEdge(registry, security.issuer_company_id, security.security_id, 'LISTED_AS')) {
      errors.push(`${security.security_id} issuer relationship has no sourced LISTED_AS edge`);
    }
  }

  const seenEdges = new Set<string>();
  for (const edge of registry.relationships) {
    if (!edge.edge_id.trim()) errors.push('relationship edge has no edge_id');
    if (seenEdges.has(edge.edge_id)) errors.push(`duplicate relationship edge ${edge.edge_id}`);
    seenEdges.add(edge.edge_id);
    if (!allEntityIds.has(edge.from_id) || !allEntityIds.has(edge.to_id)) errors.push(`${edge.edge_id} references an unknown entity`);
    if (!ENTITY_RELATIONSHIP_TYPES.includes(edge.relationship_type)) errors.push(`${edge.edge_id} has an invalid relationship type`);
    if (!isFactEvidenceClass(edge.evidence_class)) errors.push(`${edge.edge_id} is not backed by fact evidence`);
    validateRecordEvidence(edge.edge_id, edge.source_evidence_ids, evidenceById, errors);
    for (const sourceId of edge.source_evidence_ids) {
      const source = evidenceById.get(sourceId);
      if (source && source.evidenceClass !== edge.evidence_class) errors.push(`${edge.edge_id} evidence class does not match ${sourceId}`);
    }
    if (edge.confidence !== null && (!Number.isFinite(edge.confidence) || edge.confidence < 0 || edge.confidence > 1)) {
      errors.push(`${edge.edge_id} confidence is out of range`);
    }
    if (!isIsoTimestamp(edge.valid_from) || !isIsoTimestamp(edge.valid_to)) errors.push(`${edge.edge_id} has an invalid validity time`);
  }
  return errors;
}

export function assertCompanyFacilityRegistry(registry: CompanyFacilityRegistry): void {
  const errors = validateCompanyFacilityRegistry(registry);
  if (errors.length > 0) throw new Error(`Invalid company/facility registry: ${errors.join('; ')}`);
}

const TESLA_COMPANY_ID = createRegisteredCompanyId('US', '0805587591');
const GIGA_BERLIN_FACILITY_ID = createStableEntityId('facility', 'wikidata-q75327597');
const GIGA_BERLIN_GEO_ID = createStableEntityId('geo', 'de-brandenburg-giga-berlin-campus');
const MODEL_Y_PRODUCT_ID = createStableEntityId('product', 'tesla-model-y');

/**
 * Minimal production registry promoted only from the audit-captured, licensed
 * and cross-source-reviewed snapshots. Coverage remains explicitly partial.
 */
export const COMPANY_FACILITY_REGISTRY: CompanyFacilityRegistry = Object.freeze({
  companies: Object.freeze([{
    company_id: TESLA_COMPANY_ID,
    legal_name: 'TESLA, INC.',
    registration_country: 'US',
    registration_number: '0805587591',
    canonical_name: 'Tesla, Inc.',
    alternate_names: Object.freeze(['Tesla']),
    company_type: 'LEGAL_ENTITY',
    parent_company_id: null,
    ultimate_parent_id: null,
    headquarters_geo_id: null,
    website: null,
    listed_status: 'UNKNOWN',
    source_evidence_ids: Object.freeze([GLEIF_TESLA_SOURCE_ID]),
    coverage_tier: 'TIER_D',
    last_verified_at: '2026-08-15T11:05:11.799Z',
  } satisfies Company]),
  facilities: Object.freeze([{
    facility_id: GIGA_BERLIN_FACILITY_ID,
    company_id: TESLA_COMPANY_ID,
    company_relationship_type: 'OWNS',
    facility_name: 'Gigafactory Berlin-Brandenburg',
    facility_type: 'MANUFACTURING_PLANT',
    geo_id: GIGA_BERLIN_GEO_ID,
    address: null,
    lat: 52.395,
    lon: 13.79,
    industrial_park_id: null,
    operational_status: 'ACTIVE',
    product_ids: Object.freeze([MODEL_Y_PRODUCT_ID]),
    process_tags: Object.freeze(['electric vehicle manufacturing']),
    capacity_disclosures: Object.freeze([]),
    employment_range: null,
    oem_odm_brand_mode: Object.freeze(['OWN_BRAND']),
    source_evidence_ids: Object.freeze([WIKIDATA_GIGA_BERLIN_SOURCE_ID]),
    last_verified_at: '2026-08-15T11:15:25.569Z',
  } satisfies Facility]),
  brands: Object.freeze([]),
  securities: Object.freeze([]),
  relationships: Object.freeze([{
    edge_id: 'edge_tesla-owns-giga-berlin',
    from_id: TESLA_COMPANY_ID,
    to_id: GIGA_BERLIN_FACILITY_ID,
    relationship_type: 'OWNS',
    evidence_class: 'VERIFIED_FACILITY',
    source_evidence_ids: Object.freeze([WIKIDATA_GIGA_BERLIN_SOURCE_ID]),
    confidence: null,
    valid_from: null,
    valid_to: null,
    methodology_version: 'open-industrial-cross-source-review/v1',
  }, {
    edge_id: 'edge_giga-berlin-located-campus',
    from_id: GIGA_BERLIN_FACILITY_ID,
    to_id: GIGA_BERLIN_GEO_ID,
    relationship_type: 'LOCATED_IN',
    evidence_class: 'VERIFIED_FACILITY',
    source_evidence_ids: Object.freeze([WIKIDATA_GIGA_BERLIN_SOURCE_ID]),
    confidence: null,
    valid_from: null,
    valid_to: null,
    methodology_version: 'open-industrial-cross-source-review/v1',
  }, {
    edge_id: 'edge_giga-berlin-produces-model-y',
    from_id: GIGA_BERLIN_FACILITY_ID,
    to_id: MODEL_Y_PRODUCT_ID,
    relationship_type: 'PRODUCES',
    evidence_class: 'VERIFIED_FACILITY',
    source_evidence_ids: Object.freeze([WIKIDATA_GIGA_BERLIN_SOURCE_ID]),
    confidence: null,
    valid_from: null,
    valid_to: null,
    methodology_version: 'open-industrial-cross-source-review/v1',
  }] satisfies readonly VerifiedEntityRelationship[]),
  evidence: Object.freeze([GLEIF_TESLA_EVIDENCE, WIKIDATA_GIGA_BERLIN_EVIDENCE]),
});

assertCompanyFacilityRegistry(COMPANY_FACILITY_REGISTRY);

export const VERIFIED_COMPANIES = COMPANY_FACILITY_REGISTRY.companies;
export const VERIFIED_FACILITIES = COMPANY_FACILITY_REGISTRY.facilities;
export const VERIFIED_BRANDS = COMPANY_FACILITY_REGISTRY.brands;
export const VERIFIED_SECURITIES = COMPANY_FACILITY_REGISTRY.securities;
export const VERIFIED_ENTITY_RELATIONSHIPS = COMPANY_FACILITY_REGISTRY.relationships;

export function companyById(id: string | null | undefined, registry = COMPANY_FACILITY_REGISTRY): Company | null {
  return registry.companies.find((company) => company.company_id === id) ?? null;
}

export function facilityById(id: string | null | undefined, registry = COMPANY_FACILITY_REGISTRY): Facility | null {
  return registry.facilities.find((facility) => facility.facility_id === id) ?? null;
}

export function searchVerifiedCompaniesAndFacilities(
  query: string,
  registry = COMPANY_FACILITY_REGISTRY,
): CompanyFacilitySearchResult[] {
  const normalized = normalizeSearchText(query);
  const companies = registry.companies
    .filter((company) => normalizeSearchText([
      company.legal_name,
      company.canonical_name,
      ...company.alternate_names,
      company.registration_number,
    ].join('|')).includes(normalized))
    .map((company) => ({
      entity_type: 'COMPANY',
      entity_id: company.company_id,
      title: company.canonical_name,
      subtitle: `${company.registration_country} · ${company.company_type} · 总部与生产基地分开记录`,
      coverage_tier: company.coverage_tier,
      source_evidence_ids: company.source_evidence_ids,
    } as const));
  const facilities = registry.facilities
    .filter((facility) => normalizeSearchText([
      facility.facility_name,
      facility.address ?? '',
      ...facility.process_tags,
    ].join('|')).includes(normalized))
    .map((facility) => {
      const owner = companyById(facility.company_id, registry);
      return {
        entity_type: 'FACILITY',
        entity_id: facility.facility_id,
        title: facility.facility_name,
        subtitle: `${owner?.canonical_name ?? facility.company_id} · ${facility.facility_type}`,
        coverage_tier: owner?.coverage_tier ?? 'TIER_D',
        source_evidence_ids: facility.source_evidence_ids,
      } as const;
    });
  return [...companies, ...facilities].sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
}

function relatedEntityIds(
  scopeId: StableEntityId,
  registry: CompanyFacilityRegistry,
): Readonly<{ companyIds: Set<StableEntityId>; facilityIds: Set<StableEntityId> }> {
  const companyIds = new Set<StableEntityId>();
  const facilityIds = new Set<StableEntityId>();
  for (const edge of registry.relationships) {
    if (edge.to_id !== scopeId || !['LOCATED_IN', 'RELATED_TO'].includes(edge.relationship_type)) continue;
    if (String(edge.from_id).startsWith('company_')) companyIds.add(edge.from_id);
    if (String(edge.from_id).startsWith('facility_')) facilityIds.add(edge.from_id);
  }
  for (const facilityId of facilityIds) {
    const facility = facilityById(facilityId, registry);
    if (facility) companyIds.add(facility.company_id);
  }
  return { companyIds, facilityIds };
}

export function verifiedEntitiesForScope(
  scopeId: StableEntityId,
  registry = COMPANY_FACILITY_REGISTRY,
): Readonly<{ companies: readonly Company[]; facilities: readonly Facility[] }> {
  const ids = relatedEntityIds(scopeId, registry);
  return {
    companies: registry.companies.filter((company) => ids.companyIds.has(company.company_id)),
    facilities: registry.facilities.filter((facility) => ids.facilityIds.has(facility.facility_id)),
  };
}

export function companyFacilityCoverageForScope(
  scopeId: StableEntityId,
  registry = COMPANY_FACILITY_REGISTRY,
): CompanyFacilityCoverage {
  const entities = verifiedEntitiesForScope(scopeId, registry);
  const sourceIds = new Set<string>([
    ...entities.companies.flatMap((company) => company.source_evidence_ids),
    ...entities.facilities.flatMap((facility) => facility.source_evidence_ids),
  ]);
  const tierRank: Record<CompanyCoverageTier, number> = { TIER_A: 0, TIER_B: 1, TIER_C: 2, TIER_D: 3 };
  const coverageTier = entities.companies
    .map((company) => company.coverage_tier)
    .sort((left, right) => tierRank[left] - tierRank[right])[0] ?? null;
  const verifiedTimes = [...entities.companies, ...entities.facilities]
    .map((entity) => entity.last_verified_at)
    .sort();
  return {
    scope_id: scopeId,
    verified_company_count: entities.companies.length,
    verified_facility_count: entities.facilities.length,
    coverage_tier: coverageTier,
    source_count: sourceIds.size,
    last_verified_at: verifiedTimes.length > 0 ? verifiedTimes[verifiedTimes.length - 1]! : null,
    coverage_rate: null,
    coverage_rate_status: 'DENOMINATOR_UNAVAILABLE',
    complete: false,
    gap_note: '没有经来源审核的企业/工厂总数分母；覆盖率不可计算，当前计数不得解释为完整名录。',
  };
}

export function resolveStockIndustryProfile(
  localTicker: string,
  mic?: string | null,
  registry = COMPANY_FACILITY_REGISTRY,
): StockIndustryProfile {
  const ticker = localTicker.normalize('NFKC').trim().toUpperCase();
  const normalizedMic = mic?.normalize('NFKC').trim().toUpperCase() || null;
  const tickerMatches = registry.securities.filter((security) => security.local_ticker === ticker);
  const matches = normalizedMic ? tickerMatches.filter((security) => security.mic === normalizedMic) : tickerMatches;
  if (!normalizedMic && matches.length > 1) {
    return {
      status: 'MIC_REQUIRED',
      reason: '同一股票代码对应多个交易场所；必须提供 MIC 才能选择证券实体。',
      ticker,
      candidate_mics: Object.freeze([...new Set(matches.map((security) => security.mic))].sort()),
    };
  }
  const security = matches.length === 1 ? matches[0]! : null;
  if (!security) {
    return {
      status: 'SOURCE_REQUIRED',
      reason: normalizedMic
        ? `没有 ${normalizedMic}:${ticker} 的经审查证券—企业关系。`
        : `没有 ${ticker} 的唯一经审查 MIC 与证券—企业关系。`,
      ticker,
    };
  }
  const company = companyById(security.issuer_company_id, registry);
  if (!company || !hasSourcedEdge(registry, company.company_id, security.security_id, 'LISTED_AS')) {
    return { status: 'SOURCE_REQUIRED', reason: '证券存在，但上市主体关系缺少可追溯来源。', ticker };
  }
  const facilities = registry.facilities.filter((facility) => (
    facility.company_id === company.company_id
    && hasSourcedEdge(registry, company.company_id, facility.facility_id, 'OPERATES')
  ));
  const relatedFromIds = new Set<StableEntityId>([company.company_id, ...facilities.map((facility) => facility.facility_id)]);
  const clusterIds = registry.relationships
    .filter((edge) => edge.relationship_type === 'RELATED_TO'
      && relatedFromIds.has(edge.from_id)
      && String(edge.to_id).startsWith('cluster_'))
    .map((edge) => edge.to_id);
  const relationshipSources = registry.relationships
    .filter((edge) => relatedFromIds.has(edge.from_id) || edge.from_id === company.company_id)
    .flatMap((edge) => edge.source_evidence_ids);
  return {
    status: 'VERIFIED',
    ticker,
    mic: security.mic,
    security,
    company,
    facilities: Object.freeze(facilities),
    cluster_ids: Object.freeze([...new Set(clusterIds)]),
    source_evidence_ids: Object.freeze([...new Set([
      ...security.source_evidence_ids,
      ...company.source_evidence_ids,
      ...facilities.flatMap((facility) => facility.source_evidence_ids),
      ...relationshipSources,
    ])]),
  };
}
