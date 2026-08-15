import { TREND_STATES, type TrendSnapshot } from '../../shared/trend-engine';

export type TrendRealtimeStatus = 'NOT_CONFIGURED' | 'CONNECTING' | 'LIVE' | 'ERROR' | 'CLOSED';

type EventSourceEvent = Readonly<{ data: string }>;

export interface TrendEventSource {
  close(): void;
  addEventListener(type: 'open' | 'error', listener: () => void): void;
  addEventListener(type: 'trend_snapshot', listener: (event: EventSourceEvent) => void): void;
}

export type TrendRealtimeConnection = Readonly<{
  initialStatus: TrendRealtimeStatus;
  close(): void;
}>;

export type TrendRealtimeOptions = Readonly<{
  endpoint: string | null;
  eventSourceFactory?: (endpoint: string) => TrendEventSource;
  onStatus: (status: TrendRealtimeStatus) => void;
  onSnapshot: (snapshot: TrendSnapshot) => void;
  onError?: (message: string) => void;
}>;

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function validateTrendSseEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.username || url.password) throw new Error('trend SSE endpoint must not contain credentials');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHostname(url.hostname))) {
    throw new Error('trend SSE endpoint must use HTTPS, except loopback test endpoints');
  }
  url.username = '';
  url.password = '';
  return url.toString();
}

function isTrendSnapshot(value: unknown): value is TrendSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TrendSnapshot>;
  if (typeof candidate.event_id !== 'string' || !candidate.event_id.startsWith('event_')) return false;
  if (typeof candidate.as_of !== 'string' || !Number.isFinite(Date.parse(candidate.as_of))) return false;
  if (!Array.isArray(candidate.points) || !Array.isArray(candidate.propagation_path)) return false;
  return candidate.points.every((point) => point
    && point.event_id === candidate.event_id
    && point.as_of === candidate.as_of
    && Number.isInteger(point.window_minutes)
    && point.window_minutes > 0
    && Number.isFinite(point.heat_score)
    && point.heat_score >= 0
    && point.heat_score <= 100
    && TREND_STATES.includes(point.state)
    && typeof point.algorithm_version === 'string'
    && point.algorithm_version.length > 0
    && Array.isArray(point.reasons));
}

function defaultEventSourceFactory(endpoint: string): TrendEventSource {
  return new EventSource(endpoint) as TrendEventSource;
}

/**
 * Connects only to an explicitly admitted endpoint. A null endpoint returns a
 * closed no-op, creates no EventSource and therefore cannot fall back to a
 * production fixture or an unlicensed upstream page.
 */
export function connectTrendRealtime(options: TrendRealtimeOptions): TrendRealtimeConnection {
  if (options.endpoint === null) {
    options.onStatus('NOT_CONFIGURED');
    return Object.freeze({ initialStatus: 'NOT_CONFIGURED' as const, close() {} });
  }

  const endpoint = validateTrendSseEndpoint(options.endpoint);
  const source = (options.eventSourceFactory ?? defaultEventSourceFactory)(endpoint);
  let closed = false;
  options.onStatus('CONNECTING');
  source.addEventListener('open', () => {
    if (!closed) options.onStatus('LIVE');
  });
  source.addEventListener('error', () => {
    if (!closed) options.onStatus('ERROR');
  });
  source.addEventListener('trend_snapshot', (event) => {
    if (closed) return;
    try {
      const parsed: unknown = JSON.parse(event.data);
      if (!isTrendSnapshot(parsed)) throw new Error('trend_snapshot payload failed validation');
      options.onSnapshot(parsed);
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : 'trend_snapshot payload was unreadable');
    }
  });

  return Object.freeze({
    initialStatus: 'CONNECTING' as const,
    close() {
      if (closed) return;
      closed = true;
      source.close();
      options.onStatus('CLOSED');
    },
  });
}
