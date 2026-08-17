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
import { assertEvidenceCanEnterFactTable } from '../shared/global-intelligence-contract.ts';
import { COMPANY_FACILITY_REGISTRY } from '../shared/company-facility-registry.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Phase 18 global industrial seed review', () => {
  it('covers all six requested case families with one shared cross-country model', () => {
    assert.equal(GLOBAL_INDUSTRIAL_SEED_REVIEWS.length, 7);
    assert.deepEqual(new Set(GLOBAL_INDUSTRIAL_SEED_REVIEWS.map((item) => item.case_id)), new Set([
      'wenzhou-footwear',
      'jingdezhen-ceramics',
      'dongguan-city-industry-profile',
      'dongguan-dalang-knitwear',
      'shenzhen-byd-manufacturing',
      'netherlands-asml-lithography',
      'germany-bmw-munich-auto',
    ]));
    assert.deepEqual(new Set(GLOBAL_INDUSTRIAL_SEED_REVIEWS.map((item) => item.country_code)), new Set(['CN', 'NL', 'DE']));
    assert.deepEqual(validateIndustrialSeedReviews(), []);
  });

  it('keeps located official/company pages in a review-only queue until license and claim verification', () => {
    assert.ok(INDUSTRIAL_SEED_SOURCE_EVIDENCE.length >= 10);
    assert.equal(INDUSTRIAL_SEED_SOURCE_EVIDENCE.every((item) => item.sourceUrl?.startsWith('https://')), true);
    for (const evidence of INDUSTRIAL_SEED_SOURCE_EVIDENCE) {
      assert.equal(evidence.sourceType, 'OFFICIAL_WEB_REFERENCE_REVIEW_QUEUE');
      assert.equal(evidence.evidenceClass, 'UNVERIFIED');
      assert.equal(evidence.licenseStatus, 'REVIEW_REQUIRED');
      assert.equal(evidence.qualityStatus, 'UNVERIFIED');
      assert.equal(evidence.observedAt, null);
      assert.equal(evidence.retrievedAt, null);
      assert.equal(evidence.confidence, null);
      assert.throws(() => assertEvidenceCanEnterFactTable(evidence), /VERIFIED license is required/);
    }
    for (const review of GLOBAL_INDUSTRIAL_SEED_REVIEWS) {
      assert.ok(review.evidence_ids.length > 0);
      for (const candidate of [...review.company_candidates, ...review.facility_candidates, ...review.security_candidates]) {
        if (candidate.status === 'REVIEWED_REFERENCE') assert.ok(candidate.evidence_ids.length > 0);
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
      assert.match(review.last_reviewed_at, /^2026-08-15T/);
      assert.equal(review.last_verified_at, null);
    }
  });

  it('supports product-to-location and location-to-product lookup', () => {
    assert.deepEqual(industrialSeedReviewsForProduct('陶瓷').map((item) => item.case_id), ['jingdezhen-ceramics']);
    assert.deepEqual(industrialSeedReviewsForProduct('光刻').map((item) => item.case_id), ['netherlands-asml-lithography']);
    const asml = searchIndustrialSeedReviews('ASML')[0];
    assert.equal(asml?.location_name, '荷兰 · Veldhoven');
    assert.deepEqual(industrialSeedReviewByGeoId(asml!.geo_id)?.product_labels, ['EUV 光刻系统', 'DUV 光刻系统']);
    assert.equal(searchIndustrialSeedReviews('荷兰光刻设备')[0]?.case_id, 'netherlands-asml-lithography');
    assert.equal(searchIndustrialSeedReviews('德国汽车')[0]?.case_id, 'germany-bmw-munich-auto');
    assert.deepEqual(searchIndustrialSeedReviews('东莞').map((item) => item.case_id), ['dongguan-city-industry-profile', 'dongguan-dalang-knitwear']);
  });

  it('does not conflate Shenzhen operator, listed issuer and security', () => {
    const shenzhen = GLOBAL_INDUSTRIAL_SEED_REVIEWS.find((item) => item.case_id === 'shenzhen-byd-manufacturing')!;
    assert.equal(shenzhen.facility_candidates[0]?.status, 'REVIEWED_REFERENCE');
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
    assert.doesNotMatch(companyRegistry, /ASML Holding|BMW AG|比亚迪汽车工业/);
    const promotedNames = COMPANY_FACILITY_REGISTRY.companies.flatMap((company) => [company.legal_name, company.canonical_name]);
    assert.ok(promotedNames.every((name) => !/ASML|BMW|比亚迪/u.test(name)));
    const reviewEvidenceIds = new Set(INDUSTRIAL_SEED_SOURCE_EVIDENCE.map((item) => item.sourceId));
    assert.ok(COMPANY_FACILITY_REGISTRY.evidence.every((item) => !reviewEvidenceIds.has(item.sourceId)));
  });
});
