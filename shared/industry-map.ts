/**
 * Phase 15 industry-map domain registry.
 *
 * The existing China Factory registry remains the source of truth for all 22
 * seed statements. This module only adapts those statements into the shared
 * Global Intelligence identity/evidence model. It contains no trade values,
 * inferred coordinates, reviewed administrative geometry, company fixture or
 * shipment fixture.
 */

import {
  CHINA_FACTORY_CLUSTERS,
  CHINA_FACTORY_REFERENCE_CLUSTERS,
  CHINA_FACTORY_REVIEWED_CLUSTERS,
  type ChinaFactoryCluster,
  type ChinaFactorySource,
} from './china-factory-clusters';
import {
  assertSourceEvidence,
  createStableEntityId,
  isStableEntityId,
  type AggregationLevel,
  type EvidenceClass,
  type EvidenceNullReasonCode,
  type SourceEvidence,
  type StableEntityId,
} from './global-intelligence-contract';

export const GEO_UNIT_LEVELS = [
  'WORLD',
  'COUNTRY',
  'STATE_PROVINCE',
  'CITY',
  'COUNTY_DISTRICT',
  'TOWN',
  'INDUSTRIAL_PARK',
] as const;

export type GeoUnitLevel = (typeof GEO_UNIT_LEVELS)[number];

export const BOUNDARY_REVIEW_STATUSES = [
  'REVIEWED',
  'NOT_REVIEWED',
  'SOURCE_REQUIRED',
] as const;

export type BoundaryReviewStatus = (typeof BOUNDARY_REVIEW_STATUSES)[number];

export type GeoUnit = Readonly<{
  geo_id: StableEntityId;
  parent_geo_id: StableEntityId | null;
  level: GeoUnitLevel;
  country_iso2: string;
  country_iso3: string;
  subdivision_code: string | null;
  local_name: string;
  zh_name: string;
  en_name: string | null;
  alternate_names: readonly string[];
  centroid_lat: number | null;
  centroid_lon: number | null;
  boundary_ref: string | null;
  boundary_review_status: BoundaryReviewStatus;
  timezone_ids: readonly string[];
  valid_from: string | null;
  valid_to: string | null;
  source_evidence_ids: readonly StableEntityId[];
}>;

export const OFFICIAL_RECOGNITION_STATUSES = [
  'OFFICIALLY_LISTED',
  'OFFICIAL_SOURCE_MENTIONED',
  'SOURCE_REQUIRED',
] as const;

export type OfficialRecognitionStatus = (typeof OFFICIAL_RECOGNITION_STATUSES)[number];

export type IndustryCluster = Readonly<{
  cluster_id: StableEntityId;
  canonical_name: string;
  alternate_names: readonly string[];
  geo_scope_ids: readonly StableEntityId[];
  cluster_type: 'REGIONAL_INDUSTRY_CLUSTER';
  official_recognition_status: OfficialRecognitionStatus;
  recognizing_authority: string;
  recognition_date: string | null;
  industry_category_ids: readonly string[];
  product_ids: readonly StableEntityId[];
  hs_mapping_ids: readonly string[];
  representative_company_ids: readonly StableEntityId[];
  coverage_status: 'PARTIAL' | 'REFERENCE_ONLY';
  coverage_note: string;
  source_evidence_ids: readonly StableEntityId[];
  last_verified_at: string | null;
  statistics_enabled: boolean;
  statistics_status: 'MAPPING_REVIEWED_NO_TRADE_DATA' | 'DISABLED_PENDING_HS_REVIEW';
}>;

export type ProductTaxonomyNode = Readonly<{
  product_id: StableEntityId;
  parent_product_id: StableEntityId | null;
  industry_category: string;
  local_name: string;
  zh_name: string;
  en_name: string | null;
  synonyms: readonly string[];
  process_tags: readonly string[];
  material_tags: readonly string[];
  hs2_candidates: readonly string[];
  hs4_candidates: readonly string[];
  hs6_candidates: readonly string[];
}>;

