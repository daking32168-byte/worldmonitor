/**
 * Owned Phase 15 industry-map workspace.
 *
 * This surface renders only reviewed registry relationships. It intentionally
 * has no trade fetch and no fixture fallback: a reviewed HS association is not
 * a location-level trade observation.
 */

import { PRIMARY_BRAND } from '@/config/brand';
import {
  COMPANY_FACILITY_REGISTRY,
  companyById,
  companyFacilityCoverageForScope,
  facilityById,
  isProductionFacility,
  searchVerifiedCompaniesAndFacilities,
  verifiedEntitiesForScope,
  type Company,
  type CompanyFacilitySearchResult,
  type Facility,
} from '../../../shared/company-facility-registry';
import {
  INDUSTRY_MAP_CLUSTERS,
  INDUSTRY_MAP_HS_MAPPINGS,
  INDUSTRY_MAP_MODE_OPTIONS,
  industryClustersForGeo,
  industryGeoUnitById,
  industryProductById,
  industrySourceEvidenceById,
  searchIndustryMap,
  type IndustryCluster,
  type IndustryMapSearchResult,
} from '../../../shared/industry-map';
import {
  searchIndustrialSeedReviews,
  type IndustrialSeedReview,
} from '../../../shared/industrial-seed-review';
import {
  industryMapClusterUrl,
  industryMapCompanyUrl,
  industryMapFacilityUrl,
  industryMapLocationUrl,
  industryMapOverviewUrl,
  parseIndustryMapRoute,
  type IndustryMapRoute,
} from './industry-map-route';
import './industry-map.css';

type IndustryMapState = {
  route: IndustryMapRoute;
  query: string;
  mode: 'industry' | 'companies';
};

function modeFromLocation(route: IndustryMapRoute): IndustryMapState['mode'] {
  if (route.kind === 'company' || route.kind === 'facility') return 'companies';
  return new URLSearchParams(location.search).get('mode') === 'companies' ? 'companies' : 'industry';
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function navigate(root: HTMLElement, state: IndustryMapState, href: string): void {
  history.pushState({}, '', href);
  state.route = parseIndustryMapRoute(location.pathname);
  state.query = new URLSearchParams(location.search).get('q')?.trim() ?? '';
  state.mode = modeFromLocation(state.route);
  render(root, state);
}

function internalLink(
  root: HTMLElement,
  state: IndustryMapState,
  label: string,
  href: string,
  className = 'industry-map__link',
): HTMLAnchorElement {
  const link = element('a', className, label);
  link.href = href;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(root, state, href);
  });
  return link;
}

function badge(label: string, tone: 'source' | 'partial' | 'reference' | 'unavailable'): HTMLElement {
  const node = element('span', `industry-map__badge industry-map__badge--${tone}`, label);
  return node;
}

function createModeBar(root: HTMLElement, state: IndustryMapState): HTMLElement {
  const section = element('section', 'industry-map__modes');
  section.setAttribute('aria-label', '产业地图模式');
  for (const mode of INDUSTRY_MAP_MODE_OPTIONS) {
    const control = element('button', 'industry-map__mode', mode.label);
    control.type = 'button';
    control.dataset.mode = mode.id;
    control.disabled = !mode.implemented;
    const selected = mode.id === 'INDUSTRY_DISTRIBUTION'
      ? state.mode === 'industry'
      : mode.id === 'COMPANY_FACILITY' && state.mode === 'companies';
    control.setAttribute('aria-pressed', String(selected));
    if (mode.implemented) {
      control.addEventListener('click', () => navigate(
        root,
        state,
        industryMapOverviewUrl(state.query, mode.id === 'COMPANY_FACILITY' ? 'companies' : 'industry'),
      ));
    }
    if (!mode.implemented) {
      control.title = '后续阶段启用；当前没有足够来源支持该模式。';
      control.append(element('span', undefined, '来源待补'));
    }
    section.append(control);
  }
  return section;
}

