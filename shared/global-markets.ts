/** Phase 21 global exchange, security identity, calendar and quote boundaries. */

import {
  assertStableEntityId,
  createStableEntityId,
  type LicenseStatus,
  type StableEntityId,
} from './global-intelligence-contract';

export const MARKET_SESSION_STATUSES = [
  'PRE_OPEN',
  'OPENING_AUCTION',
  'OPEN',
  'MIDDAY_BREAK',
  'CLOSING_AUCTION',
  'AFTER_HOURS',
  'HALTED',
  'CLOSED',
  'HOLIDAY',
  'DELAYED',
  'UNAVAILABLE',
] as const;
export type MarketSessionStatus = (typeof MARKET_SESSION_STATUSES)[number];

export const GLOBAL_MARKET_COVERAGE_LEVELS = [
  'LEVEL_1_REALTIME',
  'LEVEL_2_DELAYED',
  'LEVEL_3_INTRADAY_PERIODIC',
  'LEVEL_4_DAILY_CLOSE',
  'LEVEL_5_METADATA_ONLY',
  'LEVEL_0_UNAVAILABLE',
] as const;
export type GlobalMarketCoverageLevel = (typeof GLOBAL_MARKET_COVERAGE_LEVELS)[number];

export type TradingPhase = Readonly<{
  status: Exclude<MarketSessionStatus, 'HALTED' | 'CLOSED' | 'HOLIDAY' | 'DELAYED' | 'UNAVAILABLE'>;
  start_local: string;
  end_local: string;
}>;

export type ExchangeCalendarException = Readonly<{
  date: string;
  status: 'HOLIDAY' | 'CLOSED';
  reason: string;
}>;

export type Exchange = Readonly<{
  exchange_id: StableEntityId;
  mic: string;
  canonical_name: string;
  country_iso2: string;
  timezone: string;
  currency: string;
  regular_weekdays: readonly number[];
  phases: readonly TradingPhase[];
  calendar_exceptions: readonly ExchangeCalendarException[];
  calendar_version: string;
  source_evidence_ids: readonly StableEntityId[];
  metadata_license_status: LicenseStatus;
  coverage_level: GlobalMarketCoverageLevel;
}>;

export type GlobalSecurity = Readonly<{
  security_id: StableEntityId;
  issuer_company_id: StableEntityId;
  instrument_type: 'COMMON_STOCK' | 'ADR' | 'ETF' | 'OTHER';
  local_ticker: string;
  mic: string;
  isin: string | null;
  currency: string;
  primary_listing: boolean;
  provider_instrument_ids: Readonly<Record<string, string>>;
  source_evidence_ids: readonly StableEntityId[];
}>;

export type GlobalQuoteObservation = Readonly<{
  security_id: StableEntityId;
  mic: string;
  provider_id: string;
  provider_instrument_id: string;
  price: number;
  currency: string;
  observed_at: string;
  received_at: string;
  quote_status: 'REALTIME' | 'DELAYED' | 'INTRADAY_PERIODIC' | 'DAILY_CLOSE';
  delay_minutes: number | null;
  license_status: LicenseStatus;
  source_evidence_ids: readonly StableEntityId[];
}>;

export type MarketSession = Readonly<{
  exchange_id: StableEntityId;
  mic: string;
  status: MarketSessionStatus;
  as_of: string;
  exchange_local_date: string;
  exchange_local_time: string;
  reason: string;
  calendar_version: string;
}>;

export type MarketDisplayState = Readonly<{
  status: MarketSessionStatus | GlobalQuoteObservation['quote_status'];
  quote: GlobalQuoteObservation | null;
  label: string;
  last_observation_at: string | null;
  warning: string | null;
}>;

export type ExchangeCoverageTarget = Readonly<{
  mic: string;
  reference_label: string;
  country_iso2: string;
  admission_status: 'SOURCE_REQUIRED';
}>;

/**
 * Coverage targets are identifiers for gap reporting, not admitted exchange
 * facts. Schedule and quote functionality remains disabled until a versioned,
 * licensed Exchange record is imported.
 */
export const GLOBAL_MARKET_COVERAGE_TARGETS: readonly ExchangeCoverageTarget[] = Object.freeze([
  { mic: 'XNAS', reference_label: 'Nasdaq', country_iso2: 'US', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XNYS', reference_label: 'New York Stock Exchange', country_iso2: 'US', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XLON', reference_label: 'London Stock Exchange', country_iso2: 'GB', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XETR', reference_label: 'Xetra', country_iso2: 'DE', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XAMS', reference_label: 'Euronext Amsterdam', country_iso2: 'NL', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XHKG', reference_label: 'Hong Kong Exchanges', country_iso2: 'HK', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XSHG', reference_label: 'Shanghai Stock Exchange', country_iso2: 'CN', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XTKS', reference_label: 'Tokyo Stock Exchange', country_iso2: 'JP', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XASX', reference_label: 'Australian Securities Exchange', country_iso2: 'AU', admission_status: 'SOURCE_REQUIRED' },
  { mic: 'XNSE', reference_label: 'National Stock Exchange of India', country_iso2: 'IN', admission_status: 'SOURCE_REQUIRED' },
]);