export type ProductHsMapping = Readonly<{
  mapping_id: string;
  product_id: StableEntityId;
  hs_version: 'HS 2012';
  hs_code: string;
  mapping_scope: 'HS2';
  mapping_status: 'REVIEWED';
  reviewer_or_authority: string;
  evidence_id: StableEntityId;
  valid_from: string | null;
  valid_to: string | null;
}>;

export const INDUSTRY_MAP_MODES = [
  'INDUSTRY_DISTRIBUTION',
  'COMPANY_FACILITY',
  'PRODUCT_FLOW',
  'LOGISTICS_NETWORK',
  'EVENT_IMPACT',
] as const;

export type IndustryMapMode = (typeof INDUSTRY_MAP_MODES)[number];

export const INDUSTRY_MAP_MODE_OPTIONS: readonly Readonly<{
  id: IndustryMapMode;
  label: string;
  implemented: boolean;
}>[] = Object.freeze([
  { id: 'INDUSTRY_DISTRIBUTION', label: '全球产业分布', implemented: true },
  { id: 'COMPANY_FACILITY', label: '企业与工厂', implemented: false },
  { id: 'PRODUCT_FLOW', label: '产品贸易流向', implemented: false },
  { id: 'LOGISTICS_NETWORK', label: '物流网络', implemented: false },
  { id: 'EVENT_IMPACT', label: '事件影响', implemented: false },
]);

type SeedDescriptor = Readonly<{
  legacy_id: string;
  geo_opaque_id: string;
  product_opaque_id: string;
  industry_category_id: string;
  synonyms: readonly string[];
}>;

