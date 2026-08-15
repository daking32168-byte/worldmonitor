#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseIndustryMapCsv } from './validate-industry-map-csv.mjs';

export const COMPANY_CSV_HEADERS = Object.freeze([
  'record_status', 'company_id', 'legal_name', 'registration_country', 'registration_number',
  'canonical_name', 'alternate_names', 'company_type', 'parent_company_id', 'ultimate_parent_id',
  'headquarters_geo_id', 'website', 'listed_status', 'coverage_tier', 'source_id', 'source_url',
  'last_verified_at',
]);
export const FACILITY_CSV_HEADERS = Object.freeze([
  'record_status', 'facility_id', 'company_id', 'facility_name', 'facility_type', 'geo_id', 'address',
  'lat', 'lon', 'industrial_park_id', 'operational_status', 'product_ids', 'process_tags',
  'capacity_disclosures', 'employment_range', 'oem_odm_brand_mode', 'source_id', 'source_url',
  'last_verified_at',
]);
export const BRAND_CSV_HEADERS = Object.freeze([
  'record_status', 'brand_id', 'brand_name', 'owner_company_id', 'operator_company_ids', 'source_id',
  'source_url', 'last_verified_at',
]);
export const SECURITY_CSV_HEADERS = Object.freeze([
  'record_status', 'security_id', 'issuer_company_id', 'instrument_type', 'local_ticker', 'mic', 'isin',
  'currency', 'primary_listing', 'provider_instrument_ids', 'valid_from', 'valid_to', 'source_id',
  'source_url', 'last_verified_at',
]);

const STATUS = new Set(['TEMPLATE', 'REVIEWED', 'SOURCE_REQUIRED']);
const COMPANY_TYPES = new Set(['LEGAL_ENTITY', 'LISTED_ENTITY', 'SUBSIDIARY', 'STATE_OWNED_ENTERPRISE', 'PRIVATE_ENTERPRISE']);
const FACILITY_TYPES = new Set(['MANUFACTURING_PLANT', 'ASSEMBLY_PLANT', 'PROCESSING_PLANT', 'RESEARCH_AND_DEVELOPMENT', 'WAREHOUSE', 'OFFICE', 'OTHER']);
const OPERATIONAL_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'PLANNED', 'UNKNOWN']);
const LISTED_STATUSES = new Set(['LISTED', 'PRIVATE', 'UNLISTED', 'UNKNOWN']);
const COVERAGE_TIERS = new Set(['TIER_A', 'TIER_B', 'TIER_C', 'TIER_D']);
const INSTRUMENT_TYPES = new Set(['COMMON_STOCK', 'PREFERRED_STOCK', 'DEPOSITARY_RECEIPT', 'OTHER']);
const ID = Object.freeze({
  company: /^company_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/,
  facility: /^facility_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/,
  brand: /^brand_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/,
  security: /^security_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/,
  geo: /^geo_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/,
  product: /^product_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/,
  source: /^source_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/,
});