function createSearchPanel(
  root: HTMLElement,
  state: IndustryMapState,
  clusterResults: readonly IndustryMapSearchResult[],
  entityResults: readonly CompanyFacilitySearchResult[],
  seedReviewResults: readonly IndustrialSeedReview[],
): HTMLElement {
  const aside = element('aside', 'industry-map__search-panel');
  const heading = element('div', 'industry-map__panel-heading');
  heading.append(element('p', 'industry-map__kicker', state.mode === 'companies' ? 'Verified entity search' : 'Cluster & product search'));
  heading.append(element('h2', undefined, state.mode === 'companies' ? '企业与生产基地' : '集群与产品'));
  aside.append(heading);

  const form = element('form', 'industry-map__search');
  const input = element('input');
  input.type = 'search';
  input.name = 'q';
  input.value = state.query;
  input.placeholder = state.mode === 'companies' ? '搜索经审核公司或生产基地…' : '搜索女鞋、机器人、芯片…';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', state.mode === 'companies' ? '搜索已验证企业或生产基地' : '搜索产业集群或产品');
  const submit = element('button', undefined, '搜索');
  submit.type = 'submit';
  form.append(input, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    navigate(root, state, industryMapOverviewUrl(input.value, state.mode));
  });
  aside.append(form);

  const visibleCount = state.mode === 'companies' ? entityResults.length : clusterResults.length + seedReviewResults.length;
  const summary = state.query
    ? `“${state.query}”找到 ${visibleCount} 条有来源记录。`
    : state.mode === 'companies'
      ? `当前事实库：${COMPANY_FACILITY_REGISTRY.companies.length} 家企业、${COMPANY_FACILITY_REGISTRY.facilities.length} 个生产/运营地点。未经来源审核的名称不会显示。`
      : `当前导入 ${clusterResults.length} 条产业种子，并维护 ${seedReviewResults.length} 条 Phase 18 全球来源审查；审查记录不等于完整覆盖。`;
  aside.append(element('p', 'industry-map__summary', summary));

  const list = element('div', 'industry-map__results');
  list.setAttribute('aria-live', 'polite');
  if (visibleCount === 0) {
    const empty = element('div', 'industry-map__empty');
    empty.append(element('strong', undefined, 'SOURCE_REQUIRED'));
    empty.append(element('p', undefined, state.mode === 'companies'
      ? '没有经来源审核的企业或生产基地记录；股票名、办公室列表和搜索结果不会自动升级为事实。'
      : '没有可验证来源支持该查询；不会生成候选集群、生产基地或排名。'));
    list.append(empty);
  }
  for (const result of clusterResults) {
    const card = internalLink(root, state, result.title, industryMapClusterUrl(result.cluster_id), 'industry-map__result');
    card.replaceChildren();
    const labels = element('div', 'industry-map__result-labels');
    labels.append(
      badge('有来源', 'source'),
      badge(result.coverage_status === 'PARTIAL' ? '部分覆盖' : '仅参考', result.coverage_status === 'PARTIAL' ? 'partial' : 'reference'),
    );
    card.append(labels, element('strong', undefined, result.title));
    card.append(element('span', undefined, result.location));
    card.append(element('small', undefined, result.products.join(' · ')));
    list.append(card);
  }
  for (const review of seedReviewResults) {
    const card = element('article', 'industry-map__result industry-map__review-result');
    const labels = element('div', 'industry-map__result-labels');
    labels.append(
      badge('Phase 18 来源审查', 'source'),
      badge(`${Math.round(review.review_coverage_rate * 100)}% 维度`, review.coverage_status === 'COMPLETE' ? 'partial' : 'reference'),
      badge('HS/贸易待审', 'unavailable'),
    );
    card.append(labels, element('strong', undefined, review.location_name));
    card.append(element('span', undefined, review.product_labels.join(' · ')));
    card.append(element('small', undefined, `已审：${review.reviewed_dimensions.join(' / ')} · 验证 ${review.last_verified_at.slice(0, 10)}`));
    if (review.gaps[0]) card.append(element('small', 'industry-map__review-gap', review.gaps[0]));
    list.append(card);
  }
  for (const result of entityResults) {
    const href = result.entity_type === 'COMPANY'
      ? industryMapCompanyUrl(result.entity_id)
      : industryMapFacilityUrl(result.entity_id);
    const card = internalLink(root, state, result.title, href, 'industry-map__result');
    card.replaceChildren();
    const labels = element('div', 'industry-map__result-labels');
    labels.append(badge('有来源', 'source'), badge(result.coverage_tier, 'partial'));
    card.append(labels, element('strong', undefined, result.title));
    card.append(element('span', undefined, result.subtitle));
    card.append(element('small', undefined, `${result.source_evidence_ids.length} 条来源证据`));
    list.append(card);
  }
  aside.append(list);
  return aside;
}

