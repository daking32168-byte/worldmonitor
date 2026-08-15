import { PRIMARY_BRAND } from '@/config/brand';
import { maritimeLogisticsUrl } from '@/features/maritime-logistics/maritime-logistics-route';
import { providerOperationsUrl } from '@/features/provider-operations/provider-operations-route';
import { tradeFlowAvailability, TRADE_LOGISTICS_REGISTRY } from '../../../shared/trade-logistics';
import './trade-flows.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function metric(label: string, value: number): HTMLElement {
  const card = el('article', 'trade-flows__metric');
  card.append(el('strong', undefined, String(value)), el('span', undefined, label));
  return card;
}

export function initTradeFlowsWorkspace(rootId = 'app'): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Trade flows root #${rootId} was not found.`);
  root.className = 'trade-flows';
  const state = tradeFlowAvailability();
  const shell = el('main', 'trade-flows__shell');
  const header = el('header', 'trade-flows__header');
  const title = el('div');
  title.append(el('p', 'trade-flows__eyebrow', PRIMARY_BRAND), el('h1', undefined, '贸易流向与多式联运'));
  title.append(el('p', 'trade-flows__subtitle', '把国家贸易、许可装运、物流观测与模型路线分层显示；没有证据时不生成流向。'));
  const nav = el('nav', 'trade-flows__nav');
  const maritime = el('a', undefined, '海事与港口观测');
  maritime.href = maritimeLogisticsUrl();
  const operations = el('a', undefined, 'Provider 运维');
  operations.href = providerOperationsUrl();
  nav.append(maritime, operations);
  header.append(title, nav);
  shell.append(header);

  const banner = el('section', 'trade-flows__banner');
  banner.dataset.status = state.status;
  banner.append(el('strong', undefined, state.status === 'NOT_CONFIGURED' ? 'Provider 未配置' : '已有经验证观测'));
  banner.append(el('p', undefined, state.status === 'NOT_CONFIGURED'
    ? 'UN Comtrade、合规海关文件与提单/装运 Provider 均未产生可展示记录。生产环境不会加载示例数据。'
    : '以下记录均保留来源、期间、单位、聚合层级与许可边界。'));
  shell.append(banner);

  const metrics = el('section', 'trade-flows__metrics');
  metrics.append(
    metric('国家/产品实际观测', state.observedFlowCount),
    metric('许可装运观测', state.shipmentCount),
    metric('实际物流路线', state.observedRouteCount),
    metric('模型路线', state.modelledRouteCount),
  );
  shell.append(metrics);

  const legend = el('section', 'trade-flows__panel');
  legend.append(el('h2', undefined, '图例与证据层'));
  const legendList = el('ul', 'trade-flows__legend');
  const layers = [
    ['trade-flows__swatch--observed', '实际观测', 'Provider 或合法文件明确提供，保留原始聚合层级。'],
    ['trade-flows__swatch--disclosed', '企业披露', '只表达企业公开披露，不自动升级为装运事实。'],
    ['trade-flows__swatch--modelled', '模型路线', '带方法版本的估算，绝不显示为实际流。'],
  ] as const;
  for (const [className, label, copy] of layers) {
    const item = el('li');
    item.append(el('span', `trade-flows__swatch ${className}`), el('strong', undefined, label), document.createTextNode(` — ${copy}`));
    legendList.append(item);
  }
  legend.append(legendList);
  shell.append(legend);

  const boundaries = el('section', 'trade-flows__panel');
  boundaries.append(el('h2', undefined, '强制真实性边界'));
  const list = el('ul');
  for (const copy of [
    'AIS 只证明船舶自报/观测字段，不能生成货物、买方、工厂、提单或实际目的港。',
    '国家级贸易不会下推为惠东、企业、工厂、港口或单票出口。',
    '海运、空运、铁路、公路和多式联运使用同一合同，但实际与模型路线永久分层。',
    '导出必须保留期间、数值单位、来源证据 ID 和原始聚合层级。',
  ]) list.append(el('li', undefined, copy));
  boundaries.append(list);
  shell.append(boundaries);

  const observations = el('section', 'trade-flows__panel');
  observations.append(el('h2', undefined, '可展示记录'));
  if (TRADE_LOGISTICS_REGISTRY.flows.length === 0 && TRADE_LOGISTICS_REGISTRY.shipments.length === 0) {
    observations.append(el('p', 'trade-flows__empty', '当前无经许可且通过来源验证的贸易或装运记录。请在 Provider 运维页配置受控服务端执行器，或由本地管理员导入具有使用权证明的海关文件。'));
  }
  shell.append(observations);
  root.replaceChildren(shell);
}
