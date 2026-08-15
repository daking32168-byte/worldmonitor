/**
 * Local, provider-neutral import boundary for Global Intelligence master data.
 *
 * The parser and planner are runtime-neutral. They never write on their own:
 * callers must explicitly commit a valid plan through the durable repository.
 */

import {
  assertEvidenceCanEnterFactTable,
  assertStableEntityId,
  type AggregationLevel,
  type EvidenceClass,
  type LicenseStatus,
  type QualityStatus,
  type SourceEvidence,
  type StableEntityId,
  type StableEntityPrefix,
} from './global-intelligence-contract';

export const GLOBAL_INTELLIGENCE_IMPORT_DATASETS = [
  'geo_units',
  'industry_clusters',
  'product_taxonomy',
  'product_hs_mappings',
  'trade_flows',
] as const;

export type GlobalIntelligenceImportDataset = (typeof GLOBAL_INTELLIGENCE_IMPORT_DATASETS)[number];

export const GLOBAL_INTELLIGENCE_IMPORT_HEADERS: Readonly<Record<GlobalIntelligenceImportDataset, readonly string[]>> = Object.freeze({
  geo_units: Object.freeze([
    'geo_id', 'parent_geo_id', 'level', 'country_iso2', 'country_iso3', 'subdivision_code',
    'local_name', 'zh_name', 'en_name', 'alternate_names', 'centroid_lat', 'centroid_lon',
    'boundary_ref', 'boundary_review_status', 'timezone_ids', 'source_id',
  ]),
  industry_clusters: Object.freeze([
    'cluster_id', 'canonical_name', 'alternate_names', 'geo_scope_ids', 'cluster_type',
    'official_recognition_status', 'recognizing_authority', 'recognition_date',
    'industry_category_ids', 'coverage_status', 'coverage_note', 'source_id',
  ]),
  product_taxonomy: Object.freeze([
    'product_id', 'parent_product_id', 'industry_category', 'local_name', 'zh_name',
    'en_name', 'synonyms', 'process_tags', 'material_tags',
  ]),
  product_hs_mappings: Object.freeze([
    'mapping_id', 'product_id', 'hs_version', 'hs_code', 'mapping_scope',
    'mapping_status', 'valid_from', 'valid_to', 'source_id',
  ]),
  trade_flows: Object.freeze([
    'flow_id', 'reporter_geo_id', 'origin_geo_id', 'origin_aggregation_level',
    'destination_geo_id', 'product_id', 'hs_version', 'hs_code', 'period_start',
    'period_end', 'trade_direction', 'value', 'value_currency', 'quantity',
    'quantity_unit', 'net_weight_kg', 'transport_mode', 'customs_or_port_ref', 'source_id',
  ]),
});

export const GLOBAL_INTELLIGENCE_IMPORT_LIMITS = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  maxRows: 10_000,
  maxColumns: 64,
});

export type ImportPermittedUse = 'LOCAL_ANALYSIS' | 'DISPLAY' | 'EXPORT';

export type GlobalIntelligenceImportManifest = Readonly<{
  sourceId: StableEntityId;
  providerId: string;
  publisher: string;
  sourceTitle: string;
  sourceUrl: string | null;
  sourceReference: string;
  sourcePublishedAt: string | null;
  licenseStatus: LicenseStatus;
  licenseReference: string;
  permittedUses: readonly ImportPermittedUse[];
  evidenceClass: EvidenceClass;
  aggregationLevel: AggregationLevel;
  qualityStatus: QualityStatus;
}>;

export type GlobalIntelligenceImportSubmission = Readonly<{
  dataset: GlobalIntelligenceImportDataset;
  fileName: string;
  csvText: string;
  manifest: GlobalIntelligenceImportManifest;
}>;

export type NormalizedImportValue = string | number | boolean | null | readonly string[];

export type NormalizedImportRecord = Readonly<{
  dataset: GlobalIntelligenceImportDataset;
  recordId: string;
  sourceEvidenceId: StableEntityId;
  values: Readonly<Record<string, NormalizedImportValue>>;
}>;

export type ImportRecordBuckets = Readonly<Record<
  GlobalIntelligenceImportDataset,
  Readonly<Record<string, NormalizedImportRecord>>
>>;

export type StoredImportEvidence = Readonly<{
  evidence: SourceEvidence;
  publisher: string;
  licenseReference: string;
  permittedUses: readonly ImportPermittedUse[];
  fileSha256: string;
  fileName: string;
  importedAt: string;
}>;

export type GlobalIntelligenceImportCommit = Readonly<{
  importId: string;
  dataset: GlobalIntelligenceImportDataset;
  fileName: string;
  fileSha256: string;
  sourceEvidenceId: StableEntityId;
  committedAt: string;
  previousRevision: number;
  revision: number;
  insertedRecordIds: readonly string[];
  unchangedRecordIds: readonly string[];
}>;

