export const TRADE_FLOWS_PATH = '/trade-flows';

export function isTradeFlowsPath(pathname: string): boolean {
  return /^\/trade-flows\/?$/.test(pathname);
}

export function tradeFlowsUrl(): string {
  return TRADE_FLOWS_PATH;
}