const SEED_DESCRIPTORS: readonly SeedDescriptor[] = [
  { legacy_id: 'huidong-womens-footwear', geo_opaque_id: 'cn-guangdong-huidong', product_opaque_id: 'womens-footwear', industry_category_id: 'industry_footwear', synonyms: ['女鞋', '惠东女鞋', '鞋类'] },
  { legacy_id: 'putian-licheng-sports-footwear', geo_opaque_id: 'cn-fujian-licheng', product_opaque_id: 'sports-leisure-footwear', industry_category_id: 'industry_footwear', synonyms: ['运动休闲鞋', '莆田鞋', '鞋类'] },
  { legacy_id: 'miit-2024-haidian-robotics', geo_opaque_id: 'cn-beijing-haidian', product_opaque_id: 'robotics', industry_category_id: 'industry_robotics', synonyms: ['机器人'] },
  { legacy_id: 'miit-2024-miyun-measurement', geo_opaque_id: 'cn-beijing-miyun', product_opaque_id: 'measurement-control-equipment', industry_category_id: 'industry_measurement-control', synonyms: ['测控装备'] },
  { legacy_id: 'miit-2024-shunyi-aviation', geo_opaque_id: 'cn-beijing-shunyi', product_opaque_id: 'aviation-support-equipment', industry_category_id: 'industry_aviation-equipment', synonyms: ['航空装备配套'] },
  { legacy_id: 'miit-2024-xiqing-energy-equipment', geo_opaque_id: 'cn-tianjin-xiqing', product_opaque_id: 'energy-mining-equipment', industry_category_id: 'industry_energy-equipment', synonyms: ['能源矿产装备'] },
  { legacy_id: 'miit-2024-lubei-robotics', geo_opaque_id: 'cn-hebei-lubei', product_opaque_id: 'intelligent-special-purpose-robotics', industry_category_id: 'industry_robotics', synonyms: ['智能特种机器人'] },
  { legacy_id: 'miit-2024-anguo-herbal-medicine', geo_opaque_id: 'cn-hebei-anguo', product_opaque_id: 'herbal-medicine-deep-processing', industry_category_id: 'industry_health-products', synonyms: ['中药材精深加工'] },
  { legacy_id: 'miit-2024-xuanhua-geotechnical', geo_opaque_id: 'cn-hebei-xuanhua', product_opaque_id: 'geotechnical-engineering-equipment', industry_category_id: 'industry_engineering-equipment', synonyms: ['岩土工程装备'] },
  { legacy_id: 'miit-2024-cixian-chemical-material', geo_opaque_id: 'cn-hebei-cixian', product_opaque_id: 'circular-chemical-new-materials', industry_category_id: 'industry_new-materials', synonyms: ['循环化工新材料'] },
  { legacy_id: 'miit-2024-ningjin-cable', geo_opaque_id: 'cn-hebei-ningjin', product_opaque_id: 'low-voltage-renewable-cables', industry_category_id: 'industry_cables', synonyms: ['中低压电线电缆', '新能源电线电缆'] },
  { legacy_id: 'miit-2024-zaoqiang-fiberglass', geo_opaque_id: 'cn-hebei-zaoqiang', product_opaque_id: 'fiberglass-composites', industry_category_id: 'industry_composites', synonyms: ['玻璃纤维增强复合材料'] },
  { legacy_id: 'miit-2024-dingxiang-flange', geo_opaque_id: 'cn-shanxi-dingxiang', product_opaque_id: 'flange-forging', industry_category_id: 'industry_forging', synonyms: ['法兰锻造'] },
  { legacy_id: 'miit-2024-qingshan-pv', geo_opaque_id: 'cn-inner-mongolia-qingshan', product_opaque_id: 'photovoltaic-equipment', industry_category_id: 'industry_photovoltaic', synonyms: ['光伏装备'] },
  { legacy_id: 'miit-2024-taihe-alloy', geo_opaque_id: 'cn-liaoning-taihe', product_opaque_id: 'special-alloys', industry_category_id: 'industry_alloys', synonyms: ['特种合金'] },
  { legacy_id: 'miit-2024-pingfang-aviation', geo_opaque_id: 'cn-heilongjiang-pingfang', product_opaque_id: 'aviation-support', industry_category_id: 'industry_aviation-equipment', synonyms: ['航空配套'] },
  { legacy_id: 'miit-2024-xuhui-testing', geo_opaque_id: 'cn-shanghai-xuhui', product_opaque_id: 'inspection-testing-certification', industry_category_id: 'industry_testing-certification', synonyms: ['检验检测认证'] },
  { legacy_id: 'miit-2024-pudong-chip', geo_opaque_id: 'cn-shanghai-pudong', product_opaque_id: 'general-purpose-chip-design', industry_category_id: 'industry_semiconductors', synonyms: ['高端通用芯片设计', '芯片设计'] },
  { legacy_id: 'miit-2024-minhang-space-info', geo_opaque_id: 'cn-shanghai-minhang', product_opaque_id: 'geospatial-information', industry_category_id: 'industry_geospatial-information', synonyms: ['空间信息'] },
  { legacy_id: 'miit-2024-fengxian-cosmetics', geo_opaque_id: 'cn-shanghai-fengxian', product_opaque_id: 'cosmetics', industry_category_id: 'industry_cosmetics', synonyms: ['化妆品'] },
  { legacy_id: 'miit-2024-songjiang-satellite', geo_opaque_id: 'cn-shanghai-songjiang', product_opaque_id: 'satellite-internet', industry_category_id: 'industry_satellite-internet', synonyms: ['卫星互联网'] },
  { legacy_id: 'miit-2024-wuxi-mems', geo_opaque_id: 'cn-jiangsu-xinwu', product_opaque_id: 'iot-mems-sensors', industry_category_id: 'industry_sensors', synonyms: ['物联网微机电系统传感器', 'MEMS 传感器'] },
] as const;

const descriptorByLegacyId = new Map(SEED_DESCRIPTORS.map((descriptor) => [descriptor.legacy_id, descriptor]));