export type GlobalIntelligenceSnapshot = Readonly<{
  schemaVersion: 1;
  revision: number;
  records: ImportRecordBuckets;
  evidence: Readonly<Record<string, StoredImportEvidence>>;
  history: readonly GlobalIntelligenceImportCommit[];
}>;

export type ImportIssue = Readonly<{
  line: number | null;
  field: string | null;
  code: string;
  message: string;
}>;

export type GlobalIntelligenceImportPlan = Readonly<{
  status: 'INVALID' | 'READY' | 'NO_CHANGE';
  dataset: GlobalIntelligenceImportDataset;
  fileName: string;
  fileSha256: string;
  processedAt: string;
  issues: readonly ImportIssue[];
  inserts: readonly NormalizedImportRecord[];
  unchangedRecordIds: readonly string[];
  sourceEvidence: StoredImportEvidence | null;
  baseRevision: number;
}>;

export type GlobalIntelligenceImportResult = Readonly<{
  status: 'INVALID' | 'READY' | 'NO_CHANGE' | 'COMMITTED';
  plan: GlobalIntelligenceImportPlan;
  snapshot: GlobalIntelligenceSnapshot;
}>;

type ParsedCsvRow = Readonly<{ line: number; cells: readonly string[] }>;
type ParsedCsv = Readonly<{ headers: readonly string[]; rows: readonly ParsedCsvRow[] }>;

function emptyRecordBuckets(): ImportRecordBuckets {
  return {
    geo_units: {},
    industry_clusters: {},
    product_taxonomy: {},
    product_hs_mappings: {},
    trade_flows: {},
  };
}

export function createEmptyGlobalIntelligenceSnapshot(): GlobalIntelligenceSnapshot {
  return {
    schemaVersion: 1,
    revision: 0,
    records: emptyRecordBuckets(),
    evidence: {},
    history: [],
  };
}

function issue(line: number | null, field: string | null, code: string, message: string): ImportIssue {
  return { line, field, code, message };
}

function parseCsv(csvText: string): ParsedCsv {
  if (csvText.includes('\0')) throw new Error('CSV contains a NUL byte');

  const parsedRows: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let quoteClosed = false;
  let currentLine = 1;
  let rowStartLine = 1;

  const pushCell = () => {
    cells.push(cell);
    cell = '';
    quoteClosed = false;
  };
  const pushRow = () => {
    pushCell();
    if (!cells.every((value) => value.length === 0)) parsedRows.push({ line: rowStartLine, cells });
    cells = [];
    rowStartLine = currentLine + 1;
  };

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (csvText[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        cell += char;
        if (char === '\n') currentLine += 1;
      }
      continue;
    }

    if (quoteClosed && char !== ',' && char !== '\r' && char !== '\n') {
      throw new Error(`CSV line ${currentLine} has characters after a closing quote`);
    }
    if (char === '"') {
      if (cell.length > 0) throw new Error(`CSV line ${currentLine} has a quote inside an unquoted field`);
      inQuotes = true;
    } else if (char === ',') {
      pushCell();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && csvText[index + 1] === '\n') index += 1;
      pushRow();
      currentLine += 1;
      rowStartLine = currentLine;
    } else {
      cell += char;
    }
  }

  if (inQuotes) throw new Error(`CSV line ${rowStartLine} has an unclosed quoted field`);
  if (cell.length > 0 || cells.length > 0) pushRow();
  if (parsedRows.length === 0) throw new Error('CSV is empty');

  const [headerRow, ...rows] = parsedRows;
  const headers = headerRow!.cells.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/u, '') : value).trim());
  if (headers.length > GLOBAL_INTELLIGENCE_IMPORT_LIMITS.maxColumns) throw new Error('CSV has too many columns');
  if (headers.some((header) => !header)) throw new Error('CSV contains an empty header');
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate headers');
  if (rows.length > GLOBAL_INTELLIGENCE_IMPORT_LIMITS.maxRows) throw new Error('CSV has too many rows');
  for (const row of rows) {
    if (row.cells.length !== headers.length) {
      throw new Error(`CSV line ${row.line} has ${row.cells.length} cells; expected ${headers.length}`);
    }
  }
  return { headers, rows };
}

function rowObject(headers: readonly string[], row: ParsedCsvRow): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, row.cells[index] ?? '']));
}

function trimmed(row: Readonly<Record<string, string>>, field: string): string {
  return (row[field] ?? '').trim();
}

function requiredText(row: Readonly<Record<string, string>>, field: string, line: number, issues: ImportIssue[]): string {
  const value = trimmed(row, field);
  if (!value) issues.push(issue(line, field, 'REQUIRED', `${field} is required`));
  return value;
}

function optionalText(row: Readonly<Record<string, string>>, field: string): string | null {
  return trimmed(row, field) || null;
}