function isHttps(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isTimestamp(value) {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function splitList(value) {
  return value.split('|').map((item) => item.trim()).filter(Boolean);
}

function parseRows(text, headers, kind, errors) {
  let parsed;
  try {
    parsed = parseIndustryMapCsv(text);
  } catch (error) {
    errors.push(`${kind}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
  if (parsed.length === 0) {
    errors.push(`${kind}: CSV is empty`);
    return [];
  }
  if (parsed[0].length !== headers.length || parsed[0].some((value, index) => value !== headers[index])) {
    errors.push(`${kind}: header must exactly match ${headers.join(',')}`);
    return [];
  }
  return parsed.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      errors.push(`${kind} line ${index + 2}: expected ${headers.length} columns, received ${values.length}`);
      return null;
    }
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
    row.__line = index + 2;
    if (!STATUS.has(row.record_status)) errors.push(`${kind} line ${row.__line}: invalid record_status`);
    if (Object.values(row).some((value) => String(value).includes('全部工厂'))) {
      errors.push(`${kind} line ${row.__line}: prohibited completeness claim`);
    }
    if (row.record_status === 'REVIEWED') {
      if (!ID.source.test(row.source_id)) errors.push(`${kind} line ${row.__line}: reviewed row requires stable source_id`);
      if (!isHttps(row.source_url)) errors.push(`${kind} line ${row.__line}: reviewed row requires HTTPS source_url`);
      if (!isTimestamp(row.last_verified_at)) errors.push(`${kind} line ${row.__line}: reviewed row requires ISO last_verified_at`);
    }
    if (row.source_url && !isHttps(row.source_url)) errors.push(`${kind} line ${row.__line}: source_url must use HTTPS`);
    return row;
  }).filter(Boolean);
}

function validateCompanies(rows, errors) {
  const ids = new Set();
  const registrations = new Set();
  for (const row of rows) {
    const prefix = `companies line ${row.__line}`;
    if (!ID.company.test(row.company_id)) errors.push(`${prefix}: invalid company_id`);
    if (ids.has(row.company_id)) errors.push(`${prefix}: duplicate company_id`);
    ids.add(row.company_id);
    if (!row.legal_name.trim() || !row.canonical_name.trim()) errors.push(`${prefix}: legal_name and canonical_name are required`);
    if (!/^[A-Z]{2}$/.test(row.registration_country)) errors.push(`${prefix}: registration_country must be ISO alpha-2`);
    if (!row.registration_number.trim()) errors.push(`${prefix}: registration_number is required`);
    const registration = `${row.registration_country}:${row.registration_number.normalize('NFKC').toUpperCase()}`;
    if (registrations.has(registration)) errors.push(`${prefix}: duplicate registration identity ${registration}`);
    registrations.add(registration);
    if (!COMPANY_TYPES.has(row.company_type)) errors.push(`${prefix}: invalid company_type`);
    if (row.parent_company_id && !ID.company.test(row.parent_company_id)) errors.push(`${prefix}: invalid parent_company_id`);
    if (row.ultimate_parent_id && !ID.company.test(row.ultimate_parent_id)) errors.push(`${prefix}: invalid ultimate_parent_id`);
    if (row.headquarters_geo_id && !ID.geo.test(row.headquarters_geo_id)) errors.push(`${prefix}: invalid headquarters_geo_id`);
    if (row.website && !isHttps(row.website)) errors.push(`${prefix}: website must use HTTPS`);
    if (!LISTED_STATUSES.has(row.listed_status)) errors.push(`${prefix}: invalid listed_status`);
    if (!COVERAGE_TIERS.has(row.coverage_tier)) errors.push(`${prefix}: invalid coverage_tier`);
  }
}

function validateFacilities(rows, companyRows, errors) {
  const ids = new Set();
  const reviewedCompanies = new Set(companyRows.filter((row) => row.record_status === 'REVIEWED').map((row) => row.company_id));
  for (const row of rows) {
    const prefix = `facilities line ${row.__line}`;
    if (!ID.facility.test(row.facility_id)) errors.push(`${prefix}: invalid facility_id`);
    if (ids.has(row.facility_id)) errors.push(`${prefix}: duplicate facility_id`);
    ids.add(row.facility_id);
    if (!ID.company.test(row.company_id)) errors.push(`${prefix}: invalid company_id`);
    if (row.record_status === 'REVIEWED' && !reviewedCompanies.has(row.company_id)) errors.push(`${prefix}: reviewed facility requires its reviewed company in the same batch`);
    if (!row.facility_name.trim()) errors.push(`${prefix}: facility_name is required`);
    if (!FACILITY_TYPES.has(row.facility_type)) errors.push(`${prefix}: invalid facility_type`);
    if (!ID.geo.test(row.geo_id)) errors.push(`${prefix}: invalid geo_id`);
    if (row.industrial_park_id && !ID.geo.test(row.industrial_park_id)) errors.push(`${prefix}: industrial_park_id must be a geo_ ID`);
    if (!OPERATIONAL_STATUSES.has(row.operational_status)) errors.push(`${prefix}: invalid operational_status`);
    for (const productId of splitList(row.product_ids)) if (!ID.product.test(productId)) errors.push(`${prefix}: invalid product_id ${productId}`);
    const latProvided = row.lat.trim().length > 0;
    const lonProvided = row.lon.trim().length > 0;
    if (latProvided !== lonProvided) errors.push(`${prefix}: lat and lon must be provided together`);
    if (latProvided) {
      const lat = Number(row.lat);
      const lon = Number(row.lon);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push(`${prefix}: latitude is out of range`);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) errors.push(`${prefix}: longitude is out of range`);
    }
    for (const mode of splitList(row.oem_odm_brand_mode)) {
      if (!['OEM', 'ODM', 'OWN_BRAND'].includes(mode)) errors.push(`${prefix}: invalid oem_odm_brand_mode ${mode}`);
    }
  }
}

function validateBrands(rows, companyRows, errors) {
  const companyIds = new Set(companyRows.map((row) => row.company_id));
  const ids = new Set();
  for (const row of rows) {
    const prefix = `brands line ${row.__line}`;
    if (!ID.brand.test(row.brand_id)) errors.push(`${prefix}: invalid brand_id`);
    if (ids.has(row.brand_id)) errors.push(`${prefix}: duplicate brand_id`);
    ids.add(row.brand_id);
    if (!row.brand_name.trim()) errors.push(`${prefix}: brand_name is required`);
    if (!ID.company.test(row.owner_company_id)) errors.push(`${prefix}: invalid owner_company_id`);
    for (const companyId of splitList(row.operator_company_ids)) if (!ID.company.test(companyId)) errors.push(`${prefix}: invalid operator_company_id ${companyId}`);
    if (row.record_status === 'REVIEWED' && !companyIds.has(row.owner_company_id)) errors.push(`${prefix}: reviewed brand owner must be in the company batch`);
  }
}

function validateSecurities(rows, companyRows, errors) {
  const companyIds = new Set(companyRows.map((row) => row.company_id));
  const ids = new Set();
  const identities = new Set();
  for (const row of rows) {
    const prefix = `securities line ${row.__line}`;
    if (!ID.security.test(row.security_id)) errors.push(`${prefix}: invalid security_id`);
    if (ids.has(row.security_id)) errors.push(`${prefix}: duplicate security_id`);
    ids.add(row.security_id);
    if (!ID.company.test(row.issuer_company_id)) errors.push(`${prefix}: invalid issuer_company_id`);
    if (row.record_status === 'REVIEWED' && !companyIds.has(row.issuer_company_id)) errors.push(`${prefix}: reviewed security issuer must be in the company batch`);
    if (!INSTRUMENT_TYPES.has(row.instrument_type)) errors.push(`${prefix}: invalid instrument_type`);
    if (!/^[A-Z0-9][A-Z0-9.-]{0,31}$/.test(row.local_ticker)) errors.push(`${prefix}: invalid local_ticker`);
    if (!/^[A-Z0-9]{4}$/.test(row.mic)) errors.push(`${prefix}: mic must be a four-character ISO 10383 code`);
    const identity = `${row.mic}:${row.local_ticker}`;
    if (identities.has(identity)) errors.push(`${prefix}: duplicate MIC+ticker identity ${identity}`);
    identities.add(identity);
    if (!/^[A-Z]{3}$/.test(row.currency)) errors.push(`${prefix}: currency must be ISO alpha-3`);
    if (!['true', 'false'].includes(row.primary_listing)) errors.push(`${prefix}: primary_listing must be true or false`);
    if (row.valid_from && !isTimestamp(row.valid_from)) errors.push(`${prefix}: invalid valid_from`);
    if (row.valid_to && !isTimestamp(row.valid_to)) errors.push(`${prefix}: invalid valid_to`);
  }
}

export function validateCompanyFacilityCsvTexts({ companies, facilities, brands, securities }) {
  const errors = [];
  const companyRows = parseRows(companies, COMPANY_CSV_HEADERS, 'companies', errors);
  const facilityRows = parseRows(facilities, FACILITY_CSV_HEADERS, 'facilities', errors);
  const brandRows = parseRows(brands, BRAND_CSV_HEADERS, 'brands', errors);
  const securityRows = parseRows(securities, SECURITY_CSV_HEADERS, 'securities', errors);
  validateCompanies(companyRows, errors);
  validateFacilities(facilityRows, companyRows, errors);
  validateBrands(brandRows, companyRows, errors);
  validateSecurities(securityRows, companyRows, errors);
  return errors;
}

function runCli() {
  const paths = process.argv.slice(2);
  if (paths.length !== 4) {
    console.error('Usage: node scripts/validate-company-facility-csv.mjs <companies.csv> <facilities.csv> <brands.csv> <securities.csv>');
    process.exitCode = 2;
    return;
  }
  const [companies, facilities, brands, securities] = paths.map((path) => readFileSync(resolve(process.cwd(), path), 'utf8'));
  const errors = validateCompanyFacilityCsvTexts({ companies, facilities, brands, securities });
  if (errors.length > 0) {
    console.error(`company/facility CSV invalid (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('company/facility CSV templates OK; TEMPLATE and SOURCE_REQUIRED rows are not production facts.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