function provinceForCluster(cluster: IndustryCluster): string {
  const geo = industryGeoUnitById(cluster.geo_scope_ids[0]);
  return geo?.alternate_names[0] ?? '范围待审查';
}

function createDistributionSurface(root: HTMLElement, state: IndustryMapState): HTMLElement {
  const section = element('section', 'industry-map__distribution');
  const header = element('div', 'industry-map__surface-header');
  const title = element('div');
  title.append(element('p', 'industry-map__kicker', 'INDUSTRY_DISTRIBUTION'));
  title.append(element('h2', undefined, '产业分布基础模式'));
  header.append(title, badge('边界不可用', 'unavailable'));
  section.append(header);

  const warning = element('div', 'industry-map__boundary-state');
  warning.append(element('strong', undefined, '未装载经审查行政边界或来源化坐标'));
  warning.append(element('p', undefined, '当前只按来源中的省 / 市 / 区县标签组织分布索引，不绘制点位或行政面，也不把目录位置解释为精确地理位置。'));
  section.append(warning);

  const surface = element('div', 'industry-map__surface');
  surface.setAttribute('role', 'img');
  surface.setAttribute('aria-label', '产业分布行政索引；不是经审查的地理边界地图');
  const provinceGroups = new Map<string, IndustryCluster[]>();
  for (const cluster of INDUSTRY_MAP_CLUSTERS) {
    const province = provinceForCluster(cluster);
    const group = provinceGroups.get(province);
    if (group) group.push(cluster);
    else provinceGroups.set(province, [cluster]);
  }
  for (const [province, clusters] of provinceGroups) {
    const group = element('section', 'industry-map__province');
    const groupHeading = element('div', 'industry-map__province-heading');
    groupHeading.append(element('strong', undefined, province), element('span', undefined, `${clusters.length} 条`));
    group.append(groupHeading);
    const markers = element('div', 'industry-map__markers');
    for (const cluster of clusters) {
      const geo = industryGeoUnitById(cluster.geo_scope_ids[0])!;
      const marker = element('button', 'industry-map__marker');
      marker.type = 'button';
      marker.title = cluster.canonical_name;
      marker.append(element('span', undefined, geo.local_name));
      marker.append(element('small', undefined, industryProductById(cluster.product_ids[0])?.zh_name ?? '产品待审查'));
      marker.addEventListener('click', () => navigate(root, state, industryMapClusterUrl(cluster.cluster_id)));
      markers.append(marker);
    }
    group.append(markers);
    surface.append(group);
  }
  section.append(surface);
  return section;
}