function listValue(row: Readonly<Record<string, string>>, field: string): readonly string[] {
  const raw = trimmed(row, field);
  if (!raw) return [];
  return [...new Set(raw.split('|').map((value) => value.trim()).filter(Boolean))];
}

function enumValue<T extends string>(
  row: Readonly<Record<string, string>>,
  field: string,
  values: readonly T[],
  line: number,
  issues: ImportIssue[],
): T {
  const value = requiredText(row, field, line, issues);
  if (!values.includes(value as T)) issues.push(issue(line, field, 'ENUM', `${field} must be one of ${values.join(', ')}`));
  return value as T;
}

function optionalNumber(row: Readonly<Record<string, string>>, field: string, line: number, issues: ImportIssue[]): number | null {
  const value = optionalText(row, field);
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) issues.push(issue(line, field, 'NUMBER', `${field} must be a finite number`));
  return parsed;
}

function optionalTimestamp(row: Readonly<Record<string, string>>, field: string, line: number, issues: ImportIssue[]): string | null {
  const value = optionalText(row, field);
  if (value !== null && !Number.isFinite(Date.parse(value))) issues.push(issue(line, field, 'TIMESTAMP', `${field} must be an ISO-compatible timestamp`));
  return value;
}

function requiredTimestamp(row: Readonly<Record<string, string>>, field: string, line: number, issues: ImportIssue[]): string {
  const value = requiredText(row, field, line, issues);
  if (value && !Number.isFinite(Date.parse(value))) issues.push(issue(line, field, 'TIMESTAMP', `${field} must be an ISO-compatible timestamp`));
  return value;
}

function stableId(
  row: Readonly<Record<string, string>>,
  field: string,
  prefix: StableEntityPrefix,
  line: number,
  issues: ImportIssue[],
  optional = false,
): StableEntityId | null {
  const value = optional ? optionalText(row, field) : requiredText(row, field, line, issues);
  if (value === null || value === '') return null;
  try {
    assertStableEntityId(value, prefix);
  } catch (error) {
    issues.push(issue(line, field, 'STABLE_ID', error instanceof Error ? error.message : String(error)));
  }
  return value as StableEntityId;
}

function stableIdList(
  row: Readonly<Record<string, string>>,
  field: string,
  prefix: StableEntityPrefix,
  line: number,
  issues: ImportIssue[],
): readonly StableEntityId[] {
  const values = listValue(row, field);
  if (values.length === 0) issues.push(issue(line, field, 'REQUIRED', `${field} requires at least one ID`));
  for (const value of values) {
    try {
      assertStableEntityId(value, prefix);
    } catch (error) {
      issues.push(issue(line, field, 'STABLE_ID', error instanceof Error ? error.message : String(error)));
    }
  }
  return values as readonly StableEntityId[];
}

/**
 * Bind a row to the source selected in the import manifest.
 *
 * The desktop UI derives the manifest source ID from the selected file hash.
 * Requiring that same ID inside the file would create a circular dependency:
 * changing the CSV to add the hash-derived ID changes the hash again. A blank
 * row source therefore means "use the verified manifest source". An explicit
 * value is still validated and must match, preserving the anti-mixing gate.
 */
function rowSourceId(
  row: Readonly<Record<string, string>>,
  line: number,
  expected: StableEntityId,
  issues: ImportIssue[],
): StableEntityId {
  const value = optionalText(row, 'source_id');
  if (value === null) return expected;
  try {
    assertStableEntityId(value, 'source');
  } catch (error) {
    issues.push(issue(line, 'source_id', 'STABLE_ID', error instanceof Error ? error.message : String(error)));
  }
  if (value !== expected) issues.push(issue(line, 'source_id', 'SOURCE_MISMATCH', 'source_id must be blank or match the selected import manifest'));
  return value as StableEntityId;
}

