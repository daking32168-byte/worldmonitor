export const TRENDS_PATH = '/trends';

export type TrendsRoute = Readonly<{ kind: 'overview' }> | Readonly<{ kind: 'detail'; eventId: string }>;

export function isTrendsPath(pathname: string): boolean {
  return /^\/trends(?:\/[^/]+)?\/?$/.test(pathname);
}

export function parseTrendsRoute(pathname: string): TrendsRoute {
  const match = pathname.match(/^\/trends\/([^/]+)\/?$/);
  if (!match) return { kind: 'overview' };
  try { return { kind: 'detail', eventId: decodeURIComponent(match[1]!) }; }
  catch { return { kind: 'detail', eventId: '' }; }
}

export function trendsUrl(eventId?: string): string {
  return eventId ? `${TRENDS_PATH}/${encodeURIComponent(eventId)}` : TRENDS_PATH;
}
