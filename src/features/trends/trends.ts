import { PRIMARY_BRAND } from '@/config/brand';
import { providerOperationsUrl } from '@/features/provider-operations/provider-operations-route';
import {
  DEFAULT_TREND_ENGINE_CONFIG,
  EMPTY_TREND_SNAPSHOTS,
  TREND_REALTIME_PROVIDER,
  TREND_STATES,
} from '../../../shared/trend-engine';
import { connectTrendRealtime } from '@/services/trend-realtime';
import { parseTrendsRoute } from './trends-route';
import './trends.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function initTrendsWorkspace(rootId = 'app'): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Trends root #${rootId} was not found.`);
  root.className = 'trends';
  const route = parseTrendsRoute(location.pathname);
  const page = el('main', 'trends__shell');
  const header = el('header', 'trends__header');
  const title = el('div');
  title.append(el('p', 'trends__eyebrow', PRIMARY_BRAND), el('h1', undefined, route.kind === 'detail' ? '趋势详情' : '跨平台热度与爆发'));
  title.append(el('p', 'trends__subtitle', `确定性算法 ${DEFAULT_TREND_ENGINE_CONFIG.algorithm_version} · 内容唯一性、独立作者、平台、大账号集中度、速度与加速度均可解释。`));
  const nav = el('nav', 'trends__nav');
  const operations = el('a', undefined, 'Provider 运维');
  operations.href = providerOperationsUrl();
  const home = el('a', undefined, '趋势首页');
  home.href = '/trends';
  nav.append(home, operations);
  header.append(title, nav);
  page.append(header);

  const provider = el('section', 'trends__provider');
  provider.dataset.status = TREND_REALTIME_PROVIDER.status;
  const providerStatus = el('strong', undefined, '实时 SSE：Provider 未配置');
  provider.append(providerStatus);
  provider.append(el('p', undefined, '生产环境不会连接测试流或显示 fixture。授权内容 Provider、服务端 SSE 端点和许可全部就绪后才可启用。'));
  page.append(provider);
  connectTrendRealtime({
    endpoint: TREND_REALTIME_PROVIDER.endpoint,
    onStatus(status) {
      provider.dataset.status = status;
      providerStatus.textContent = status === 'NOT_CONFIGURED' ? '实时 SSE：Provider 未配置' : `实时 SSE：${status}`;
    },
    onSnapshot() {
      // The production Provider is fail-closed today. A later admitted
      // endpoint may update an owned snapshot store without changing this UI.
    },
  });

  if (route.kind === 'detail') {
    const snapshot = EMPTY_TREND_SNAPSHOTS.find((item) => item.event_id === route.eventId);
    const detail = el('section', 'trends__panel');
    detail.append(el('h2', undefined, snapshot ? '趋势快照' : 'SOURCE_REQUIRED'));
    detail.append(el('p', undefined, snapshot
      ? `事件 ${snapshot.event_id} · ${snapshot.points.length} 个窗口`
      : `没有事件 ${route.eventId || '(invalid)'} 的生产趋势数据；未知 ID 不会回退到测试事件。`));
    page.append(detail);
  } else {
    const states = el('section', 'trends__panel');
    states.append(el('h2', undefined, '状态机'));
    const stateList = el('div', 'trends__states');
    for (const state of TREND_STATES) stateList.append(el('span', undefined, state));
    states.append(stateList, el('p', undefined, '每次状态变化都保存阈值、分项和原因；COOLING 低于解决阈值后才进入 RESOLVED。'));
    page.append(states);

    const windows = el('section', 'trends__panel');
    windows.append(el('h2', undefined, '多窗口与评分解释'));
    const grid = el('div', 'trends__grid');
    for (const minutes of DEFAULT_TREND_ENGINE_CONFIG.windows_minutes) {
      const card = el('article');
      card.append(el('strong', undefined, minutes < 60 ? `${minutes} 分钟` : `${minutes / 60} 小时`));
      card.append(el('span', undefined, '当前无生产观测'));
      grid.append(card);
    }
    windows.append(grid);
    page.append(windows);

    const empty = el('section', 'trends__panel trends__empty');
    empty.append(el('h2', undefined, '当前无可计算事件'));
    empty.append(el('p', undefined, '新闻、X 与 B站 Provider 均未配置。页面不会用测试 SourceItem 填充热度、速度、加速度、传播路径或预警候选。'));
    page.append(empty);
  }
  root.replaceChildren(page);
}