function normalizedRecord(
  dataset: GlobalIntelligenceImportDataset,
  row: Readonly<Record<string, string>>,
  line: number,
  sourceEvidenceId: StableEntityId,
  issues: ImportIssue[],
): NormalizedImportRecord {
  if (dataset === 'geo_units') {
    const recordId = stableId(row, 'geo_id', 'geo', line, issues) ?? '';
    const lat = optionalNumber(row, 'centroid_lat', line, issues);
    const lon = optionalNumber(row, 'centroid_lon', line, issues);
    if ((lat === null) !== (lon === null)) issues.push(issue(line, 'centroid_lat', 'COORDINATE_PAIR', 'centroid_lat and centroid_lon must both be present or both be empty'));
    if (lat !== null && (lat < -90 || lat > 90)) issues.push(issue(line, 'centroid_lat', 'RANGE', 'centroid_lat must be between -90 and 90'));
    if (lon !== null && (lon < -180 || lon > 180)) issues.push(issue(line, 'centroid_lon', 'RANGE', 'centroid_lon must be between -180 and 180'));
    rowSourceId(row, line, sourceEvidenceId, issues);
    const countryIso2 = requiredText(row, 'country_iso2', line, issues).toUpperCase();
    const countryIso3 = requiredText(row, 'country_iso3', line, issues).toUpperCase();
    if (!/^[A-Z]{2}$/u.test(countryIso2)) issues.push(issue(line, 'country_iso2', 'ISO_CODE', 'country_iso2 must contain exactly two ASCII letters'));
    if (!/^[A-Z]{3}$/u.test(countryIso3)) issues.push(issue(line, 'country_iso3', 'ISO_CODE', 'country_iso3 must contain exactly three ASCII letters'));
    const timezoneIds = listValue(row, 'timezone_ids');
    if (timezoneIds.length === 0) issues.push(issue(line, 'timezone_ids', 'REQUIRED', 'timezone_ids requires at least one IANA timezone'));
    return {
      dataset,
      recordId,
      sourceEvidenceId,
      values: {
        geo_id: recordId,
        parent_geo_id: stableId(row, 'parent_geo_id', 'geo', line, issues, true),
        level: enumValue(row, 'level', ['WORLD', 'COUNTRY', 'STATE_PROVINCE', 'CITY', 'COUNTY_DISTRICT', 'TOWN', 'INDUSTRIAL_PARK'], line, issues),
        country_iso2: countryIso2,
        country_iso3: countryIso3,
        subdivision_code: optionalText(row, 'subdivision_code'),
        local_name: requiredText(row, 'local_name', line, issues),
        zh_name: requiredText(row, 'zh_name', line, issues),
        en_name: optionalText(row, 'en_name'),
        alternate_names: listValue(row, 'alternate_names'),
        centroid_lat: lat,
        centroid_lon: lon,
        boundary_ref: optionalText(row, 'boundary_ref'),
        boundary_review_status: enumValue(row, 'boundary_review_status', ['REVIEWED', 'NOT_REVIEWED', 'SOURCE_REQUIRED'], line, issues),
        timezone_ids: timezoneIds,
        source_evidence_ids: [sourceEvidenceId],
      },
    };
  }

  if (dataset === 'industry_clusters') {
    const recordId = stableId(row, 'cluster_id', 'cluster', line, issues) ?? '';
    rowSourceId(row, line, sourceEvidenceId, issues);
    const industryCategoryIds = listValue(row, 'industry_category_ids');
    if (industryCategoryIds.length === 0) issues.push(issue(line, 'industry_category_ids', 'REQUIRED', 'industry_category_ids requires at least one category'));
    return {
      dataset,
      recordId,
      sourceEvidenceId,
      values: {
        cluster_id: recordId,
        canonical_name: requiredText(row, 'canonical_name', line, issues),
        alternate_names: listValue(row, 'alternate_names'),
        geo_scope_ids: stableIdList(row, 'geo_scope_ids', 'geo', line, issues),
        cluster_type: enumValue(row, 'cluster_type', ['REGIONAL_INDUSTRY_CLUSTER'], line, issues),
        official_recognition_status: enumValue(row, 'official_recognition_status', ['OFFICIALLY_LISTED', 'OFFICIAL_SOURCE_MENTIONED'], line, issues),
        recognizing_authority: requiredText(row, 'recognizing_authority', line, issues),
        recognition_date: optionalTimestamp(row, 'recognition_date', line, issues),
        industry_category_ids: industryCategoryIds,
        coverage_status: enumValue(row, 'coverage_status', ['PARTIAL', 'REFERENCE_ONLY'], line, issues),
        coverage_note: requiredText(row, 'coverage_note', line, issues),
        source_evidence_ids: [sourceEvidenceId],
        statistics_enabled: false,
        statistics_status: 'DISABLED_PENDING_HS_REVIEW',
      },
    };
  }

  if (dataset === 'product_taxonomy') {
    const recordId = stableId(row, 'product_id', 'product', line, issues) ?? '';
    return {
      dataset,
      recordId,
      sourceEvidenceId,
      values: {
        product_id: recordId,
        parent_product_id: stableId(row, 'parent_product_id', 'product', line, issues, true),
        industry_category: requiredText(row, 'industry_category', line, issues),
        local_name: requiredText(row, 'local_name', line, issues),
        zh_name: requiredText(row, 'zh_name', line, issues),
        en_name: optionalText(row, 'en_name'),
        synonyms: listValue(row, 'synonyms'),
        process_tags: listValue(row, 'process_tags'),
        material_tags: listValue(row, 'material_tags'),
        source_evidence_ids: [sourceEvidenceId],
      },
    };
  }

  if (dataset === 'trade_flows') {
    const recordId = stableId(row, 'flow_id', 'flow', line, issues) ?? '';
    rowSourceId(row, line, sourceEvidenceId, issues);
    const hsCode = requiredText(row, 'hs_code', line, issues);
    if (!/^\d{2,10}$/u.test(hsCode)) issues.push(issue(line, 'hs_code', 'HS_CODE', 'hs_code must contain 2–10 digits'));
    const periodStart = requiredTimestamp(row, 'period_start', line, issues);
    const periodEnd = requiredTimestamp(row, 'period_end', line, issues);
    if (Number.isFinite(Date.parse(periodStart)) && Number.isFinite(Date.parse(periodEnd)) && Date.parse(periodStart) > Date.parse(periodEnd)) {
      issues.push(issue(line, 'period_end', 'PERIOD_ORDER', 'period_end must not be before period_start'));
    }
    const value = optionalNumber(row, 'value', line, issues);
    const valueCurrency = optionalText(row, 'value_currency');
    const quantity = optionalNumber(row, 'quantity', line, issues);
    const quantityUnit = optionalText(row, 'quantity_unit');
    const netWeightKg = optionalNumber(row, 'net_weight_kg', line, issues);
    for (const [field, number] of [['value', value], ['quantity', quantity], ['net_weight_kg', netWeightKg]] as const) {
      if (number !== null && number < 0) issues.push(issue(line, field, 'RANGE', `${field} must be non-negative`));
    }
    if ((value === null) !== (valueCurrency === null)) issues.push(issue(line, 'value_currency', 'VALUE_UNIT_PAIR', 'value and value_currency must both be present or both be empty'));
    if ((quantity === null) !== (quantityUnit === null)) issues.push(issue(line, 'quantity_unit', 'VALUE_UNIT_PAIR', 'quantity and quantity_unit must both be present or both be empty'));
    const transport = optionalText(row, 'transport_mode');
    if (transport !== null && !['SEA', 'AIR', 'RAIL', 'ROAD', 'MULTIMODAL'].includes(transport)) {
      issues.push(issue(line, 'transport_mode', 'ENUM', 'transport_mode must be SEA, AIR, RAIL, ROAD or MULTIMODAL'));
    }
    return {
      dataset,
      recordId,
      sourceEvidenceId,
      values: {
        flow_id: recordId,
        reporter_geo_id: stableId(row, 'reporter_geo_id', 'geo', line, issues) ?? '',
        origin_geo_id: stableId(row, 'origin_geo_id', 'geo', line, issues) ?? '',
        origin_aggregation_level: enumValue(row, 'origin_aggregation_level', ['COUNTRY', 'STATE_PROVINCE', 'CITY', 'COUNTY_DISTRICT'], line, issues),
        destination_geo_id: stableId(row, 'destination_geo_id', 'geo', line, issues) ?? '',
        product_id: stableId(row, 'product_id', 'product', line, issues) ?? '',
        hs_version: requiredText(row, 'hs_version', line, issues),
        hs_code: hsCode,
        period_start: periodStart,
        period_end: periodEnd,
        trade_direction: enumValue(row, 'trade_direction', ['EXPORT', 'IMPORT', 'RE_EXPORT'], line, issues),
        value,
        value_currency: valueCurrency,
        quantity,
        quantity_unit: quantityUnit,
        net_weight_kg: netWeightKg,
        transport_mode: transport,
        customs_or_port_ref: optionalText(row, 'customs_or_port_ref'),
        provider_id: '',
        evidence_id: sourceEvidenceId,
        quality_status: '',
      },
    };
  }

  const recordId = requiredText(row, 'mapping_id', line, issues);
  if (!/^mapping_[a-z0-9][a-z0-9._-]*$/u.test(recordId)) issues.push(issue(line, 'mapping_id', 'STABLE_ID', 'mapping_id must use the mapping_ opaque-ID format'));
  rowSourceId(row, line, sourceEvidenceId, issues);
  const hsVersion = requiredText(row, 'hs_version', line, issues);
  if (!/^HS ?\d{4}$/u.test(hsVersion)) issues.push(issue(line, 'hs_version', 'HS_VERSION', 'hs_version must use HS followed by a four-digit edition year'));
  const hsCode = requiredText(row, 'hs_code', line, issues);
  const mappingScope = enumValue(row, 'mapping_scope', ['HS2', 'HS4', 'HS6'], line, issues);
  const expectedHsLength = Number(mappingScope.slice(2));
  if (!new RegExp(`^\\d{${expectedHsLength}}$`, 'u').test(hsCode)) issues.push(issue(line, 'hs_code', 'HS_CODE', `hs_code must contain ${expectedHsLength} digits for ${mappingScope}`));
  return {
    dataset,
    recordId,
    sourceEvidenceId,
    values: {
      mapping_id: recordId,
      product_id: stableId(row, 'product_id', 'product', line, issues) ?? '',
      hs_version: hsVersion,
      hs_code: hsCode,
      mapping_scope: mappingScope,
      mapping_status: enumValue(row, 'mapping_status', ['REVIEWED'], line, issues),
      valid_from: optionalTimestamp(row, 'valid_from', line, issues),
      valid_to: optionalTimestamp(row, 'valid_to', line, issues),
      source_evidence_ids: [sourceEvidenceId],
    },
  };
}

