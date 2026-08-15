#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const INDUSTRY_MAP_CSV_HEADERS = Object.freeze([
  'record_status',
  'cluster_id',
  'canonical_name',
  'alternate_names',
  'geo_id',
  'geo_level',
  'country_iso2',
  'country_iso3',
  'province',
  'city',
  'county_or_district',
  'centroid_lat',
  'centroid_lon',
  'boundary_ref',
  'boundary_review_status',
  'product_id',
  'product_zh_name',
  'product_synonyms',
  'hs_version',
  'hs_code',
  'hs_mapping_status',
  'source_url',
  'source_published_at',
  'coverage_status',
  'statistics_enabled',
  'coverage_note',
]);

const RECORD_STATUSES = new Set(['TEMPLATE', 'REVIEWED', 'SOURCE_REQUIRED']);
const GEO_LEVELS = new Set(['WORLD', 'COUNTRY', 'STATE_PROVINCE', 'CITY', 'COUNTY_DISTRICT', 'TOWN', 'INDUSTRIAL_PARK']);
const BOUNDARY_STATUSES = new Set(['REVIEWED', 'NOT_REVIEWED', 'SOURCE_REQUIRED']);
const HS_MAPPING_STATUSES = new Set(['REVIEWED', 'SOURCE_REQUIRED']);
const COVERAGE_STATUSES = new Set(['PARTIAL', 'REFERENCE_ONLY']);
const STABLE_CLUSTER_ID = /^cluster_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const STABLE_GEO_ID = /^geo_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const STABLE_PRODUCT_ID = /^product_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;

/** RFC 4180-compatible parser used only by the operator validation path. */
export function parseIndustryMapCsv(text) {
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      if (field.length > 0) throw new Error(`Unexpected quote at byte ${index}`);
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateCoordinatePair(row, line, errors) {
  const latRaw = row.centroid_lat.trim();
  const lonRaw = row.centroid_lon.trim();
  if ((latRaw.length === 0) !== (lonRaw.length === 0)) {
    errors.push(`line ${line}: centroid_lat and centroid_lon must be provided together`);
    return;
  }
  if (!latRaw) return;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push(`line ${line}: centroid_lat is out of range`);
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) errors.push(`line ${line}: centroid_lon is out of range`);
}

export function validateIndustryMapCsvRows(parsedRows) {
  const errors = [];
  if (parsedRows.length === 0) return ['CSV is empty'];
  const header = parsedRows[0];
  if (header.length !== INDUSTRY_MAP_CSV_HEADERS.length
    || header.some((value, index) => value !== INDUSTRY_MAP_CSV_HEADERS[index])) {
    errors.push(`header must exactly match: ${INDUSTRY_MAP_CSV_HEADERS.join(',')}`);
    return errors;
  }
  const seenClusters = new Set();
  for (let index = 1; index < parsedRows.length; index += 1) {
    const values = parsedRows[index];
    const line = index + 1;
    if (values.length !== INDUSTRY_MAP_CSV_HEADERS.length) {
      errors.push(`line ${line}: expected ${INDUSTRY_MAP_CSV_HEADERS.length} columns, received ${values.length}`);
      continue;
    }
    const row = Object.fromEntries(INDUSTRY_MAP_CSV_HEADERS.map((key, column) => [key, values[column] ?? '']));
    if (!RECORD_STATUSES.has(row.record_status)) errors.push(`line ${line}: invalid record_status`);
    if (!STABLE_CLUSTER_ID.test(row.cluster_id)) errors.push(`line ${line}: cluster_id must use the stable cluster_ prefix`);
    if (!STABLE_GEO_ID.test(row.geo_id)) errors.push(`line ${line}: geo_id must use the stable geo_ prefix`);
    if (!STABLE_PRODUCT_ID.test(row.product_id)) errors.push(`line ${line}: product_id must use the stable product_ prefix`);
    if (seenClusters.has(row.cluster_id)) errors.push(`line ${line}: duplicate cluster_id ${row.cluster_id}`);
    seenClusters.add(row.cluster_id);
    for (const field of ['canonical_name', 'province', 'city', 'county_or_district', 'product_zh_name', 'coverage_note']) {
      if (!row[field].trim()) errors.push(`line ${line}: ${field} is required`);
    }
    if (!GEO_LEVELS.has(row.geo_level)) errors.push(`line ${line}: invalid geo_level`);
    if (!/^[A-Z]{2}$/.test(row.country_iso2)) errors.push(`line ${line}: country_iso2 must be two uppercase letters`);
    if (!/^[A-Z]{3}$/.test(row.country_iso3)) errors.push(`line ${line}: country_iso3 must be three uppercase letters`);
    if (!BOUNDARY_STATUSES.has(row.boundary_review_status)) errors.push(`line ${line}: invalid boundary_review_status`);
    if (row.boundary_review_status === 'REVIEWED' && !row.boundary_ref.trim()) {
      errors.push(`line ${line}: reviewed boundary requires boundary_ref`);
    }
    if (row.boundary_review_status !== 'REVIEWED' && row.boundary_ref.trim()) {
      errors.push(`line ${line}: unreviewed boundary must not provide boundary_ref`);
    }
    validateCoordinatePair(row, line, errors);
    if (!HS_MAPPING_STATUSES.has(row.hs_mapping_status)) errors.push(`line ${line}: invalid hs_mapping_status`);
    if (row.hs_mapping_status === 'REVIEWED') {
      if (!row.hs_version.trim()) errors.push(`line ${line}: reviewed HS mapping requires hs_version`);
      if (!/^\d{2}(?:\d{2}){0,2}$/.test(row.hs_code)) errors.push(`line ${line}: reviewed hs_code must be HS2, HS4 or HS6 digits`);
    } else if (row.hs_version.trim() || row.hs_code.trim()) {
      errors.push(`line ${line}: SOURCE_REQUIRED HS mapping must not claim a version or code`);
    }
    if (row.source_url.trim() && !isHttpsUrl(row.source_url)) errors.push(`line ${line}: source_url must use HTTPS`);
    if (row.record_status === 'REVIEWED' && !isHttpsUrl(row.source_url)) errors.push(`line ${line}: reviewed record requires an HTTPS source_url`);
    if (row.source_published_at.trim() && !/^20\d{2}-\d{2}-\d{2}$/.test(row.source_published_at)) {
      errors.push(`line ${line}: source_published_at must use YYYY-MM-DD`);
    }
    if (!COVERAGE_STATUSES.has(row.coverage_status)) errors.push(`line ${line}: invalid coverage_status`);
    if (!['true', 'false'].includes(row.statistics_enabled)) errors.push(`line ${line}: statistics_enabled must be true or false`);
    if (row.statistics_enabled === 'true'
      && (row.record_status !== 'REVIEWED' || row.hs_mapping_status !== 'REVIEWED' || !isHttpsUrl(row.source_url))) {
      errors.push(`line ${line}: statistics require a reviewed record, reviewed HS mapping and HTTPS source`);
    }
  }
  return errors;
}

export function validateIndustryMapCsvText(text) {
  try {
    return validateIndustryMapCsvRows(parseIndustryMapCsv(text));
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

function runCli() {
  const requested = process.argv[2];
  if (!requested) {
    console.error('Usage: node scripts/validate-industry-map-csv.mjs <csv-path>');
    process.exitCode = 2;
    return;
  }
  const filePath = resolve(process.cwd(), requested);
  const errors = validateIndustryMapCsvText(readFileSync(filePath, 'utf8'));
  if (errors.length > 0) {
    console.error(`industry-map CSV invalid (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`industry-map CSV OK: ${filePath}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