function createCompanyFacilitySurface(): HTMLElement {
  const section = element('section', 'industry-map__distribution');
  const header = element('div', 'industry-map__surface-header');
  const title = element('div');
  title.append(element('p', 'industry-map__kicker', 'COMPANY_FACILITY'));
  title.append(element('h2', undefined, '经审核企业与生产基地'));
  header.append(title, badge('SOURCE_REQUIRED', 'unavailable'));
  section.append(header);

  const warning = element('div', 'industry-map__boundary-state');
  warning.append(element('strong', undefined, '生产事实库尚未装载记录'));
  warning.append(element('p', undefined, 'Phase 16 已建立强制来源和关系边门禁；实际企业、总部、生产基地、品牌及上市主体要在后续逐条来源审核后才能进入。'));
  section.append(warning);

  const surface = element('div', 'industry-map__surface industry-map__entity-surface');
  const counts = [
    ['企业', COMPANY_FACILITY_REGISTRY.companies.length],
    ['生产/运营地点', COMPANY_FACILITY_REGISTRY.facilities.length],
    ['品牌', COMPANY_FACILITY_REGISTRY.brands.length],
    ['证券（MIC + ticker）', COMPANY_FACILITY_REGISTRY.securities.length],
  ] as const;
  for (const [label, value] of counts) {
    const card = element('article', 'industry-map__entity-stat');
    card.append(element('strong', undefined, String(value)), element('span', undefined, label));
    surface.append(card);
  }
  const boundary = element('article', 'industry-map__coverage-boundary');
  boundary.append(element('h3', undefined, '覆盖率边界'));
  boundary.append(element('p', undefined, '没有经审查的企业/生产基地总数分母，覆盖率保持不可计算；0 条已验证记录不等于当地不存在企业。'));
  boundary.append(element('p', undefined, '总部地点与生产地点分开建模；公司、品牌、上市主体和证券也不会互相替代。'));
  surface.append(boundary);
  section.append(surface);
  return section;
}

function addDefinition(list: HTMLDListElement, label: string, value: string | HTMLElement): void {
  list.append(element('dt', undefined, label));
  const body = element('dd');
  if (typeof value === 'string') body.textContent = value;
  else body.append(value);
  list.append(body);
}