const sourceDefinitions: readonly Readonly<{
  source_id: StableEntityId;
  source: ChinaFactorySource;
  evidence_class: EvidenceClass;
  aggregation_level: AggregationLevel;
}>[] = [
  {
    source_id: createStableEntityId('source', 'cn-miit-2024-sme-clusters'),
    source: CHINA_FACTORY_REFERENCE_CLUSTERS[0]!.source,
    evidence_class: 'OFFICIAL_REGISTRY',
    aggregation_level: 'COUNTY_DISTRICT',
  },
  {
    source_id: createStableEntityId('source', 'cn-huidong-2020-government-report'),
    source: CHINA_FACTORY_REVIEWED_CLUSTERS[0]!.source,
    evidence_class: 'OFFICIAL_CLUSTER',
    aggregation_level: 'COUNTY_DISTRICT',
  },
  {
    source_id: createStableEntityId('source', 'cn-fujian-putian-footwear-2025'),
    source: CHINA_FACTORY_REVIEWED_CLUSTERS[1]!.source,
    evidence_class: 'OFFICIAL_CLUSTER',
    aggregation_level: 'COUNTY_DISTRICT',
  },
  {
    source_id: createStableEntityId('source', 'un-hs2012-chapter-64'),
    source: CHINA_FACTORY_REVIEWED_CLUSTERS[0]!.hsMappings[0]!.source,
    evidence_class: 'OFFICIAL_REGISTRY',
    aggregation_level: 'GLOBAL',
  },
] as const;

const sourceIdByUrl = new Map(sourceDefinitions.map((definition) => [definition.source.url, definition.source_id]));

function explainedNull(code: EvidenceNullReasonCode, explanation: string) {
  return { code, explanation } as const;
}

function createSourceEvidence(definition: (typeof sourceDefinitions)[number]): SourceEvidence {
  const evidence: SourceEvidence = {
    sourceId: definition.source_id,
    providerId: `public-source:${new URL(definition.source.url).hostname}`,
    sourceType: 'PUBLIC_OFFICIAL_WEB_DOCUMENT',
    sourceTitle: definition.source.title,
    sourceUrl: definition.source.url,
    sourceReference: null,
    sourcePublishedAt: definition.source.publishedAt,
    observedAt: null,
    retrievedAt: null,
    validFrom: null,
    validTo: null,
    periodStart: null,
    periodEnd: null,
    evidenceClass: definition.evidence_class,
    aggregationLevel: definition.aggregation_level,
    licenseStatus: 'REVIEW_REQUIRED',
    freshnessStatus: 'NOT_APPLICABLE',
    qualityStatus: 'VERIFIED',
    confidence: null,
    methodologyVersion: null,
    nullReasons: {
      sourceReference: explainedNull('NOT_PROVIDED', 'The source is identified by its public URL.'),
      ...(definition.source.publishedAt === null
        ? { sourcePublishedAt: explainedNull('NOT_PROVIDED', 'The classification page does not state a publication date.') }
        : {}),
      observedAt: explainedNull('NOT_APPLICABLE', 'This is a document statement, not a live observation.'),
      retrievedAt: explainedNull('UNKNOWN', 'The legacy registry did not retain retrieval time.'),
      validFrom: explainedNull('NOT_PROVIDED', 'The source does not state a validity start.'),
      validTo: explainedNull('NOT_PROVIDED', 'The source does not state a validity end.'),
      periodStart: explainedNull('NOT_APPLICABLE', 'No numeric observation period is attached.'),
      periodEnd: explainedNull('NOT_APPLICABLE', 'No numeric observation period is attached.'),
      confidence: explainedNull('NOT_APPLICABLE', 'Official statements are not assigned a model confidence.'),
      methodologyVersion: explainedNull('NOT_APPLICABLE', 'No model generated this statement.'),
    },
  };
  assertSourceEvidence(evidence);
  return evidence;
}

export const INDUSTRY_MAP_SOURCE_EVIDENCE: readonly SourceEvidence[] = Object.freeze(
  sourceDefinitions.map(createSourceEvidence),
);

function requireDescriptor(cluster: ChinaFactoryCluster): SeedDescriptor {
  const descriptor = descriptorByLegacyId.get(cluster.id);
  if (!descriptor) throw new Error(`Missing Phase 15 descriptor for China Factory seed ${cluster.id}`);
  return descriptor;
}

function clusterSourceId(cluster: ChinaFactoryCluster): StableEntityId {
  const sourceId = sourceIdByUrl.get(cluster.source.url);
  if (!sourceId) throw new Error(`Missing source evidence for China Factory seed ${cluster.id}`);
  return sourceId;
}

function hsSourceId(cluster: ChinaFactoryCluster): StableEntityId | null {
  const mapping = cluster.hsMappings[0];
  if (!mapping) return null;
  const sourceId = sourceIdByUrl.get(mapping.source.url);
  if (!sourceId) throw new Error(`Missing HS source evidence for China Factory seed ${cluster.id}`);
  return sourceId;
}

