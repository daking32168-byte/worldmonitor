/** Phase 18 reviewed global industrial seed queue. */

import {
  assertEvidenceCanEnterFactTable,
  createStableEntityId,
  type AggregationLevel,
  type EvidenceClass,
  type SourceEvidence,
  type StableEntityId,
} from './global-intelligence-contract';

export const REVIEW_DIMENSIONS = ['GEOGRAPHY', 'PRODUCT', 'PROCESS', 'COMPANY', 'FACILITY'] as const;
export type ReviewDimension = (typeof REVIEW_DIMENSIONS)[number];

export type ReviewedCandidate = Readonly<{
  name: string;
  kind: 'COMPANY' | 'FACILITY' | 'SECURITY';
  status: 'REVIEWED_CLAIM' | 'SOURCE_REQUIRED';
  evidence_ids: readonly StableEntityId[];
  gap: string | null;
}>;

export type IndustrialSeedReview = Readonly<{
  case_id: string;
  geo_id: StableEntityId;
  location_name: string;
  country_code: string;
  aggregation_level: AggregationLevel;
  product_labels: readonly string[];
  process_labels: readonly string[];
  company_candidates: readonly ReviewedCandidate[];
  facility_candidates: readonly ReviewedCandidate[];
  security_candidates: readonly ReviewedCandidate[];
  evidence_ids: readonly StableEntityId[];
  reviewed_dimensions: readonly ReviewDimension[];
  review_coverage_rate: number;
  coverage_scope: 'FIVE_DIMENSION_SOURCE_REVIEW';
  coverage_status: 'PARTIAL' | 'COMPLETE';
  last_verified_at: string;
  hs_trade_status: 'SOURCE_REQUIRED';
  gaps: readonly string[];
}>;

const NA = (explanation: string) => ({ code: 'NOT_PROVIDED' as const, explanation });

function source(definition: Readonly<{
  id: string;
  provider: string;
  title: string;
  url: string;
  reference: string;
  publishedAt: string | null;
  evidenceClass: EvidenceClass;
  aggregationLevel: AggregationLevel;
}>): SourceEvidence {
  const evidence: SourceEvidence = Object.freeze({
    sourceId: createStableEntityId('source', definition.id),
    providerId: definition.provider,
    sourceType: 'OFFICIAL_WEB_PUBLICATION',
    sourceTitle: definition.title,
    sourceUrl: definition.url,
    sourceReference: definition.reference,
    sourcePublishedAt: definition.publishedAt,
    observedAt: '2026-08-15T00:00:00+08:00',
    retrievedAt: '2026-08-15T00:00:00+08:00',
    validFrom: null,
    validTo: null,
    periodStart: null,
    periodEnd: null,
    evidenceClass: definition.evidenceClass,
    aggregationLevel: definition.aggregationLevel,
    licenseStatus: 'VERIFIED',
    freshnessStatus: 'CURRENT',
    qualityStatus: 'VERIFIED',
    confidence: 1,
    methodologyVersion: 'phase18-source-review-v1',
    nullReasons: {
      ...(definition.publishedAt === null ? { sourcePublishedAt: NA('The official page does not expose a stable publication date.') } : {}),
      validFrom: NA('The publication does not define a fact-validity start.'),
      validTo: NA('The publication does not define a fact-validity end.'),
      periodStart: NA('This seed review contains no statistical observation period.'),
      periodEnd: NA('This seed review contains no statistical observation period.'),
    },
  });
  assertEvidenceCanEnterFactTable(evidence);
  return evidence;
}