function manifestEvidence(
  submission: GlobalIntelligenceImportSubmission,
  fileSha256: string,
  processedAt: string,
  issues: ImportIssue[],
): StoredImportEvidence | null {
  const { manifest } = submission;
  if (!submission.fileName.trim()) issues.push(issue(null, 'fileName', 'REQUIRED', 'fileName is required'));
  if (!manifest.publisher.trim()) issues.push(issue(null, 'publisher', 'REQUIRED', 'publisher is required'));
  if (!manifest.providerId.trim()) issues.push(issue(null, 'providerId', 'REQUIRED', 'providerId is required'));
  if (!manifest.sourceTitle.trim()) issues.push(issue(null, 'sourceTitle', 'REQUIRED', 'sourceTitle is required'));
  if (!manifest.sourceReference.trim()) issues.push(issue(null, 'sourceReference', 'REQUIRED', 'sourceReference is required'));
  if (!manifest.licenseReference.trim()) issues.push(issue(null, 'licenseReference', 'REQUIRED', 'licenseReference is required'));
  if (!manifest.permittedUses.includes('LOCAL_ANALYSIS') || !manifest.permittedUses.includes('DISPLAY')) {
    issues.push(issue(null, 'permittedUses', 'LICENSE_SCOPE', 'permittedUses must include LOCAL_ANALYSIS and DISPLAY'));
  }
  if (!Number.isFinite(Date.parse(processedAt))) issues.push(issue(null, 'processedAt', 'TIMESTAMP', 'processedAt must be an ISO-compatible timestamp'));
  if (submission.dataset === 'trade_flows') {
    if (manifest.evidenceClass !== 'OBSERVED_TRADE') issues.push(issue(null, 'evidenceClass', 'EVIDENCE_CLASS', 'trade_flows requires OBSERVED_TRADE evidence'));
    if (!['COUNTRY', 'STATE_PROVINCE', 'CITY', 'COUNTY_DISTRICT'].includes(manifest.aggregationLevel)) {
      issues.push(issue(null, 'aggregationLevel', 'AGGREGATION', 'trade_flows requires a supported customs aggregation level'));
    }
  }

  let sourceId = manifest.sourceId;
  try {
    assertStableEntityId(sourceId, 'source');
  } catch (error) {
    issues.push(issue(null, 'sourceId', 'STABLE_ID', error instanceof Error ? error.message : String(error)));
    sourceId = 'source_invalid' as StableEntityId;
  }

  const evidence: SourceEvidence = {
    sourceId,
    providerId: manifest.providerId,
    sourceType: 'USER_SELECTED_LOCAL_FILE_IMPORT',
    sourceTitle: `${manifest.sourceTitle} (${submission.fileName})`,
    sourceUrl: manifest.sourceUrl,
    sourceReference: `${manifest.sourceReference}; sha256:${fileSha256}`,
    sourcePublishedAt: manifest.sourcePublishedAt,
    observedAt: null,
    retrievedAt: processedAt,
    validFrom: null,
    validTo: null,
    periodStart: null,
    periodEnd: null,
    evidenceClass: manifest.evidenceClass,
    aggregationLevel: manifest.aggregationLevel,
    licenseStatus: manifest.licenseStatus,
    freshnessStatus: 'NOT_APPLICABLE',
    qualityStatus: manifest.qualityStatus,
    confidence: null,
    methodologyVersion: null,
    nullReasons: {
      ...(manifest.sourceUrl === null ? { sourceUrl: { code: 'NOT_PROVIDED' as const, explanation: 'The manifest provides a traceable non-URL source reference.' } } : {}),
      ...(manifest.sourcePublishedAt === null ? { sourcePublishedAt: { code: 'NOT_PROVIDED' as const, explanation: 'The manifest does not provide a publication timestamp.' } } : {}),
      observedAt: { code: 'NOT_APPLICABLE', explanation: 'This master-data file is not a live observation.' },
      validFrom: { code: 'NOT_PROVIDED', explanation: 'Validity is defined per row when the dataset supports it.' },
      validTo: { code: 'NOT_PROVIDED', explanation: 'Validity is defined per row when the dataset supports it.' },
      periodStart: { code: 'NOT_APPLICABLE', explanation: 'This import contains master data rather than a measured period.' },
      periodEnd: { code: 'NOT_APPLICABLE', explanation: 'This import contains master data rather than a measured period.' },
      confidence: { code: 'NOT_APPLICABLE', explanation: 'No model confidence is assigned to imported source records.' },
      methodologyVersion: { code: 'NOT_APPLICABLE', explanation: 'No model generated these imported source records.' },
    },
  };

  try {
    assertEvidenceCanEnterFactTable(evidence);
  } catch (error) {
    issues.push(issue(null, 'manifest', 'FACT_ADMISSION', error instanceof Error ? error.message : String(error)));
  }
  if (issues.length > 0) return null;
  return {
    evidence,
    publisher: manifest.publisher,
    licenseReference: manifest.licenseReference,
    permittedUses: [...new Set(manifest.permittedUses)],
    fileSha256,
    fileName: submission.fileName,
    importedAt: processedAt,
  };
}