export const INDUSTRY_MAP_GEO_UNITS: readonly GeoUnit[] = Object.freeze(
  CHINA_FACTORY_CLUSTERS.map((cluster) => {
    const descriptor = requireDescriptor(cluster);
    return {
      geo_id: createStableEntityId('geo', descriptor.geo_opaque_id),
      parent_geo_id: null,
      level: 'COUNTY_DISTRICT',
      country_iso2: 'CN',
      country_iso3: 'CHN',
      subdivision_code: null,
      local_name: cluster.countyOrDistrict,
      zh_name: cluster.countyOrDistrict,
      en_name: null,
      alternate_names: Object.freeze([cluster.province, cluster.city, `${cluster.province}${cluster.city}${cluster.countyOrDistrict}`]),
      centroid_lat: null,
      centroid_lon: null,
      boundary_ref: null,
      boundary_review_status: 'NOT_REVIEWED',
      timezone_ids: Object.freeze(['Asia/Shanghai']),
      valid_from: null,
      valid_to: null,
      source_evidence_ids: Object.freeze([clusterSourceId(cluster)]),
    } satisfies GeoUnit;
  }),
);

export const INDUSTRY_MAP_PRODUCTS: readonly ProductTaxonomyNode[] = Object.freeze(
  CHINA_FACTORY_CLUSTERS.map((cluster) => {
    const descriptor = requireDescriptor(cluster);
    return {
      product_id: createStableEntityId('product', descriptor.product_opaque_id),
      parent_product_id: null,
      industry_category: descriptor.industry_category_id,
      local_name: cluster.productDescription,
      zh_name: cluster.productDescription,
      en_name: null,
      synonyms: Object.freeze([...new Set([cluster.productDescription, ...descriptor.synonyms])]),
      process_tags: Object.freeze([]),
      material_tags: Object.freeze([]),
      hs2_candidates: Object.freeze(cluster.hsMappings.map((mapping) => mapping.hs2)),
      hs4_candidates: Object.freeze([]),
      hs6_candidates: Object.freeze([]),
    } satisfies ProductTaxonomyNode;
  }),
);

export const INDUSTRY_MAP_HS_MAPPINGS: readonly ProductHsMapping[] = Object.freeze(
  CHINA_FACTORY_CLUSTERS.flatMap((cluster) => {
    const descriptor = requireDescriptor(cluster);
    const productId = createStableEntityId('product', descriptor.product_opaque_id);
    return cluster.hsMappings.map((mapping) => ({
      mapping_id: `mapping_${descriptor.product_opaque_id}-hs2012-${mapping.hs2}`,
      product_id: productId,
      hs_version: 'HS 2012',
      hs_code: mapping.hs2,
      mapping_scope: 'HS2',
      mapping_status: 'REVIEWED',
      reviewer_or_authority: 'WorldMonitor Phase 7 source review',
      evidence_id: hsSourceId(cluster)!,
      valid_from: null,
      valid_to: null,
    } satisfies ProductHsMapping));
  }),
);

const geoIdByLegacyId = new Map(CHINA_FACTORY_CLUSTERS.map((cluster) => {
  const descriptor = requireDescriptor(cluster);
  return [cluster.id, createStableEntityId('geo', descriptor.geo_opaque_id)] as const;
}));

const productIdByLegacyId = new Map(CHINA_FACTORY_CLUSTERS.map((cluster) => {
  const descriptor = requireDescriptor(cluster);
  return [cluster.id, createStableEntityId('product', descriptor.product_opaque_id)] as const;
}));