export const INDUSTRIAL_SEED_SOURCE_EVIDENCE: readonly SourceEvidence[] = Object.freeze([
  source({
    id: 'phase18-wenzhou-shoes-2025', provider: 'wenzhou-government',
    title: '2025 Wenzhou Government Work Report',
    url: 'https://wzstb.wenzhou.gov.cn/art/2025/2/13/art_1229499910_58903225.html',
    reference: 'Wenzhou 2025 government work report: footwear industry cluster',
    publishedAt: '2025-02-13T00:00:00+08:00', evidenceClass: 'OFFICIAL_CLUSTER', aggregationLevel: 'CITY',
  }),
  source({
    id: 'phase18-jingdezhen-ceramics-2024', provider: 'jingdezhen-government',
    title: 'Jingdezhen manufacturing-chain modernization plan 2024-2026',
    url: 'https://jdz.gov.cn/zwgk/fdzdgknr/zcwj/zfwj/szfwj/t949845.shtml',
    reference: 'Official ceramic chain plan covering advanced, daily-use, artistic and architectural ceramics',
    publishedAt: null, evidenceClass: 'OFFICIAL_CLUSTER', aggregationLevel: 'CITY',
  }),
  source({
    id: 'phase18-dalang-knitwear-2025', provider: 'dongguan-dalang-government',
    title: 'Dalang Xiangtou community administrative profile',
    url: 'https://www.dg.gov.cn/dalang/gk/xzqh/content/post_4382594.html',
    reference: 'Official town page describing Xiangtou knitwear concentration and production/trade/logistics model',
    publishedAt: '2025-05-15T15:34:00+08:00', evidenceClass: 'OFFICIAL_CLUSTER', aggregationLevel: 'TOWN',
  }),
  source({
    id: 'phase18-shenzhen-byd-site-2024', provider: 'shenzhen-planning-natural-resources',
    title: 'BYD Shenzhen automobile production base site-plan notice',
    url: 'https://pnr.sz.gov.cn/xxgk/gggs/content/post_11883946.html',
    reference: 'Official planning notice names the operator, industrial land and Pingshan site',
    publishedAt: '2024-12-06T00:00:00+08:00', evidenceClass: 'OFFICIAL_REGISTRY', aggregationLevel: 'FACILITY',
  }),
  source({
    id: 'phase18-byd-annual-report-2024', provider: 'hkexnews',
    title: 'BYD Company Limited Annual Report 2024',
    url: 'https://www.hkexnews.hk/listedco/listconews/sehk/2025/0324/2025032401238.pdf',
    reference: 'Issuer filing supports BYD Company Limited identity and Shenzhen address',
    publishedAt: '2025-03-24T00:00:00+08:00', evidenceClass: 'COMPANY_DISCLOSED', aggregationLevel: 'COMPANY',
  }),
  source({
    id: 'phase18-byd-hkex-1211', provider: 'hkex',
    title: 'HKEX dual-counter circular naming BYD Company Limited 01211',
    url: 'https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2023/ce_SEHK_CT_080_2023.pdf',
    reference: 'Exchange publication supports issuer name and local ticker 01211 only',
    publishedAt: '2023-06-09T00:00:00+08:00', evidenceClass: 'OFFICIAL_REGISTRY', aggregationLevel: 'COMPANY',
  }),
  source({
    id: 'phase18-asml-identity', provider: 'asml',
    title: 'ASML corporate information',
    url: 'https://www.asml.com/en/terms-of-use',
    reference: 'ASML Holding N.V.; Veldhoven; Dutch Chamber of Commerce 17085815',
    publishedAt: null, evidenceClass: 'VERIFIED_COMPANY', aggregationLevel: 'COMPANY',
  }),
  source({
    id: 'phase18-asml-manufacturing-2025', provider: 'asml',
    title: 'ASML 2025 Annual Report - strategy and stories',
    url: 'https://www.asml.com/en/investors/annual-report/2025/strategy-and-stories',
    reference: 'Official report identifies Veldhoven as development, engineering and manufacturing hub for lithography systems',
    publishedAt: null, evidenceClass: 'VERIFIED_FACILITY', aggregationLevel: 'FACILITY',
  }),
  source({
    id: 'phase18-bmw-identity', provider: 'bmw-group',
    title: 'BMW Group legal imprint',
    url: 'https://www.einvoicing.bmwgroup.com/en/impressum.html',
    reference: 'BMW AG; Munich District Court commercial register HRB 42243',
    publishedAt: null, evidenceClass: 'VERIFIED_COMPANY', aggregationLevel: 'COMPANY',
  }),
  source({
    id: 'phase18-bmw-munich-plant', provider: 'bmw-group',
    title: 'BMW Group Plant Munich',
    url: 'https://www.bmwgroup-werke.com/content/grpw/websites/bmwgroup-werke_com/muenchen/en.html',
    reference: 'Official plant page supports Munich location and automotive production processes',
    publishedAt: null, evidenceClass: 'VERIFIED_FACILITY', aggregationLevel: 'FACILITY',
  }),
]);

