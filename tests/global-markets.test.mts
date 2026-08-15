import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStableEntityId } from '../shared/global-intelligence-contract.ts';
import { readFileSync } from 'node:fs';
import { isGlobalMarketsPath } from '../src/features/global-markets/global-markets-route.ts';
import {
  GLOBAL_MARKET_EXCHANGES,
  GLOBAL_SECURITY_MASTER,
  assertQuoteMatchesQuery,
  globalMarketCoverageMatrix,
  marketDisplayState,
  marketSessionAt,
  resolveGlobalSecurity,
  validateExchange,
  validateSecurityMaster,
  type Exchange,
  type GlobalQuoteObservation,
  type GlobalSecurity,
} from '../shared/global-markets.ts';

const SOURCE_ID = createStableEntityId('source', 'test-exchange-calendar');
const COMPANY_ID = createStableEntityId('company', 'test-global-issuer');

function exchange(mic = 'XHKG'): Exchange {
  return {
    exchange_id: createStableEntityId('exchange', mic.toLowerCase()),
    mic,
    canonical_name: 'Contract Test Exchange',
    country_iso2: 'HK',
    timezone: 'Asia/Hong_Kong',
    currency: 'HKD',
    regular_weekdays: [1, 2, 3, 4, 5],
    phases: [
      { status: 'PRE_OPEN', start_local: '09:00', end_local: '09:20' },
      { status: 'OPENING_AUCTION', start_local: '09:20', end_local: '09:30' },
      { status: 'OPEN', start_local: '09:30', end_local: '12:00' },
      { status: 'MIDDAY_BREAK', start_local: '12:00', end_local: '13:00' },
      { status: 'OPEN', start_local: '13:00', end_local: '16:00' },
      { status: 'CLOSING_AUCTION', start_local: '16:00', end_local: '16:10' },
    ],
    calendar_exceptions: [{ date: '2026-08-17', status: 'HOLIDAY', reason: 'Contract-test holiday' }],
    calendar_version: 'fixture-2026.08',
    source_evidence_ids: [SOURCE_ID],
    metadata_license_status: 'VERIFIED',
    coverage_level: 'LEVEL_5_METADATA_ONLY',
  };
}

function security(mic: string): GlobalSecurity {
  return {
    security_id: createStableEntityId('security', `${mic.toLowerCase()}-same`),
    issuer_company_id: COMPANY_ID,
    instrument_type: 'COMMON_STOCK',
    local_ticker: 'SAME',
    mic,
    isin: null,
    currency: mic === 'XHKG' ? 'HKD' : 'USD',
    primary_listing: mic === 'XHKG',
    provider_instrument_ids: { fixture: `${mic}:SAME` },
    source_evidence_ids: [SOURCE_ID],
  };
}

function quote(overrides: Partial<GlobalQuoteObservation> = {}): GlobalQuoteObservation {
  return {
    security_id: createStableEntityId('security', 'xhkg-same'),
    mic: 'XHKG',
    provider_id: 'fixture-relay',
    provider_instrument_id: 'XHKG:SAME',
    price: 100,
    currency: 'HKD',
    observed_at: '2026-08-18T02:00:00Z',
    received_at: '2026-08-18T02:00:01Z',
    quote_status: 'REALTIME',
    delay_minutes: 0,
    license_status: 'VERIFIED',
    source_evidence_ids: [SOURCE_ID],
    ...overrides,
  };
}

describe('Phase 21 global market truth boundaries', () => {
  it('computes exchange-local auctions, open, midday break, holiday, weekend and halt independently', () => {
    const fixture = exchange();
    assert.deepEqual(validateExchange(fixture), []);
    assert.equal(marketSessionAt(fixture, '2026-08-18T01:25:00Z').status, 'OPENING_AUCTION');
    assert.equal(marketSessionAt(fixture, '2026-08-18T02:00:00Z').status, 'OPEN');
    assert.equal(marketSessionAt(fixture, '2026-08-18T04:30:00Z').status, 'MIDDAY_BREAK');
    assert.equal(marketSessionAt(fixture, '2026-08-17T02:00:00Z').status, 'HOLIDAY');
    assert.equal(marketSessionAt(fixture, '2026-08-16T02:00:00Z').status, 'CLOSED');
    assert.equal(marketSessionAt(fixture, '2026-08-18T02:00:00Z', true).status, 'HALTED');
  });

  it('never resolves a cross-market ticker without an explicit MIC', () => {
    const exchanges = [exchange('XHKG'), { ...exchange('XNAS'), country_iso2: 'US', timezone: 'America/New_York', currency: 'USD' }];
    const securities = [security('XHKG'), security('XNAS')];
    assert.deepEqual(validateSecurityMaster(securities, exchanges), []);
    assert.deepEqual(resolveGlobalSecurity('SAME', null, securities), { status: 'MIC_REQUIRED', candidate_mics: ['XHKG', 'XNAS'] });
    const resolved = resolveGlobalSecurity('SAME', 'XNAS', securities);
    assert.equal(resolved.status, 'FOUND');
    if (resolved.status === 'FOUND') assert.equal(resolved.security.security_id, createStableEntityId('security', 'xnas-same'));
  });

  it('binds every quote to security + MIC + Provider instrument and requires display rights', () => {
    const valid = quote();
    assert.doesNotThrow(() => assertQuoteMatchesQuery(valid, {
      security_id: valid.security_id,
      mic: 'XHKG',
      provider_instrument_id: 'XHKG:SAME',
    }));
    assert.throws(() => assertQuoteMatchesQuery(valid, {
      security_id: valid.security_id,
      mic: 'XNAS',
      provider_instrument_id: 'XHKG:SAME',
    }), /identity does not match/);
    assert.throws(() => assertQuoteMatchesQuery(quote({ license_status: 'REVIEW_REQUIRED' }), {
      security_id: valid.security_id,
      mic: 'XHKG',
      provider_instrument_id: 'XHKG:SAME',
    }), /VERIFIED Provider license/);
  });

  it('labels closed quotes as last observations and never as current realtime prices', () => {
    const session = marketSessionAt(exchange(), '2026-08-18T09:00:00Z');
    assert.equal(session.status, 'CLOSED');
    const display = marketDisplayState(session, quote());
    assert.equal(display.status, 'CLOSED');
    assert.equal(display.last_observation_at, quote().observed_at);
    assert.match(display.warning ?? '', /不是当前实时价格/);
  });

  it('ships no unlicensed production market metadata or quotes while exposing an honest global gap matrix', () => {
    assert.deepEqual(GLOBAL_MARKET_EXCHANGES, []);
    assert.deepEqual(GLOBAL_SECURITY_MASTER, []);
    const matrix = globalMarketCoverageMatrix();
    assert.ok(matrix.length >= 10);
    assert.equal(matrix.every((entry) => !entry.configured && entry.coverage_level === 'LEVEL_0_UNAVAILABLE' && entry.admission_status === 'SOURCE_REQUIRED'), true);
    assert.equal(isGlobalMarketsPath('/global-markets'), true);
    const page = readFileSync(new URL('../src/features/global-markets/global-markets.ts', import.meta.url), 'utf8');
    assert.match(page, /LEVEL_0_UNAVAILABLE/);
    assert.match(page, /不会把静态交易时间、旧价格或测试行情显示成实时/);
  });
});
