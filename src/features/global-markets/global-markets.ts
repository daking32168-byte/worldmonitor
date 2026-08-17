import { PRIMARY_BRAND } from '@/config/brand';
import {
  assertQuoteMatchesQuery,
  globalMarketCoverageMatrix,
  marketDisplayState,
  validateExchange,
  validateSecurityMaster,
  type Exchange,
  type GlobalQuoteObservation,
  type GlobalSecurity,
  type MarketSession,
} from '../../../shared/global-markets';
import './global-markets.css';

export type GlobalMarketObservation = Readonly<{
  exchange: Exchange;
  security: GlobalSecurity;
  session: MarketSession;
  quote: GlobalQuoteObservation | null;
  network_status: 'ONLINE' | 'OFFLINE';
  related_industry_event: string | null;
}>;

export type GlobalMarketsWorkspaceData = Readonly<{
  observations?: readonly GlobalMarketObservation[];
}>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(label: string, href: string): HTMLAnchorElement {
  const node = el('a', undefined, label);
  node.href = href;
  return node;
}

export function initGlobalMarketsWorkspace(rootId = 'app', data: GlobalMarketsWorkspaceData = {}): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Global Markets root #${rootId} was not found`);
  const observations = data.observations ?? [];
  const exchanges = observations.map((item) => item.exchange);
  const securities = observations.map((item) => item.security);
  for (const exchange of exchanges) {
    const errors = validateExchange(exchange);
    if (errors.length > 0) throw new Error(`Invalid exchange observation: ${errors.join('; ')}`);
  }
  const securityErrors = validateSecurityMaster(securities, exchanges);
  if (securityErrors.length > 0) throw new Error(`Invalid security observation: ${securityErrors.join('; ')}`);
  for (const item of observations) {
    if (item.session.exchange_id !== item.exchange.exchange_id || item.session.mic !== item.exchange.mic) throw new Error('Market session identity does not match its exchange');
    if (item.quote) {
      assertQuoteMatchesQuery(item.quote, {
        security_id: item.security.security_id,
        mic: item.security.mic,
        provider_instrument_id: item.security.provider_instrument_ids[item.quote.provider_id] ?? '',
      });
    }
  }
  const page = el('main', 'global-markets');
  const header = el('header', 'global-markets__header');
  const title = el('div');
  title.append(
    el('p', 'global-markets__eyebrow', PRIMARY_BRAND),
    el('h1', undefined, '全球交易所与证券市场'),
    el('p', undefined, '证券身份强制使用 security_id + MIC + Provider instrument ID；ticker 只用于显示和搜索。'),
  );
  const nav = el('nav', 'global-markets__nav');
  nav.append(link('现有股票工作区', '/stocks'), link('产业地图', '/industry-map'), link('Provider 运维', '/provider-operations'), link('人工操作中心', '/manual-action-center'), link('返回地球', '/'));
  header.append(title, nav);

  const content = el('div', 'global-markets__content');
  const notice = el('section', 'global-markets__notice');
  notice.append(
    el('strong', undefined, observations.length === 0 ? '生产行情未配置' : '已验证 Provider 观测'),
    el('p', undefined, observations.length === 0
      ? '当前没有许可证、版本化交易日历与服务端中继同时通过准入的交易所。页面不会把静态交易时间、旧价格或测试行情显示成实时。现有 /stocks 路由保持兼容。'
      : '每条行情已绑定 security_id + MIC + Provider instrument ID，并保留交易所当地状态、观测时间、网络状态和许可证。'),
  );

  if (observations.length > 0) {
    const livePanel = el('section', 'global-markets__panel');
    livePanel.append(el('h2', undefined, '已验证市场状态'));
    const liveGrid = el('div', 'global-markets__matrix');
    for (const item of observations) {
      const display = marketDisplayState(item.session, item.quote);
      const card = el('article', 'global-markets__exchange');
      card.dataset.sessionStatus = item.session.status;
      card.dataset.networkStatus = item.network_status;
      card.append(
        el('strong', undefined, `${item.security.local_ticker} · ${item.security.mic}`),
        el('span', undefined, `交易所当地 ${item.session.exchange_local_date} ${item.session.exchange_local_time} · ${item.session.status}`),
        el('span', undefined, item.network_status === 'OFFLINE' ? '网络离线：保留最后验证观测，不执行刷新' : '网络在线'),
        el('span', undefined, display.quote ? `最后有效报价 ${display.quote.price} ${display.quote.currency} · ${display.last_observation_at}` : '没有可显示的授权行情观测'),
        el('span', 'global-markets__badge', display.label),
        el('span', undefined, display.warning ?? '许可与零延迟已经验证，可标实时'),
        el('span', undefined, `新闻按交易所日历 ${item.session.calendar_version} 与当地交易日对齐；不会按浏览器时区猜测。`),
        el('span', undefined, item.related_industry_event
          ? `相关产业事件：${item.related_industry_event}。仅为有证据关联，不代表价格因果。`
          : '当前没有通过证据门禁的相关产业事件；不会补造因果。'),
        el('span', undefined, `AI 推演数据截止 ${item.quote?.observed_at ?? item.session.as_of}；模型输出不是事实或投资建议。`),
      );
      liveGrid.append(card);
    }
    livePanel.append(liveGrid);
    content.append(livePanel);
  }

  const panel = el('section', 'global-markets__panel');
  panel.append(el('h2', undefined, '全球覆盖矩阵'));
  panel.append(el('p', undefined, '下列为建设目标标识，不是已验证交易所事实。每个 MIC 在许可证、来源、日历和 Provider 验证完成前保持 LEVEL_0_UNAVAILABLE。'));
  const matrix = el('div', 'global-markets__matrix');
  for (const entry of globalMarketCoverageMatrix(exchanges)) {
    const card = el('article', 'global-markets__exchange');
    card.append(
      el('strong', undefined, `${entry.mic} · ${entry.reference_label}`),
      el('span', undefined, `地区 ${entry.country_iso2}`),
      el('span', undefined, entry.coverage_level),
      el('span', 'global-markets__badge', entry.admission_status),
    );
    matrix.append(card);
  }
  panel.append(matrix);
  content.append(notice, panel);
  page.append(header, content);
  root.replaceChildren(page);
}