export const GLOBAL_MARKET_EXCHANGES: readonly Exchange[] = Object.freeze([]);
export const GLOBAL_SECURITY_MASTER: readonly GlobalSecurity[] = Object.freeze([]);

function validateMic(mic: string): void {
  if (!/^[A-Z0-9]{4}$/u.test(mic)) throw new Error('MIC must contain exactly four uppercase ASCII letters/digits');
}

function validateCurrency(currency: string): void {
  if (!/^[A-Z]{3}$/u.test(currency)) throw new Error('currency must be an ISO 4217-style three-letter code');
}

function minuteOfDay(value: string, field: string): number {
  const match = value.match(/^(\d{2}):(\d{2})$/u);
  if (!match) throw new Error(`${field} must use HH:MM`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`${field} is outside a clock day`);
  return hour * 60 + minute;
}

function localParts(at: string, timezone: string): Readonly<{ date: string; time: string; weekday: number; minute: number }> {
  const parsed = Date.parse(at);
  if (!Number.isFinite(parsed)) throw new Error('as_of must be an ISO-compatible timestamp');
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date(parsed)).map((part) => [part.type, part.value]));
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? '');
    if (weekday < 0) throw new Error('weekday conversion failed');
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
      weekday,
      minute: hour * 60 + minute,
    };
  } catch (error) {
    throw new Error(`Invalid exchange timezone ${timezone}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validateExchange(exchange: Exchange): string[] {
  const errors: string[] = [];
  try { assertStableEntityId(exchange.exchange_id, 'exchange'); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  try { validateMic(exchange.mic); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  try { validateCurrency(exchange.currency); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  if (exchange.exchange_id !== createStableEntityId('exchange', exchange.mic.toLowerCase())) errors.push('exchange_id must derive from MIC');
  if (!/^[A-Z]{2}$/u.test(exchange.country_iso2)) errors.push('country_iso2 must contain two uppercase ASCII letters');
  if (!exchange.canonical_name.trim()) errors.push('canonical_name is required');
  if (!exchange.calendar_version.trim()) errors.push('calendar_version is required');
  if (exchange.source_evidence_ids.length === 0) errors.push('exchange requires source evidence');
  if (exchange.metadata_license_status !== 'VERIFIED') errors.push('exchange metadata license must be VERIFIED');
  if (!exchange.regular_weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) errors.push('regular_weekdays contains an invalid day');
  let previousEnd = -1;
  for (const phase of exchange.phases) {
    try {
      const start = minuteOfDay(phase.start_local, 'phase.start_local');
      const end = minuteOfDay(phase.end_local, 'phase.end_local');
      if (end <= start) errors.push(`${phase.status} phase must end after it starts`);
      if (start < previousEnd) errors.push(`${phase.status} phase overlaps or is out of order`);
      previousEnd = end;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return errors;
}

export function marketSessionAt(exchange: Exchange, asOf: string, halted = false): MarketSession {
  const validationErrors = validateExchange(exchange);
  if (validationErrors.length > 0) throw new Error(`Invalid Exchange: ${validationErrors.join('; ')}`);
  const local = localParts(asOf, exchange.timezone);
  const base = {
    exchange_id: exchange.exchange_id,
    mic: exchange.mic,
    as_of: asOf,
    exchange_local_date: local.date,
    exchange_local_time: local.time,
    calendar_version: exchange.calendar_version,
  } as const;
  if (halted) return { ...base, status: 'HALTED', reason: 'A separately sourced halt flag is active.' };
  const exception = exchange.calendar_exceptions.find((entry) => entry.date === local.date);
  if (exception) return { ...base, status: exception.status === 'HOLIDAY' ? 'HOLIDAY' : 'CLOSED', reason: exception.reason };
  if (!exchange.regular_weekdays.includes(local.weekday)) return { ...base, status: 'CLOSED', reason: 'The exchange calendar marks this as a non-trading weekday.' };
  for (const phase of exchange.phases) {
    const start = minuteOfDay(phase.start_local, 'phase.start_local');
    const end = minuteOfDay(phase.end_local, 'phase.end_local');
    if (local.minute >= start && local.minute < end) return { ...base, status: phase.status, reason: `Matched ${phase.status} phase ${phase.start_local}-${phase.end_local} in ${exchange.timezone}.` };
  }
  return { ...base, status: 'CLOSED', reason: 'Local time is outside all admitted trading phases.' };
}

export function validateSecurityMaster(securities: readonly GlobalSecurity[], exchanges: readonly Exchange[]): string[] {
  const errors: string[] = [];
  const identities = new Set<string>();
  const exchangeMics = new Set(exchanges.map((exchange) => exchange.mic));
  for (const security of securities) {
    try { assertStableEntityId(security.security_id, 'security'); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    try { assertStableEntityId(security.issuer_company_id, 'company'); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    try { validateMic(security.mic); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    try { validateCurrency(security.currency); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    if (!security.local_ticker.trim()) errors.push(`${security.security_id} has no local ticker`);
    if (!exchangeMics.has(security.mic)) errors.push(`${security.security_id} references an unknown admitted MIC`);
    if (security.source_evidence_ids.length === 0) errors.push(`${security.security_id} has no source evidence`);
    if (security.isin !== null && !/^[A-Z]{2}[A-Z0-9]{9}\d$/u.test(security.isin)) errors.push(`${security.security_id} has an invalid ISIN shape`);
    const identity = `${security.mic}:${security.local_ticker.toUpperCase()}`;
    if (identities.has(identity)) errors.push(`duplicate security identity ${identity}`);
    identities.add(identity);
  }
  return errors;
}

export function resolveGlobalSecurity(
  ticker: string,
  mic: string | null,
  securities: readonly GlobalSecurity[] = GLOBAL_SECURITY_MASTER,
): Readonly<{ status: 'FOUND'; security: GlobalSecurity }> | Readonly<{ status: 'MIC_REQUIRED'; candidate_mics: readonly string[] }> | Readonly<{ status: 'NOT_FOUND' }> {
  const matches = securities.filter((security) => security.local_ticker.toUpperCase() === ticker.trim().toUpperCase());
  if (mic === null && matches.length > 1) return { status: 'MIC_REQUIRED', candidate_mics: [...new Set(matches.map((security) => security.mic))].sort() };
  const found = matches.find((security) => mic === null || security.mic === mic);
  return found ? { status: 'FOUND', security: found } : { status: 'NOT_FOUND' };
}

export function assertQuoteMatchesQuery(
  quote: GlobalQuoteObservation,
  query: Readonly<{ security_id: StableEntityId; mic: string; provider_instrument_id: string }>,
): void {
  assertStableEntityId(quote.security_id, 'security');
  validateMic(quote.mic);
  validateCurrency(quote.currency);
  if (quote.security_id !== query.security_id || quote.mic !== query.mic || quote.provider_instrument_id !== query.provider_instrument_id) {
    throw new Error('quote identity does not match security_id + MIC + provider_instrument_id query');
  }
  if (!Number.isFinite(quote.price) || quote.price < 0) throw new Error('quote price must be finite and non-negative');
  if (!Number.isFinite(Date.parse(quote.observed_at)) || !Number.isFinite(Date.parse(quote.received_at))) throw new Error('quote timestamps are invalid');
  if (quote.license_status !== 'VERIFIED') throw new Error('quote cannot be displayed without a VERIFIED Provider license');
  if (quote.source_evidence_ids.length === 0) throw new Error('quote requires source evidence');
  if (quote.quote_status === 'REALTIME' && quote.delay_minutes !== 0) throw new Error('REALTIME quote must have zero declared delay');
  if (quote.quote_status === 'DELAYED' && (quote.delay_minutes === null || quote.delay_minutes <= 0)) throw new Error('DELAYED quote requires a positive delay');
}

export function marketDisplayState(session: MarketSession, quote: GlobalQuoteObservation | null): MarketDisplayState {
  const activelyTrading = ['PRE_OPEN', 'OPENING_AUCTION', 'OPEN', 'CLOSING_AUCTION', 'AFTER_HOURS'].includes(session.status);
  if (quote === null) {
    return {
      status: session.status === 'OPEN' ? 'UNAVAILABLE' : session.status,
      quote: null,
      label: session.status === 'OPEN' ? '市场开市，但行情 Provider 不可用' : `市场状态：${session.status}`,
      last_observation_at: null,
      warning: '没有可显示的授权行情观测。',
    };
  }
  if (!activelyTrading) {
    return {
      status: session.status,
      quote,
      label: `市场${session.status} · 最后观测 ${quote.observed_at}`,
      last_observation_at: quote.observed_at,
      warning: '最后价格不是当前实时价格。',
    };
  }
  return {
    status: quote.quote_status,
    quote,
    label: quote.quote_status === 'REALTIME' ? '实时行情（许可与延迟已验证）' : `${quote.quote_status} 行情`,
    last_observation_at: quote.observed_at,
    warning: quote.quote_status === 'REALTIME' ? null : '此行情不是实时数据。',
  };
}

export function globalMarketCoverageMatrix(
  exchanges: readonly Exchange[] = GLOBAL_MARKET_EXCHANGES,
): readonly Readonly<ExchangeCoverageTarget & { configured: boolean; coverage_level: GlobalMarketCoverageLevel }>[] {
  const byMic = new Map(exchanges.map((exchange) => [exchange.mic, exchange]));
  return GLOBAL_MARKET_COVERAGE_TARGETS.map((target) => {
    const exchange = byMic.get(target.mic);
    return {
      ...target,
      configured: Boolean(exchange),
      coverage_level: exchange?.coverage_level ?? 'LEVEL_0_UNAVAILABLE',
    };
  });
}