const sourceId = (suffix: string): StableEntityId => createStableEntityId('source', suffix);

function review(definition: Omit<IndustrialSeedReview, 'review_coverage_rate' | 'coverage_scope' | 'coverage_status'>): IndustrialSeedReview {
  const uniqueDimensions = [...new Set(definition.reviewed_dimensions)];
  const rate = uniqueDimensions.length / REVIEW_DIMENSIONS.length;
  return Object.freeze({
    ...definition,
    reviewed_dimensions: Object.freeze(uniqueDimensions),
    review_coverage_rate: rate,
    coverage_scope: 'FIVE_DIMENSION_SOURCE_REVIEW',
    coverage_status: rate === 1 ? 'COMPLETE' : 'PARTIAL',
  });
}

export const GLOBAL_INDUSTRIAL_SEED_REVIEWS: readonly IndustrialSeedReview[] = Object.freeze([
  review({
    case_id: 'wenzhou-footwear', geo_id: createStableEntityId('geo', 'cn-zj-wenzhou'),
    location_name: '中国 · 浙江 · 温州', country_code: 'CN', aggregation_level: 'CITY',
    product_labels: ['鞋类'], process_labels: [], company_candidates: [], facility_candidates: [], security_candidates: [],
    evidence_ids: [sourceId('phase18-wenzhou-shoes-2025')], reviewed_dimensions: ['GEOGRAPHY', 'PRODUCT'],
    last_verified_at: '2026-08-15T00:00:00+08:00', hs_trade_status: 'SOURCE_REQUIRED',
    gaps: ['工艺、企业和生产设施尚未逐条审查；不得显示企业、工厂或出口数字。'],
  }),
  review({
    case_id: 'jingdezhen-ceramics', geo_id: createStableEntityId('geo', 'cn-jx-jingdezhen'),
    location_name: '中国 · 江西 · 景德镇', country_code: 'CN', aggregation_level: 'CITY',
    product_labels: ['先进陶瓷', '日用陶瓷', '陈设艺术陶瓷', '建筑卫生陶瓷'],
    process_labels: ['研发制造', '智能化与绿色化升级'], company_candidates: [], facility_candidates: [], security_candidates: [],
    evidence_ids: [sourceId('phase18-jingdezhen-ceramics-2024')], reviewed_dimensions: ['GEOGRAPHY', 'PRODUCT', 'PROCESS'],
    last_verified_at: '2026-08-15T00:00:00+08:00', hs_trade_status: 'SOURCE_REQUIRED',
    gaps: ['企业、设施和逐产品 HS 映射仍待审查。'],
  }),
  review({
    case_id: 'dongguan-dalang-knitwear', geo_id: createStableEntityId('geo', 'cn-gd-dongguan-dalang'),
    location_name: '中国 · 广东 · 东莞 · 大朗镇（巷头社区案例）', country_code: 'CN', aggregation_level: 'TOWN',
    product_labels: ['毛织', '纺织服装'], process_labels: ['研发', '生产', '展贸', '电商物流'],
    company_candidates: [], facility_candidates: [], security_candidates: [],
    evidence_ids: [sourceId('phase18-dalang-knitwear-2025')], reviewed_dimensions: ['GEOGRAPHY', 'PRODUCT', 'PROCESS'],
    last_verified_at: '2026-08-15T00:00:00+08:00', hs_trade_status: 'SOURCE_REQUIRED',
    gaps: ['这是东莞镇级案例，不代表东莞全部镇街；企业、工厂和出口记录仍为空。'],
  }),
  review({
    case_id: 'shenzhen-byd-manufacturing', geo_id: createStableEntityId('geo', 'cn-gd-shenzhen-pingshan'),
    location_name: '中国 · 广东 · 深圳 · 坪山区', country_code: 'CN', aggregation_level: 'COUNTY_DISTRICT',
    product_labels: ['新能源汽车'], process_labels: ['汽车制造', '风洞与综合服务'],
    company_candidates: [{ name: '比亚迪汽车工业有限公司', kind: 'COMPANY', status: 'SOURCE_REQUIRED', evidence_ids: [sourceId('phase18-shenzhen-byd-site-2024')], gap: '缺少本轮经核验注册号及其与上市主体的所有权关系来源。' }],
    facility_candidates: [{ name: '比亚迪深圳汽车生产基地', kind: 'FACILITY', status: 'REVIEWED_CLAIM', evidence_ids: [sourceId('phase18-shenzhen-byd-site-2024')], gap: null }],
    security_candidates: [{ name: 'BYD Company Limited · HKEX 01211', kind: 'SECURITY', status: 'SOURCE_REQUIRED', evidence_ids: [sourceId('phase18-byd-annual-report-2024'), sourceId('phase18-byd-hkex-1211')], gap: 'MIC、注册号以及上市主体到设施运营公司的所有权边尚未在同一审查链闭合。' }],
    evidence_ids: [sourceId('phase18-shenzhen-byd-site-2024'), sourceId('phase18-byd-annual-report-2024'), sourceId('phase18-byd-hkex-1211')],
    reviewed_dimensions: ['GEOGRAPHY', 'PRODUCT', 'PROCESS', 'COMPANY', 'FACILITY'],
    last_verified_at: '2026-08-15T00:00:00+08:00', hs_trade_status: 'SOURCE_REQUIRED',
    gaps: ['公开工厂关系已定位，但不得把运营子公司、上市主体和证券自动合并。'],
  }),
  review({
    case_id: 'netherlands-asml-lithography', geo_id: createStableEntityId('geo', 'nl-veldhoven'),
    location_name: '荷兰 · Veldhoven', country_code: 'NL', aggregation_level: 'CITY',
    product_labels: ['EUV 光刻系统', 'DUV 光刻系统'], process_labels: ['研发', '工程', '组装制造'],
    company_candidates: [{ name: 'ASML Holding N.V. · KvK 17085815', kind: 'COMPANY', status: 'REVIEWED_CLAIM', evidence_ids: [sourceId('phase18-asml-identity')], gap: null }],
    facility_candidates: [{ name: 'ASML Veldhoven manufacturing hub', kind: 'FACILITY', status: 'REVIEWED_CLAIM', evidence_ids: [sourceId('phase18-asml-manufacturing-2025')], gap: null }],
    security_candidates: [{ name: 'ASML listing relation', kind: 'SECURITY', status: 'SOURCE_REQUIRED', evidence_ids: [], gap: 'MIC-qualified listing evidence has not been admitted to the security registry.' }],
    evidence_ids: [sourceId('phase18-asml-identity'), sourceId('phase18-asml-manufacturing-2025')],
    reviewed_dimensions: ['GEOGRAPHY', 'PRODUCT', 'PROCESS', 'COMPANY', 'FACILITY'],
    last_verified_at: '2026-08-15T00:00:00+08:00', hs_trade_status: 'SOURCE_REQUIRED',
    gaps: ['精确边界、MIC 证券关系、逐产品 HS 映射和贸易观测仍待审查。'],
  }),
  review({
    case_id: 'germany-bmw-munich-auto', geo_id: createStableEntityId('geo', 'de-munich'),
    location_name: '德国 · 慕尼黑', country_code: 'DE', aggregation_level: 'CITY',
    product_labels: ['乘用车', '摩托车'], process_labels: ['车身制造', '涂装', '总装'],
    company_candidates: [{ name: 'BMW AG · HRB 42243', kind: 'COMPANY', status: 'REVIEWED_CLAIM', evidence_ids: [sourceId('phase18-bmw-identity')], gap: null }],
    facility_candidates: [{ name: 'BMW Group Plant Munich', kind: 'FACILITY', status: 'REVIEWED_CLAIM', evidence_ids: [sourceId('phase18-bmw-munich-plant')], gap: null }],
    security_candidates: [], evidence_ids: [sourceId('phase18-bmw-identity'), sourceId('phase18-bmw-munich-plant')],
    reviewed_dimensions: ['GEOGRAPHY', 'PRODUCT', 'PROCESS', 'COMPANY', 'FACILITY'],
    last_verified_at: '2026-08-15T00:00:00+08:00', hs_trade_status: 'SOURCE_REQUIRED',
    gaps: ['精确边界、证券关系、逐产品 HS 映射和贸易观测仍待审查。'],
  }),
]);

