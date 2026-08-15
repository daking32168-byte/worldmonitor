import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  GLOBAL_INDUSTRIAL_SEED_REVIEWS,
  INDUSTRIAL_SEED_SOURCE_EVIDENCE,
  industrialSeedReviewByGeoId,
  industrialSeedReviewsForProduct,
  searchIndustrialSeedReviews,
  validateIndustrialSeedReviews,
} from '../shared/industrial-seed-review.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Phase 18 global industrial seed review', () => {
  it('covers all six requested case families with one shared cross-country model', () => {
    assert.equal(GLOBAL_INDUSTRIAL_SEED_REVIEWS.length, 6);
    assert.deepEqual(new Set(GLOBAL_INDUSTRIAL_SEED_REVIEWS.map((item) => item.case_id)), new Set([
      'wenzhou-footwear',
      'jingdezhen-ceramics',
      'dongguan-dalang-knitwear',
      'shenzhen-byd-manufacturing',
      'netherlands-asml-lithography',
      'germany-bmw-munich-auto',
    ]));
    assert.deepEqual(new Set(GLOBAL_INDUSTRIAL_SEED_REVIEWS.map((item) => item.country_code)), new Set(['CN', 'NL', 'DE']));
    assert.deepEqual(validateIndustrialSeedReviews(), []);
  });

  it('backs every case and reviewed candidate with official or company-filed evidence', () => {
    assert.ok(INDUSTRIAL_SEED_SOURCE_EVIDENCE.length >= 10);
    assert.equal(INDUSTRIAL_SEED_SOURCE_EVIDENCE.every((item) => item.sourceUrl?.startsWith('https://')), true);
    assert.equal(INDUSTRIAL_SEED_SOURCE_EVIDENCE.every((item) => item.evidenceClass !== 'UNVERIFIED'), true);
    for (const review of GLOBAL_INDUSTRIAL_SEED_REVIEWS) {
      assert.ok(review.evidence_ids.length > 0);
      for (const candidate of [...review.company_candidates, ...review.facility_candidates, ...review.security_candidates]) {
        if (candidate.status === 'REVIEWED_CLAIM') assert.ok(candidate.evidence_ids.length > 0);
        if (candidate.status === 'SOURCE_REQUIRED') assert.ok(candidate.gap);
      }
    }
  });

  it('keeps every HS/trade query disabled after source review until product mappings are separately admitted', () => {
    assert.equal(GLOBAL_INDUSTRIAL_SEED_REVIEWS.every((item) => item.hs_trade_status === 'SOURCE_REQUIRED'), true);
    assert.equal(GLOBAL_INDUSTRIAL_SEED_REVIEWS.some((item) => 'trade_value' in item || 'export_value' in item), false);
  });

  it('reports dimension-scoped review coverage and never calls it market coverage', () => {
    for (const review of GLOBAL_INDUSTRIAL_SEED_REVIEWS) {
      assert.equal(review.coverage_scope, 'FIVE_DIMENSION_SOURCE_REVIEW');
      assert.equal(review.review_coverage_rate, review.reviewed_dimensions.length / 5);
      assert.ok(review.review_coverage_rate > 0 && review.review_coverage_rate <= 1);
      assert.match(review.last_verified_at, /^2026-08-15T/);
    }
  });

  it('supports product-to-location and location-to-product lookup', () => {
    assert.deepEqual(industrialSeedReviewsForProduct('陶瓷').map((item) => item.case_id), ['jingdezhen-ceramics']);
    assert.deepEqual(industrialSeedReviewsForProduct('光刻').map((item) => item.case_id), ['netherlands-asml-lithography']);
    const asml = searchIndustrialSeedReviews('ASML')[0];
    assert.equal(asml?.location_name, '荷兰 · Veldhoven');
    assert.deepEqual(industrialSeedReviewByGeoId(asml!.geo_id)?.product_labels, ['EUV 光刻系统', 'DUV 光刻系统']);
  });

  it('does not conflate Shenzhen operator, listed issuer and security', () => {
    const shenzhen = GLOBAL_INDUSTRIAL_SEED_REVIEWS.find((item) => item.case_id === 'shenzhen-byd-manufacturing')!;
    assert.equal(shenzhen.facility_candidates[0]?.status, 'REVIEWED_CLAIM');
    assert.equal(shenzhen.company_candidates[0]?.status, 'SOURCE_REQUIRED');
    assert.equal(shenzhen.security_candidates[0]?.status, 'SOURCE_REQUIRED');
    assert.match(shenzhen.security_candidates[0]?.gap ?? '', /MIC/);
    assert.match(shenzhen.gaps.join(' '), /不得把运营子公司、上市主体和证券自动合并/);
  });

  it('renders reviewed cases in the existing industry search without promoting them into Phase 16 facts', () => {
    const ui = read('src/features/industry-map/industry-map.ts');
    const companyRegistry = read('shared/company-facility-registry.ts');
    assert.match(ui, /searchIndustrialSeedReviews/);
    assert.match(ui, /Phase 18 来源审查/);
    assert.match(ui, /HS\/贸易待审/);
    assert.match(companyRegistry, /companies: Object\.freeze\(\[\]\)/);
    assert.doesNotMatch(companyRegistry, /ASML Holding|BMW AG|比亚迪汽车工业/);
  });
});
