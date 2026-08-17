import { PRIMARY_BRAND } from '@/config/brand';
import { providerOperationsUrl } from '@/features/provider-operations/provider-operations-route';
import {
  DEFAULT_TREND_ENGINE_CONFIG,
  EMPTY_TREND_SNAPSHOTS,
  TREND_REALTIME_PROVIDER,
  TREND_STATES,
  type TrendSnapshot,
} from '../../../shared/trend-engine';
import { connectTrendRealtime } from '@/services/trend-realtime';
import { globalContentRepository } from '@/services/global-content-repository';
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
  const content = el('div');
  page.append(provider, content);
  root.replaceChildren(page);

  const snapshots = new Map<string, TrendSnapshot>(EMPTY_TREND_SNAPSHOTS.map((snapshot) => [snapshot.event_id, snapshot]));

  const pointLabel = (minutes: number): string => {
    if (minutes < 60) return `${minutes} 分钟`;
    if (minutes < 1_440) return `${minutes / 60} 小时`;
    return `${minutes / 1_440} 天`;
  };

  const renderSnapshotDetail = (snapshot: TrendSnapshot): HTMLElement => {
    const fragment = el('div');
    const detail = el('section', 'trends__panel');
    detail.append(el('h2', undefined, '趋势快照'));
    detail.append(el('p', undefined, `事件 ${snapshot.event_id} · 截止 ${snapshot.as_of} · ${snapshot.points.length} 个窗口`));
    const grid = el('div', 'trends__grid');
    for (const point of snapshot.points) {
      const card = el('article');
      card.append(
        el('strong', undefined, `${pointLabel(point.window_minutes)} · ${point.state}`),
        el('span', undefined, `热度 ${point.heat_score} · 内容 ${point.unique_content_count} · 作者 ${point.independent_author_count}`),
        el('span', undefined, `互动速度 ${point.engagement_velocity_per_hour}/小时 · 地域 ${point.geographic_count} · 语言 ${point.language_count}`),
        el('span', undefined, point.baseline_multiplier === null ? '基线：前一等长窗口无观测' : `相对前一等长窗口 ${point.baseline_multiplier}×`),
      );
      const reasons = el('ul');
      for (const reason of point.reasons) reasons.append(el('li', undefined, reason));
      card.append(reasons);
      grid.append(card);
    }
    detail.append(grid);
    const propagation = el('section', 'trends__panel');
    propagation.append(el('h2', undefined, '跨平台最早观测路径'));
    if (snapshot.propagation_path.length === 0) {
      propagation.append(el('p', undefined, '只有一个平台或没有足够观测，无法形成跨平台路径。'));
    } else {
      const list = el('ol');
      for (const step of snapshot.propagation_path) {
        list.append(el('li', undefined, `${step.from_platform} → ${step.to_platform} · 观测延迟 ${step.observed_delay_minutes} 分钟`));
      }
      propagation.append(list, el('p', undefined, '传播路径仅表示各平台最早观测顺序，不证明转发或因果关系。'));
    }
    fragment.append(detail, propagation);
    return fragment;
  };

  const render = () => {
    const nodes: HTMLElement[] = [];
    if (route.kind === 'detail') {
      const snapshot = snapshots.get(route.eventId);
      if (snapshot) nodes.push(renderSnapshotDetail(snapshot));
      else {
        const detail = el('section', 'trends__panel');
        detail.append(el('h2', undefined, 'SOURCE_REQUIRED'));
        detail.append(el('p', undefined, `没有事件 ${route.eventId || '(invalid)'} 的生产趋势数据；未知 ID 不会回退到测试事件。`));
        nodes.push(detail);
      }
      content.replaceChildren(...nodes);
      return;
    }

    const states = el('section', 'trends__panel');
    states.append(el('h2', undefined, '状态机'));
    const stateList = el('div', 'trends__states');
    for (const state of TREND_STATES) stateList.append(el('span', undefined, state));
    states.append(stateList, el('p', undefined, '每次状态变化都保存阈值、分项和原因；COOLING 低于解决阈值后才进入 RESOLVED。'));
    nodes.push(states);

    const windows = el('section', 'trends__panel');
    windows.append(el('h2', undefined, '多窗口与评分解释'));
    const grid = el('div', 'trends__grid');
    for (const minutes of DEFAULT_TREND_ENGINE_CONFIG.windows_minutes) {
      const card = el('article');
      card.append(el('strong', undefined, pointLabel(minutes)));
      const observed = [...snapshots.values()].map((snapshot) => snapshot.points.find((point) => point.window_minutes === minutes)).filter(Boolean);
      card.append(el('span', undefined, observed.length > 0 ? `${observed.length} 个生产事件快照` : '当前无生产观测'));
      grid.append(card);
    }
    windows.append(grid);
    nodes.push(windows);

    if (snapshots.size === 0) {
      const empty = el('section', 'trends__panel trends__empty');
      empty.append(el('h2', undefined, '当前无可计算事件'));
      empty.append(el('p', undefined, '新闻、X 与 B站 Provider 均未配置。页面不会用测试 SourceItem 填充热度、速度、加速度、传播路径或预警候选。'));
      nodes.push(empty);
    } else {
      const observed = el('section', 'trends__panel');
      observed.append(el('h2', undefined, '已验证生产快照'));
      const list = el('div', 'trends__grid');
      for (const snapshot of [...snapshots.values()].sort((a, b) => b.as_of.localeCompare(a.as_of))) {
        const card = el('article');
        const latest = snapshot.points.find((point) => point.window_minutes === 60) ?? snapshot.points[0];
        const link = el('a', undefined, snapshot.event_id);
        link.href = `/trends/${encodeURIComponent(snapshot.event_id)}`;
        card.append(link, el('span', undefined, latest ? `${latest.state} · 热度 ${latest.heat_score}` : '无可显示窗口'));
        list.append(card);
      }
      observed.append(list);
      nodes.push(observed);
    }
    content.replaceChildren(...nodes);
  };

  render();
  void globalContentRepository.listTrendSnapshots().then((storedSnapshots) => {
    for (const snapshot of storedSnapshots) snapshots.set(snapshot.event_id, snapshot);
    render();
  }).catch((error) => {
    provider.dataset.status = 'ERROR';
    providerStatus.textContent = `本地趋势仓库读取失败（${error instanceof Error ? error.message : 'unknown error'}）`;
  });
  const connection = connectTrendRealtime({
    endpoint: TREND_REALTIME_PROVIDER.endpoint,
    onStatus(status) {
      provider.dataset.status = status;
      providerStatus.textContent = status === 'NOT_CONFIGURED' ? '实时 SSE：Provider 未配置' : `实时 SSE：${status}`;
    },
    onSnapshot(snapshot) {
      snapshots.set(snapshot.event_id, snapshot);
      render();
    },
    onError(message) {
      provider.dataset.status = 'ERROR';
      providerStatus.textContent = `实时 SSE：数据被拒绝（${message}）`;
    },
  });
  window.addEventListener('beforeunload', () => connection.close(), { once: true });
}