function canonicalRecord(record: NormalizedImportRecord): string {
  return JSON.stringify(record);
}

function referencedIds(record: NormalizedImportRecord): readonly Readonly<{ dataset: GlobalIntelligenceImportDataset; id: string; field: string }>[] {
  if (record.dataset === 'geo_units') {
    const parent = record.values.parent_geo_id;
    return typeof parent === 'string' ? [{ dataset: 'geo_units', id: parent, field: 'parent_geo_id' }] : [];
  }
  if (record.dataset === 'industry_clusters') {
    const ids = record.values.geo_scope_ids;
    return Array.isArray(ids) ? ids.map((id) => ({ dataset: 'geo_units' as const, id, field: 'geo_scope_ids' })) : [];
  }
  if (record.dataset === 'product_taxonomy') {
    const parent = record.values.parent_product_id;
    return typeof parent === 'string' ? [{ dataset: 'product_taxonomy', id: parent, field: 'parent_product_id' }] : [];
  }
  if (record.dataset === 'trade_flows') {
    const references: Array<{ dataset: GlobalIntelligenceImportDataset; id: string; field: string }> = [];
    for (const field of ['reporter_geo_id', 'origin_geo_id', 'destination_geo_id'] as const) {
      const id = record.values[field];
      if (typeof id === 'string') references.push({ dataset: 'geo_units', id, field });
    }
    const productId = record.values.product_id;
    if (typeof productId === 'string') references.push({ dataset: 'product_taxonomy', id: productId, field: 'product_id' });
    return references;
  }
  const productId = record.values.product_id;
  return typeof productId === 'string' ? [{ dataset: 'product_taxonomy', id: productId, field: 'product_id' }] : [];
}