export const INDUSTRY_MAP_CLUSTERS: readonly IndustryCluster[] = Object.freeze(
  CHINA_FACTORY_CLUSTERS.map((cluster) => {
    const descriptor = requireDescriptor(cluster);
    const productId = productIdByLegacyId.get(cluster.id)!;
    const mappingIds = INDUSTRY_MAP_HS_MAPPINGS
      .filter((mapping) => mapping.product_id === productId)
      .map((mapping) => mapping.mapping_id);
    const sources = [clusterSourceId(cluster)];
    const hsEvidence = hsSourceId(cluster);
    if (hsEvidence) sources.push(hsEvidence);
    return {
      cluster_id: createStableEntityId('cluster', `cn-${cluster.id}`),
      canonical_name: cluster.name,
      alternate_names: Object.freeze([cluster.productDescription, cluster.countyOrDistrict, ...descriptor.synonyms]),
      geo_scope_ids: Object.freeze([geoIdByLegacyId.get(cluster.id)!]),
      cluster_type: 'REGIONAL_INDUSTRY_CLUSTER',
      official_recognition_status: cluster.id.startsWith('miit-2024-')
        ? 'OFFICIALLY_LISTED'
        : 'OFFICIAL_SOURCE_MENTIONED',
      recognizing_authority: cluster.source.publisher,
      recognition_date: null,
      industry_category_ids: Object.freeze([descriptor.industry_category_id]),
      product_ids: Object.freeze([productId]),
      hs_mapping_ids: Object.freeze(mappingIds),
      representative_company_ids: Object.freeze([]),
      coverage_status: cluster.statisticsEligible ? 'PARTIAL' : 'REFERENCE_ONLY',
      coverage_note: `${cluster.statisticsEligibilityReason} 未加载经审查行政边界、企业或工厂完整名录。`,
      source_evidence_ids: Object.freeze(sources),
      last_verified_at: null,
      statistics_enabled: cluster.statisticsEligible,
      statistics_status: cluster.statisticsEligible
        ? 'MAPPING_REVIEWED_NO_TRADE_DATA'
        : 'DISABLED_PENDING_HS_REVIEW',
    } satisfies IndustryCluster;
  }),
);

export const INDUSTRY_MAP_LEGACY_CLUSTER_ALIASES: Readonly<Record<string, StableEntityId>> = Object.freeze(
  Object.fromEntries(CHINA_FACTORY_CLUSTERS.map((cluster) => [
    cluster.id,
    createStableEntityId('cluster', `cn-${cluster.id}`),
  ])),
);

export type IndustryMapSearchResult = Readonly<{
  entity_type: 'INDUSTRY_CLUSTER';
  cluster_id: StableEntityId;
  geo_id: StableEntityId;
  title: string;
  location: string;
  products: readonly string[];
  coverage_status: IndustryCluster['coverage_status'];
  source_status: 'SOURCED';
  source_evidence_ids: readonly StableEntityId[];
}>;

const geoByIdIndex = new Map(INDUSTRY_MAP_GEO_UNITS.map((geo) => [geo.geo_id, geo]));
const productByIdIndex = new Map(INDUSTRY_MAP_PRODUCTS.map((product) => [product.product_id, product]));
const clusterByIdIndex = new Map(INDUSTRY_MAP_CLUSTERS.map((cluster) => [cluster.cluster_id, cluster]));
const sourceByIdIndex = new Map(INDUSTRY_MAP_SOURCE_EVIDENCE.map((source) => [source.sourceId, source]));

export function industryClusterById(id: string | null | undefined): IndustryCluster | null {
  return clusterByIdIndex.get(String(id ?? '').trim() as StableEntityId) ?? null;
}

export function industryGeoUnitById(id: string | null | undefined): GeoUnit | null {
  return geoByIdIndex.get(String(id ?? '').trim() as StableEntityId) ?? null;
}

export function industryProductById(id: string | null | undefined): ProductTaxonomyNode | null {
  return productByIdIndex.get(String(id ?? '').trim() as StableEntityId) ?? null;
}

export function industrySourceEvidenceById(id: string | null | undefined): SourceEvidence | null {
  return sourceByIdIndex.get(String(id ?? '').trim() as StableEntityId) ?? null;
}

export function industryClustersForGeo(geoId: string): readonly IndustryCluster[] {
  return INDUSTRY_MAP_CLUSTERS.filter((cluster) => cluster.geo_scope_ids.includes(geoId as StableEntityId));
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
}