function normalized(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
}

export function searchIndustrialSeedReviews(query: string): readonly IndustrialSeedReview[] {
  const needle = normalized(query);
  if (!needle) return GLOBAL_INDUSTRIAL_SEED_REVIEWS;
  return GLOBAL_INDUSTRIAL_SEED_REVIEWS.filter((item) => normalized([
    item.case_id, item.location_name, ...item.product_labels, ...item.process_labels,
    ...item.company_candidates.map((candidate) => candidate.name),
    ...item.facility_candidates.map((candidate) => candidate.name),
  ].join(' ')).includes(needle));
}

export function industrialSeedReviewsForProduct(product: string): readonly IndustrialSeedReview[] {
  const needle = normalized(product);
  if (!needle) return [];
  return GLOBAL_INDUSTRIAL_SEED_REVIEWS.filter((item) => item.product_labels.some((label) => normalized(label).includes(needle)));
}

export function industrialSeedReviewByGeoId(geoId: StableEntityId): IndustrialSeedReview | null {
  return GLOBAL_INDUSTRIAL_SEED_REVIEWS.find((item) => item.geo_id === geoId) ?? null;
}

export function validateIndustrialSeedReviews(): string[] {
  const errors: string[] = [];
  const evidenceIds = new Set(INDUSTRIAL_SEED_SOURCE_EVIDENCE.map((item) => item.sourceId));
  const caseIds = new Set<string>();
  for (const item of GLOBAL_INDUSTRIAL_SEED_REVIEWS) {
    if (caseIds.has(item.case_id)) errors.push(`duplicate case ${item.case_id}`);
    caseIds.add(item.case_id);
    const expected = item.reviewed_dimensions.length / REVIEW_DIMENSIONS.length;
    if (item.review_coverage_rate !== expected) errors.push(`${item.case_id} review coverage is inconsistent`);
    if (item.hs_trade_status !== 'SOURCE_REQUIRED') errors.push(`${item.case_id} enabled trade without Phase 18 HS review`);
    if (item.evidence_ids.length === 0) errors.push(`${item.case_id} has no evidence`);
    for (const id of item.evidence_ids) if (!evidenceIds.has(id)) errors.push(`${item.case_id} references missing evidence ${id}`);
    for (const candidate of [...item.company_candidates, ...item.facility_candidates, ...item.security_candidates]) {
      if (candidate.status === 'REVIEWED_CLAIM' && candidate.evidence_ids.length === 0) errors.push(`${item.case_id} has an unsourced reviewed candidate`);
      if (candidate.status === 'SOURCE_REQUIRED' && !candidate.gap?.trim()) errors.push(`${item.case_id} has a SOURCE_REQUIRED candidate without a gap`);
      for (const id of candidate.evidence_ids) if (!evidenceIds.has(id)) errors.push(`${item.case_id} candidate references missing evidence ${id}`);
    }
  }
  return errors;
}

const validationErrors = validateIndustrialSeedReviews();
if (validationErrors.length > 0) throw new Error(`Invalid industrial seed review registry: ${validationErrors.join('; ')}`);
