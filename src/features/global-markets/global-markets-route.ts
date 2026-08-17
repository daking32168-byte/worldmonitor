export const GLOBAL_MARKETS_PATH = '/global-markets';

export function isGlobalMarketsPath(pathname: string): boolean {
  return pathname === GLOBAL_MARKETS_PATH || pathname === `${GLOBAL_MARKETS_PATH}/`;
}

export function globalMarketsUrl(): string {
  return GLOBAL_MARKETS_PATH;
}