function createEntityEvidenceList(sourceIds: readonly string[]): HTMLElement {
  const section = element('section', 'industry-map__detail-section');
  section.append(element('h3', undefined, '实体与关系来源'));
  if (sourceIds.length === 0) {
    section.append(element('p', 'industry-map__empty-copy', '没有可显示的来源；该记录不能进入事实列表。'));
    return section;
  }
  for (const sourceId of sourceIds) {
    const source = COMPANY_FACILITY_REGISTRY.evidence.find((item) => item.sourceId === sourceId);
    if (!source) continue;
    const card = element('article', 'industry-map__source-card');
    card.append(badge(source.evidenceClass, 'source'));
    const link = element('a', undefined, source.sourceTitle);
    if (source.sourceUrl) {
      link.href = source.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    card.append(link, element('span', undefined, `${source.aggregationLevel} · ${source.sourcePublishedAt ?? '发布日期未提供'}`));
    section.append(card);
  }
  return section;
}

function createEntityCoverageSection(
  root: HTMLElement,
  state: IndustryMapState,
  scopeId: string,
): HTMLElement {
  const coverage = companyFacilityCoverageForScope(scopeId as Parameters<typeof companyFacilityCoverageForScope>[0]);
  const entities = verifiedEntitiesForScope(scopeId as Parameters<typeof verifiedEntitiesForScope>[0]);
  const section = element('section', 'industry-map__detail-section industry-map__entity-coverage');
  section.append(element('h3', undefined, '已验证企业与生产基地覆盖'));
  const stats = element('dl', 'industry-map__definitions');
  addDefinition(stats, '已验证企业', String(coverage.verified_company_count));
  addDefinition(stats, '已验证生产/运营地点', String(coverage.verified_facility_count));
  addDefinition(stats, '覆盖等级', coverage.coverage_tier ?? 'UNKNOWN');
  addDefinition(stats, '来源数量', String(coverage.source_count));
  addDefinition(stats, '最后验证', coverage.last_verified_at ?? '尚无记录');
  addDefinition(stats, '覆盖率', coverage.coverage_rate === null ? '不可计算（缺少分母）' : `${coverage.coverage_rate}%`);
  addDefinition(stats, '完整覆盖', coverage.complete ? '是' : '否');
  section.append(stats, element('p', 'industry-map__empty-copy', coverage.gap_note));
  for (const company of entities.companies) {
    section.append(internalLink(root, state, company.canonical_name, industryMapCompanyUrl(company.company_id), 'industry-map__detail-link'));
  }
  for (const facility of entities.facilities) {
    section.append(internalLink(root, state, facility.facility_name, industryMapFacilityUrl(facility.facility_id), 'industry-map__detail-link'));
  }
  return section;
}

function createSourceList(cluster: IndustryCluster): HTMLElement {
  const section = element('section', 'industry-map__detail-section');
  section.append(element('h3', undefined, '来源证据'));
  for (const sourceId of cluster.source_evidence_ids) {
    const source = industrySourceEvidenceById(sourceId);
    if (!source) continue;
    const card = element('article', 'industry-map__source-card');
    card.append(badge(source.evidenceClass, 'source'));
    const link = element('a', undefined, source.sourceTitle);
    if (source.sourceUrl) {
      link.href = source.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    card.append(link);
    card.append(element('span', undefined, `${source.aggregationLevel} · ${source.sourcePublishedAt ?? '发布日期未提供'} · 许可需复核`));
    section.append(card);
  }
  return section;
}

function createClusterDetail(root: HTMLElement, state: IndustryMapState, cluster: IndustryCluster): HTMLElement {
  const detail = element('article', 'industry-map__detail');
  const geo = industryGeoUnitById(cluster.geo_scope_ids[0])!;
  const products = cluster.product_ids.map((id) => industryProductById(id)).filter((item) => item !== null);
  const mappings = INDUSTRY_MAP_HS_MAPPINGS.filter((mapping) => cluster.hs_mapping_ids.includes(mapping.mapping_id));
  detail.append(element('p', 'industry-map__kicker', 'IndustryCluster'));
  detail.append(element('h2', undefined, cluster.canonical_name));
  const badges = element('div', 'industry-map__detail-badges');
  badges.append(
    badge('有来源', 'source'),
    badge(cluster.coverage_status === 'PARTIAL' ? '部分覆盖' : '仅参考', cluster.coverage_status === 'PARTIAL' ? 'partial' : 'reference'),
  );
  detail.append(badges);

  const definitions = element('dl', 'industry-map__definitions');
  addDefinition(definitions, '地点', internalLink(root, state, `${geo.alternate_names[0]} / ${geo.alternate_names[1]} / ${geo.local_name}`, industryMapLocationUrl(geo.geo_id)));
  addDefinition(definitions, '产品', products.map((product) => product.zh_name).join(' · '));
  addDefinition(definitions, '官方状态', cluster.official_recognition_status);
  addDefinition(definitions, '确认来源', cluster.recognizing_authority);
  addDefinition(definitions, '统计状态', cluster.statistics_status === 'MAPPING_REVIEWED_NO_TRADE_DATA'
    ? 'HS 映射已审查；当前没有地点级贸易观测'
    : '统计禁用：待逐项审核 HS 映射');
  detail.append(definitions);

  const coverage = element('section', 'industry-map__detail-section');
  coverage.append(element('h3', undefined, '来源、覆盖与缺口'));
  coverage.append(element('p', undefined, cluster.coverage_note));
  coverage.append(element('p', 'industry-map__boundary-note', 'BOUNDARY NOT REVIEWED：当前 GeoUnit 没有经审查 boundary_ref 和 centroid；地图拒绝绘制位置或行政面。'));
  detail.append(coverage, createEntityCoverageSection(root, state, cluster.cluster_id));

  const hs = element('section', 'industry-map__detail-section');
  hs.append(element('h3', undefined, '产品与 HS 映射'));
  if (mappings.length === 0) {
    hs.append(element('p', 'industry-map__empty-copy', '没有经审查 HS 映射；不得启用贸易金额、重量、目的国或港口统计。'));
  } else {
    for (const mapping of mappings) {
      const row = element('div', 'industry-map__hs-row');
      row.append(badge('REVIEWED', 'source'));
      row.append(element('strong', undefined, `${mapping.hs_version} · HS${mapping.hs_code}`));
      row.append(element('span', undefined, `${mapping.mapping_scope} · ${mapping.reviewer_or_authority}`));
      hs.append(row);
    }
  }
  detail.append(hs);

  const trade = element('section', 'industry-map__detail-section industry-map__no-trade');
  trade.append(element('h3', undefined, '贸易数据'));
  trade.append(badge('UNAVAILABLE', 'unavailable'));
  trade.append(element('p', undefined, `没有与 ${geo.local_name}、所选产品和期间同层级匹配的贸易观测，因此本页不显示金额、重量、目的国、港口或排名数字。HS 映射本身不是贸易事实。`));
  detail.append(trade, createSourceList(cluster));
  return detail;
}

function createLocationDetail(root: HTMLElement, state: IndustryMapState, route: Extract<IndustryMapRoute, { kind: 'location' }>): HTMLElement {
  const detail = element('article', 'industry-map__detail');
  const clusters = industryClustersForGeo(route.geo.geo_id);
  detail.append(element('p', 'industry-map__kicker', 'GeoUnit'));
  detail.append(element('h2', undefined, route.geo.zh_name));
  detail.append(badge('边界未审查', 'unavailable'));
  const definitions = element('dl', 'industry-map__definitions');
  addDefinition(definitions, '层级', route.geo.level);
  addDefinition(definitions, '国家', `${route.geo.country_iso2} / ${route.geo.country_iso3}`);
  addDefinition(definitions, '边界状态', route.geo.boundary_review_status);
  addDefinition(definitions, '坐标', '未提供；不会生成近似点位');
  detail.append(definitions);
  const section = element('section', 'industry-map__detail-section');
  section.append(element('h3', undefined, '有来源产业集群'));
  for (const cluster of clusters) {
    section.append(internalLink(root, state, cluster.canonical_name, industryMapClusterUrl(cluster.cluster_id), 'industry-map__detail-link'));
  }
  detail.append(section, createEntityCoverageSection(root, state, route.geo.geo_id));
  return detail;
}

function createCompanyDetail(root: HTMLElement, state: IndustryMapState, company: Company): HTMLElement {
  const detail = element('article', 'industry-map__detail');
  detail.append(element('p', 'industry-map__kicker', 'Company'));
  detail.append(element('h2', undefined, company.canonical_name));
  detail.append(badge(company.coverage_tier, 'source'));
  const definitions = element('dl', 'industry-map__definitions');
  addDefinition(definitions, '法定名称', company.legal_name);
  addDefinition(definitions, '注册身份', `${company.registration_country} · ${company.registration_number}`);
  addDefinition(definitions, '企业类型', company.company_type);
  addDefinition(definitions, '上市状态', company.listed_status);
  addDefinition(definitions, '最后验证', company.last_verified_at);
  detail.append(definitions);

  const headquarters = element('section', 'industry-map__detail-section');
  headquarters.append(element('h3', undefined, '总部（不是生产基地）'));
  const headquartersGeo = company.headquarters_geo_id ? industryGeoUnitById(company.headquarters_geo_id) : null;
  headquarters.append(headquartersGeo
    ? internalLink(root, state, headquartersGeo.zh_name, industryMapLocationUrl(headquartersGeo.geo_id))
    : element('p', 'industry-map__empty-copy', '没有经来源审核的总部 GeoUnit。'));
  detail.append(headquarters);

  const facilities = COMPANY_FACILITY_REGISTRY.facilities.filter((facility) => facility.company_id === company.company_id);
  const facilitySection = element('section', 'industry-map__detail-section');
  facilitySection.append(element('h3', undefined, '已验证生产/运营地点'));
  if (facilities.length === 0) facilitySection.append(element('p', 'industry-map__empty-copy', '没有经来源审核的生产或运营地点；企业存在不等于已知其生产基地。'));
  for (const facility of facilities) {
    facilitySection.append(internalLink(
      root,
      state,
      `${facility.facility_name} · ${facility.facility_type}`,
      industryMapFacilityUrl(facility.facility_id),
      'industry-map__detail-link',
    ));
  }
  detail.append(facilitySection, createEntityEvidenceList(company.source_evidence_ids));
  return detail;
}

function createFacilityDetail(root: HTMLElement, state: IndustryMapState, facility: Facility): HTMLElement {
  const detail = element('article', 'industry-map__detail');
  const company = companyById(facility.company_id);
  const geo = industryGeoUnitById(facility.geo_id);
  detail.append(element('p', 'industry-map__kicker', 'Facility'));
  detail.append(element('h2', undefined, facility.facility_name));
  detail.append(badge(isProductionFacility(facility) ? '生产基地' : '非生产地点', isProductionFacility(facility) ? 'source' : 'reference'));
  const definitions = element('dl', 'industry-map__definitions');
  addDefinition(definitions, '地点类型', facility.facility_type);
  addDefinition(definitions, '运营状态', facility.operational_status);
  addDefinition(definitions, '运营企业', company
    ? internalLink(root, state, company.canonical_name, industryMapCompanyUrl(company.company_id))
    : facility.company_id);
  addDefinition(definitions, '地点', geo
    ? internalLink(root, state, geo.zh_name, industryMapLocationUrl(geo.geo_id))
    : facility.geo_id);
  addDefinition(definitions, '地址', facility.address ?? '来源未提供');
  addDefinition(definitions, '坐标', facility.lat === null ? '来源未提供；不会生成近似点位' : `${facility.lat}, ${facility.lon}`);
  addDefinition(definitions, '最后验证', facility.last_verified_at);
  detail.append(definitions);

  const products = element('section', 'industry-map__detail-section');
  products.append(element('h3', undefined, '有证据的产品关系'));
  if (facility.product_ids.length === 0) products.append(element('p', 'industry-map__empty-copy', '没有经来源审核的产品关系。'));
  for (const productId of facility.product_ids) {
    products.append(element('p', undefined, industryProductById(productId)?.zh_name ?? productId));
  }
  detail.append(products, createEntityEvidenceList(facility.source_evidence_ids));
  return detail;
}

function selectedCluster(route: IndustryMapRoute, results: readonly IndustryMapSearchResult[]): IndustryCluster | null {
  if (route.kind === 'cluster') return route.cluster;
  if (route.kind === 'location') return industryClustersForGeo(route.geo.geo_id)[0] ?? null;
  const first = results[0];
  return first ? INDUSTRY_MAP_CLUSTERS.find((cluster) => cluster.cluster_id === first.cluster_id) ?? null : null;
}

function createDetailPanel(
  root: HTMLElement,
  state: IndustryMapState,
  clusterResults: readonly IndustryMapSearchResult[],
  entityResults: readonly CompanyFacilitySearchResult[],
): HTMLElement {
  if (state.route.kind === 'not-found') {
    const detail = element('article', 'industry-map__detail industry-map__empty');
    detail.append(element('strong', undefined, '请求的产业地图实体不存在'));
    detail.append(element('p', undefined, '未知 ID 不会回退到另一条集群事实。'));
    detail.append(internalLink(root, state, '返回产业地图', industryMapOverviewUrl('', state.mode)));
    return detail;
  }
  if (state.route.kind === 'location') return createLocationDetail(root, state, state.route);
  if (state.route.kind === 'company') return createCompanyDetail(root, state, state.route.company);
  if (state.route.kind === 'facility') return createFacilityDetail(root, state, state.route.facility);
  if (state.mode === 'companies') {
    const first = entityResults[0];
    if (first?.entity_type === 'COMPANY') {
      const company = companyById(first.entity_id);
      if (company) return createCompanyDetail(root, state, company);
    }
    if (first?.entity_type === 'FACILITY') {
      const facility = facilityById(first.entity_id);
      if (facility) return createFacilityDetail(root, state, facility);
    }
    const detail = element('article', 'industry-map__detail industry-map__empty');
    detail.append(element('strong', undefined, '没有已验证企业或生产基地'));
    detail.append(element('p', undefined, '注册表和详情路由已经启用；在来源审核完成前，本页保持空状态。'));
    return detail;
  }
  const cluster = selectedCluster(state.route, clusterResults);
  if (cluster) return createClusterDetail(root, state, cluster);
  const detail = element('article', 'industry-map__detail industry-map__empty');
  detail.append(element('strong', undefined, '没有有来源的结果'));
  detail.append(element('p', undefined, '请调整查询；页面不会用 fixture 或猜测补齐。'));
  return detail;
}

function render(root: HTMLElement, state: IndustryMapState): void {
  const clusterResults = state.mode === 'industry' ? searchIndustryMap(state.query) : [];
  const entityResults = state.mode === 'companies' ? searchVerifiedCompaniesAndFacilities(state.query) : [];
  const seedReviewResults = state.mode === 'industry' ? searchIndustrialSeedReviews(state.query) : [];
  const page = element('main', 'industry-map');
  const header = element('header', 'industry-map__header');
  const title = element('div');
  title.append(element('p', 'industry-map__brand', PRIMARY_BRAND));
  title.append(element('h1', undefined, '全球产业情报地图'));
  title.append(element('p', 'industry-map__lede', '统一产业、地点、产品、企业和证券骨架 · 22 条既有种子 + 6 类全球来源审查，企业事实仍需逐边准入'));
  const actions = element('nav', 'industry-map__actions');
  actions.append(internalLink(root, state, '产业地图首页', industryMapOverviewUrl(), 'industry-map__button'));
  const home = element('a', 'industry-map__button', '返回全球看板');
  home.href = '/';
  actions.append(home);
  header.append(title, actions);

  const truth = element('section', 'industry-map__truth');
  truth.append(element('strong', undefined, '真实性边界'));
  truth.append(element('p', undefined, '产业名录、HS 映射、地点级贸易、企业/生产基地、品牌、证券、装运观测和模型路线彼此独立。只显示有来源且关系边可追溯的事实；缺失数据保持不可用。'));

  const workspace = element('div', 'industry-map__workspace');
  workspace.append(
    createSearchPanel(root, state, clusterResults, entityResults, seedReviewResults),
    state.mode === 'industry' ? createDistributionSurface(root, state) : createCompanyFacilitySurface(),
    createDetailPanel(root, state, clusterResults, entityResults),
  );
  page.append(header, truth, createModeBar(root, state), workspace);
  root.replaceChildren(page);
}

export function initIndustryMapWorkspace(rootId = 'app'): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Industry map root #${rootId} was not found.`);
  const state: IndustryMapState = {
    route: parseIndustryMapRoute(location.pathname),
    query: new URLSearchParams(location.search).get('q')?.trim() ?? '',
    mode: 'industry',
  };
  state.mode = modeFromLocation(state.route);
  window.addEventListener('popstate', () => {
    state.route = parseIndustryMapRoute(location.pathname);
    state.query = new URLSearchParams(location.search).get('q')?.trim() ?? '';
    state.mode = modeFromLocation(state.route);
    render(root, state);
  });
  render(root, state);
}
