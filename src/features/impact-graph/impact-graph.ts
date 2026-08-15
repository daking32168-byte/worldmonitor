import { PRIMARY_BRAND } from '@/config/brand';
import { globalContentRepository } from '@/services/global-content-repository';
import { impactGraphRepository } from '@/services/impact-graph-repository';
import type { ImpactPath } from '../../../shared/impact-graph';
import type { StableEntityId } from '../../../shared/global-intelligence-contract';
import { impactEventUrl, parseImpactGraphPath } from './impact-graph-route';
import './impact-graph.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function navLink(label: string, href: string): HTMLAnchorElement {
  const node = el('a', undefined, label);
  node.href = href;
  return node;
}

function pathCard(path: ImpactPath): HTMLElement {
  const card = el('article', 'impact-graph__path');
  card.dataset.kind = path.kind;
  card.append(el('span', 'impact-graph__badge', path.kind));
  const chain = el('ol', 'impact-graph__chain');
  path.nodes.forEach((node, index) => {
    const item = el('li');
    if (node.detail_path) item.append(navLink(`${node.node_type} · ${node.label}`, node.detail_path));
    else item.append(el('span', undefined, `${node.node_type} · ${node.label}`));
    const edge = path.edges[index];
    if (edge) item.append(el('small', undefined, `${edge.relationship_type} · ${edge.evidence_class} · 置信度 ${edge.confidence.toFixed(2)} · 证据 ${edge.source_evidence_ids.length}`));
    chain.append(item);
  });
  card.append(chain, el('p', 'impact-graph__explanation', path.explanation));
  return card;
}

export function initImpactGraphWorkspace(rootId = 'app'): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Impact graph root #${rootId} was not found`);
  const route = parseImpactGraphPath(window.location.pathname);
  if (!route) throw new Error('Invalid impact graph route');

  const page = el('main', 'impact-graph');
  const header = el('header', 'impact-graph__header');
  const title = el('div');
  title.append(
    el('p', 'impact-graph__eyebrow', PRIMARY_BRAND),
    el('h1', undefined, route.kind === 'EVENT' ? '事件影响路径' : '统一影响图谱'),
    el('p', undefined, '事件、地点、产业、产品、工厂、企业、证券与物流路径共用同一组可追溯关系。'),
  );
  const nav = el('nav', 'impact-graph__nav');
  nav.append(navLink('全球趋势', '/trends'), navLink('AI 推演', '/predictions'), navLink('个人情报中心', '/intelligence-center'), navLink('返回地球', '/'));
  header.append(title, nav);

  const content = el('div', 'impact-graph__content');
  const warning = el('section', 'impact-graph__panel impact-graph__warning');
  warning.append(
    el('strong', undefined, '事实与模型严格分层'),
    el('p', undefined, '事实边必须通过来源、许可和质量门禁；模型边仅表示潜在影响。证券路径不是已证明因果，也不是投资建议。'),
  );
  const summary = el('section', 'impact-graph__panel');
  summary.append(el('h2', undefined, '图谱状态'));
  const results = el('section', 'impact-graph__panel');
  results.append(el('h2', undefined, route.kind === 'EVENT' ? '直接、间接与模型影响' : '可追溯事件入口'));
  const list = el('div', 'impact-graph__list');
  results.append(list);
  content.append(warning, summary, results);
  page.append(header, content);
  root.replaceChildren(page);

  void Promise.all([impactGraphRepository.load(), globalContentRepository.listDisplayableEvents()]).then(async ([snapshot, events]) => {
    summary.append(el('p', undefined, `修订 ${snapshot.revision} · 节点 ${Object.keys(snapshot.nodes).length} · 边 ${Object.keys(snapshot.edges).length} · 来源证据 ${Object.keys(snapshot.evidence).length}`));
    if (route.kind === 'OVERVIEW') {
      if (events.length === 0) {
        list.append(el('p', 'impact-graph__empty', '尚无已授权且可展示的事件。系统不会用测试夹具或模型结果填充生产图谱。'));
        return;
      }
      for (const event of events) {
        const card = el('article', 'impact-graph__event');
        card.append(el('h3', undefined, event.title), el('p', undefined, `${event.status} · 截止 ${event.last_observed_at}`), navLink('查看可追溯影响', impactEventUrl(event.event_id)));
        list.append(card);
      }
      return;
    }

    const event = await globalContentRepository.getEvent(route.eventId);
    const eventNode = snapshot.nodes[route.eventId];
    const paths = await impactGraphRepository.pathsFrom(route.eventId as StableEntityId, { max_depth: 8, max_paths: 100, include_model_edges: true });
    const eventSummary = el('article', 'impact-graph__event');
    eventSummary.append(
      el('h3', undefined, event?.title ?? eventNode?.label ?? route.eventId),
      el('p', undefined, event ? `${event.status} · 首次 ${event.first_observed_at} · 截止 ${event.last_observed_at}` : '事件正文仓库未找到；仅显示仍可核验的图谱记录。'),
    );
    list.append(eventSummary);
    if (paths.length === 0) {
      list.append(el('p', 'impact-graph__empty', '该事件尚无通过证据门禁的影响路径；不会用推测补成事实。'));
      return;
    }
    for (const path of paths) list.append(pathCard(path));
  }).catch((error) => {
    summary.append(el('p', 'impact-graph__error', `影响图谱读取失败：${error instanceof Error ? error.message : 'unknown error'}`));
  });
}