export function searchIndustryMap(query: string): IndustryMapSearchResult[] {
  const normalized = normalizeSearchText(query);
  return INDUSTRY_MAP_CLUSTERS
    .map((cluster) => {
      const geo = industryGeoUnitById(cluster.geo_scope_ids[0])!;
      const products = cluster.product_ids.map((id) => industryProductById(id)!).filter(Boolean);
      const haystack = normalizeSearchText([
        cluster.canonical_name,
        ...cluster.alternate_names,
        geo.local_name,
        ...geo.alternate_names,
        ...products.flatMap((product) => [product.local_name, product.zh_name, ...product.synonyms]),
      ].join('|'));
      return {
        match: normalized.length === 0 || haystack.includes(normalized),
        result: {
          entity_type: 'INDUSTRY_CLUSTER',
          cluster_id: cluster.cluster_id,
          geo_id: geo.geo_id,
          title: cluster.canonical_name,
          location: geo.alternate_names[geo.alternate_names.length - 1] ?? geo.local_name,
          products: Object.freeze(products.map((product) => product.zh_name)),
          coverage_status: cluster.coverage_status,
          source_status: 'SOURCED',
          source_evidence_ids: cluster.source_evidence_ids,
        } satisfies IndustryMapSearchResult,
      };
    })
    .filter((item) => item.match)
    .map((item) => item.result)
    .sort((left, right) => {
      const coverageRank = { PARTIAL: 0, REFERENCE_ONLY: 1 } as const;
      return coverageRank[left.coverage_status] - coverageRank[right.coverage_status]
        || left.title.localeCompare(right.title, 'zh-CN');
    });
}

export function validateIndustryMapRegistry(): string[] {
  const errors: string[] = [];
  if (CHINA_FACTORY_CLUSTERS.length !== 22) errors.push('The source registry must contain exactly 22 seeds');
  if (INDUSTRY_MAP_CLUSTERS.length !== 22) errors.push('The Phase 15 cluster registry must contain exactly 22 seeds');
  if (INDUSTRY_MAP_GEO_UNITS.length !== 22) errors.push('Every seed must resolve to one GeoUnit');
  if (INDUSTRY_MAP_HS_MAPPINGS.length !== 2) errors.push('Only Huidong and Putian may have reviewed HS mappings');

  const referenceIds = new Set(CHINA_FACTORY_REFERENCE_CLUSTERS.map((cluster) => `cluster_cn-${cluster.id}`));
  for (const geo of INDUSTRY_MAP_GEO_UNITS) {
    if (!isStableEntityId(geo.geo_id) || !geo.geo_id.startsWith('geo_')) errors.push(`Invalid GeoUnit ID ${geo.geo_id}`);
    if (geo.boundary_review_status !== 'REVIEWED' && geo.boundary_ref !== null) {
      errors.push(`${geo.geo_id} has an unreviewed boundary reference`);
    }
    if ((geo.centroid_lat === null) !== (geo.centroid_lon === null)) errors.push(`${geo.geo_id} has a partial centroid`);
  }
  for (const cluster of INDUSTRY_MAP_CLUSTERS) {
    if (!isStableEntityId(cluster.cluster_id) || !cluster.cluster_id.startsWith('cluster_')) {
      errors.push(`Invalid IndustryCluster ID ${cluster.cluster_id}`);
    }
    if (cluster.source_evidence_ids.length === 0) errors.push(`${cluster.cluster_id} has no source evidence`);
    if (referenceIds.has(cluster.cluster_id)) {
      if (cluster.statistics_enabled) errors.push(`${cluster.cluster_id} reference seed enabled statistics`);
      if (cluster.hs_mapping_ids.length > 0) errors.push(`${cluster.cluster_id} reference seed has an HS mapping`);
    }
  }
  for (const mapping of INDUSTRY_MAP_HS_MAPPINGS) {
    if (mapping.hs_code !== '64' || mapping.mapping_scope !== 'HS2' || mapping.mapping_status !== 'REVIEWED') {
      errors.push(`${mapping.mapping_id} is not the reviewed HS 64 chapter mapping`);
    }
    if (!sourceByIdIndex.has(mapping.evidence_id)) errors.push(`${mapping.mapping_id} has unknown evidence`);
  }
  return errors;
}
