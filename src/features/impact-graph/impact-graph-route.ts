export const IMPACT_GRAPH_PATH = '/impact-graph';
export const IMPACT_EVENT_PATH_PREFIX = '/impact/';

export function impactEventUrl(eventId: string): string {
  return `${IMPACT_EVENT_PATH_PREFIX}${encodeURIComponent(eventId)}`;
}

export function parseImpactGraphPath(pathname: string): Readonly<{ kind: 'OVERVIEW'; eventId: null } | { kind: 'EVENT'; eventId: string }> | null {
  if (pathname === IMPACT_GRAPH_PATH || pathname === `${IMPACT_GRAPH_PATH}/`) return { kind: 'OVERVIEW', eventId: null };
  if (!pathname.startsWith(IMPACT_EVENT_PATH_PREFIX)) return null;
  const raw = pathname.slice(IMPACT_EVENT_PATH_PREFIX.length).replace(/\/$/, '');
  if (!raw || raw.includes('/')) return null;
  try {
    const eventId = decodeURIComponent(raw);
    return /^event_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(eventId) ? { kind: 'EVENT', eventId } : null;
  } catch {
    return null;
  }
}

export function isImpactGraphPath(pathname: string): boolean {
  return parseImpactGraphPath(pathname) !== null;
}