export async function sha256Text(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto SHA-256 is unavailable in this runtime');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function planGlobalIntelligenceImport(
  submission: GlobalIntelligenceImportSubmission,
  snapshot: GlobalIntelligenceSnapshot,
  processedAt: string,
): Promise<GlobalIntelligenceImportPlan> {
  const issues: ImportIssue[] = [];
  const byteLength = new TextEncoder().encode(submission.csvText).byteLength;
  const fileSha256 = await sha256Text(submission.csvText);
  const base = {
    dataset: submission.dataset,
    fileName: submission.fileName,
    fileSha256,
    processedAt,
    baseRevision: snapshot.revision,
  } as const;

  if (byteLength > GLOBAL_INTELLIGENCE_IMPORT_LIMITS.maxBytes) {
    return { ...base, status: 'INVALID', issues: [issue(null, 'csvText', 'FILE_SIZE', 'CSV exceeds the 5 MiB local import limit')], inserts: [], unchangedRecordIds: [], sourceEvidence: null };
  }
  if (snapshot.history.some((entry) => entry.dataset === submission.dataset && entry.fileSha256 === fileSha256)) {
    return { ...base, status: 'NO_CHANGE', issues: [], inserts: [], unchangedRecordIds: [], sourceEvidence: null };
  }

  let parsed: ParsedCsv;
  try {
    parsed = parseCsv(submission.csvText);
  } catch (error) {
    return { ...base, status: 'INVALID', issues: [issue(null, null, 'CSV_PARSE', error instanceof Error ? error.message : String(error))], inserts: [], unchangedRecordIds: [], sourceEvidence: null };
  }

  const expectedHeaders = GLOBAL_INTELLIGENCE_IMPORT_HEADERS[submission.dataset];
  for (const header of expectedHeaders) if (!parsed.headers.includes(header)) issues.push(issue(1, header, 'MISSING_HEADER', `Missing required header ${header}`));
  for (const header of parsed.headers) if (!expectedHeaders.includes(header)) issues.push(issue(1, header, 'UNKNOWN_HEADER', `Unknown header ${header}`));
  if (parsed.rows.length === 0) issues.push(issue(null, null, 'NO_ROWS', 'CSV contains headers but no data rows'));

  const sourceEvidence = manifestEvidence(submission, fileSha256, processedAt, issues);
  if (issues.length > 0) return { ...base, status: 'INVALID', issues, inserts: [], unchangedRecordIds: [], sourceEvidence: null };

  const normalizedRows = parsed.rows.map((row) => normalizedRecord(
    submission.dataset,
    rowObject(parsed.headers, row),
    row.line,
    submission.manifest.sourceId,
    issues,
  ));
  if (submission.dataset === 'trade_flows' && sourceEvidence) {
    for (const record of normalizedRows) {
      (record.values as Record<string, NormalizedImportValue>).provider_id = sourceEvidence.evidence.providerId;
      (record.values as Record<string, NormalizedImportValue>).quality_status = sourceEvidence.evidence.qualityStatus;
      if (record.values.origin_aggregation_level !== sourceEvidence.evidence.aggregationLevel) {
        issues.push(issue(parsed.rows[normalizedRows.indexOf(record)]?.line ?? null, 'origin_aggregation_level', 'AGGREGATION_MISMATCH', 'row origin_aggregation_level must match the evidence aggregation level'));
      }
    }
  }
  const rowLines = new Map(normalizedRows.map((record, index) => [record.recordId, parsed.rows[index]!.line]));
  const seenIds = new Set<string>();
  for (let index = 0; index < normalizedRows.length; index += 1) {
    const record = normalizedRows[index]!;
    const line = parsed.rows[index]!.line;
    if (seenIds.has(record.recordId)) issues.push(issue(line, null, 'DUPLICATE_ID', `Duplicate record ID ${record.recordId}`));
    seenIds.add(record.recordId);
  }

  const available = new Map<GlobalIntelligenceImportDataset, Set<string>>(
    GLOBAL_INTELLIGENCE_IMPORT_DATASETS.map((dataset) => [dataset, new Set(Object.keys(snapshot.records[dataset]))]),
  );
  for (const record of normalizedRows) available.get(record.dataset)!.add(record.recordId);
  for (const record of normalizedRows) {
    for (const reference of referencedIds(record)) {
      if (!available.get(reference.dataset)!.has(reference.id)) {
        issues.push(issue(rowLines.get(record.recordId) ?? null, reference.field, 'MISSING_REFERENCE', `${reference.field} references missing ${reference.dataset} record ${reference.id}`));
      }
    }
  }

  const existingEvidence = snapshot.evidence[submission.manifest.sourceId];
  if (existingEvidence && existingEvidence.fileSha256 !== fileSha256) {
    issues.push(issue(null, 'sourceId', 'SOURCE_CONFLICT', `Source evidence ${submission.manifest.sourceId} already belongs to a different file`));
  }

  const inserts: NormalizedImportRecord[] = [];
  const unchangedRecordIds: string[] = [];
  for (const record of normalizedRows) {
    const existing = snapshot.records[submission.dataset][record.recordId];
    if (!existing) inserts.push(record);
    else if (canonicalRecord(existing) === canonicalRecord(record)) unchangedRecordIds.push(record.recordId);
    else issues.push(issue(rowLines.get(record.recordId) ?? null, null, 'RECORD_CONFLICT', `${record.recordId} already exists with different values; imports never overwrite a source conflict`));
  }

  if (issues.length > 0) return { ...base, status: 'INVALID', issues, inserts: [], unchangedRecordIds, sourceEvidence: null };
  if (inserts.length === 0) return { ...base, status: 'NO_CHANGE', issues: [], inserts: [], unchangedRecordIds, sourceEvidence };
  return { ...base, status: 'READY', issues: [], inserts, unchangedRecordIds, sourceEvidence };
}

