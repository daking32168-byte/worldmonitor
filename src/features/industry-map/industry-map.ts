/**
 * Owned Phase 15 industry-map workspace.
 *
 * This surface renders only reviewed registry relationships. It intentionally
 * has no trade fetch and no fixture fallback: a reviewed HS association is not
 * a location-level trade observation.
 */

import { PRIMARY_BRAND } from '@/config/brand';
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
  industryMapClusterUrl,
  industryMapLocationUrl,
  industryMapOverviewUrl,
  parseIndustryMapRoute,
  type IndustryMapRoute,
} from './industry-map-route';
import './industry-map.css';

type IndustryMapState = {
  route: IndustryMapRoute;
  query: string;
};

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

function createModeBar(): HTMLElement {
  const section = element('section', 'industry-map__modes');
  section.setAttribute('aria-label', '产业地图模式');
  for (const mode of INDUSTRY_MAP_MODE_OPTIONS) {
    const control = element('button', 'industry-map__mode', mode.label);
    control.type = 'button';
    control.dataset.mode = mode.id;
    control.disabled = !mode.implemented;
    control.setAttribute('aria-pressed', String(mode.implemented));
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
  results: readonly IndustryMapSearchResult[],
): HTMLElement {
  const aside = element('aside', 'industry-map__search-panel');
  const heading = element('div', 'industry-map__panel-heading');
  heading.append(element('p', 'industry-map__kicker', 'Cluster & product search'));
  heading.append(element('h2', undefined, '集群与产品'));
  aside.append(heading);

  const form = element('form', 'industry-map__search');
  const input = element('input');
  input.type = 'search';
  input.name = 'q';
  input.value = state.query;
  input.placeholder = '搜索女鞋、机器人、芯片…';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', '搜索产业集群或产品');
  const submit = element('button', undefined, '搜索');
  submit.type = 'submit';
  form.append(input, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    navigate(root, state, industryMapOverviewUrl(input.value));
  });
  aside.append(form);

  const summary = state.query
    ? `“${state.query}”找到 ${results.length} 条有来源记录。`
    : `当前导入 ${results.length} 条有来源种子；全球其余地区仍是覆盖缺口。`;
  aside.append(element('p', 'industry-map__summary', summary));

  const list = element('div', 'industry-map__results');
  list.setAttribute('aria-live', 'polite');
  if (results.length === 0) {
    const empty = element('div', 'industry-map__empty');
    empty.append(element('strong', undefined, 'SOURCE_REQUIRED'));
    empty.append(element('p', undefined, '没有可验证来源支持该查询；不会生成候选集群、工厂或排名。'));
    list.append(empty);
  }
  for (const result of results) {
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

function addDefinition(list: HTMLDListElement, label: string, value: string | HTMLElement): void {
  list.append(element('dt', undefined, label));
  const body = element('dd');
  if (typeof value === 'string') body.textContent = value;
  else body.append(value);
  list.append(body);
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
  detail.append(coverage);

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
  detail.append(section);
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
  results: readonly IndustryMapSearchResult[],
): HTMLElement {
  if (state.route.kind === 'not-found') {
    const detail = element('article', 'industry-map__detail industry-map__empty');
    detail.append(element('strong', undefined, '请求的产业地图实体不存在'));
    detail.append(element('p', undefined, '未知 ID 不会回退到另一条集群事实。'));
    detail.append(internalLink(root, state, '返回产业地图', industryMapOverviewUrl()));
    return detail;
  }
  if (state.route.kind === 'location') return createLocationDetail(root, state, state.route);
  const cluster = selectedCluster(state.route, results);
  if (cluster) return createClusterDetail(root, state, cluster);
  const detail = element('article', 'industry-map__detail industry-map__empty');
  detail.append(element('strong', undefined, '没有有来源的结果'));
  detail.append(element('p', undefined, '请调整查询；页面不会用 fixture 或猜测补齐。'));
  return detail;
}

function render(root: HTMLElement, state: IndustryMapState): void {
  const results = searchIndustryMap(state.query);
  const page = element('main', 'industry-map');
  const header = element('header', 'industry-map__header');
  const title = element('div');
  title.append(element('p', 'industry-map__brand', PRIMARY_BRAND));
  title.append(element('h1', undefined, '全球产业情报地图'));
  title.append(element('p', 'industry-map__lede', '统一产业、地点、产品和来源骨架 · 当前经审查覆盖仅含中国 22 条种子'));
  const actions = element('nav', 'industry-map__actions');
  actions.append(internalLink(root, state, '产业地图首页', industryMapOverviewUrl(), 'industry-map__button'));
  const home = element('a', 'industry-map__button', '返回全球看板');
  home.href = '/';
  actions.append(home);
  header.append(title, actions);

  const truth = element('section', 'industry-map__truth');
  truth.append(element('strong', undefined, '真实性边界'));
  truth.append(element('p', undefined, '产业名录、HS 映射、地点级贸易、企业/工厂、装运观测和模型路线彼此独立。当前首版只显示有来源名录与经审查映射；缺失数据保持不可用。'));

  const workspace = element('div', 'industry-map__workspace');
  workspace.append(
    createSearchPanel(root, state, results),
    createDistributionSurface(root, state),
    createDetailPanel(root, state, results),
  );
  page.append(header, truth, createModeBar(), workspace);
  root.replaceChildren(page);
}

export function initIndustryMapWorkspace(rootId = 'app'): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Industry map root #${rootId} was not found.`);
  const state: IndustryMapState = {
    route: parseIndustryMapRoute(location.pathname),
    query: new URLSearchParams(location.search).get('q')?.trim() ?? '',
  };
  window.addEventListener('popstate', () => {
    state.route = parseIndustryMapRoute(location.pathname);
    state.query = new URLSearchParams(location.search).get('q')?.trim() ?? '';
    render(root, state);
  });
  render(root, state);
}