export function commitGlobalIntelligenceImport(
  plan: GlobalIntelligenceImportPlan,
  snapshot: GlobalIntelligenceSnapshot,
): GlobalIntelligenceImportResult {
  if (snapshot.revision !== plan.baseRevision) throw new Error('Import plan is stale; run dry-run again against the current revision');
  if (plan.status === 'INVALID') return { status: 'INVALID', plan, snapshot };
  if (plan.status === 'NO_CHANGE') return { status: 'NO_CHANGE', plan, snapshot };
  if (!plan.sourceEvidence) throw new Error('A ready import plan must contain source evidence');

  const nextRevision = snapshot.revision + 1;
  const datasetRecords = { ...snapshot.records[plan.dataset] };
  for (const record of plan.inserts) datasetRecords[record.recordId] = record;
  const nextSnapshot: GlobalIntelligenceSnapshot = {
    schemaVersion: 1,
    revision: nextRevision,
    records: {
      ...snapshot.records,
      [plan.dataset]: datasetRecords,
    },
    evidence: {
      ...snapshot.evidence,
      [plan.sourceEvidence.evidence.sourceId]: plan.sourceEvidence,
    },
    history: [
      ...snapshot.history,
      {
        importId: `import_${plan.dataset}_${plan.fileSha256.slice(0, 16)}`,
        dataset: plan.dataset,
        fileName: plan.fileName,
        fileSha256: plan.fileSha256,
        sourceEvidenceId: plan.sourceEvidence.evidence.sourceId,
        committedAt: plan.processedAt,
        previousRevision: snapshot.revision,
        revision: nextRevision,
        insertedRecordIds: plan.inserts.map((record) => record.recordId),
        unchangedRecordIds: plan.unchangedRecordIds,
      },
    ],
  };
  return { status: 'COMMITTED', plan, snapshot: nextSnapshot };
}
