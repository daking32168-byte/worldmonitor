/**
 * Phase 17 trade-flow and multimodal logistics truth boundary.
 *
 * This module is runtime-neutral so the web app, Tauri sidecar and import tools
 * share the same rules. Production observations start empty: existing AIS,
 * port and route configuration cannot be promoted into cargo facts.
 */

import {
  assertEvidenceCanEnterFactTable,
  assertStableEntityId,
  createStableEntityId,
  type AggregationLevel,
  type QualityStatus,
  type SourceEvidence,
  type StableEntityId,
} from './global-intelligence-contract';

export const TRANSPORT_MODES = ['SEA', 'AIR', 'RAIL', 'ROAD', 'MULTIMODAL'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const LOGISTICS_NODE_TYPES = [
  'FACILITY',
  'WAREHOUSE',
  'CONSOLIDATION_CENTER',
  'ROAD_BORDER',
  'RAIL_TERMINAL',
  'AIR_CARGO_TERMINAL',
  'PORT',
  'TERMINAL',
  'INLAND_WATERWAY_NODE',
  'OVERSEAS_WAREHOUSE',
  'MARKET_DESTINATION',
] as const;
export type LogisticsNodeType = (typeof LOGISTICS_NODE_TYPES)[number];

export type TradeFlowObservation = Readonly<{
  flow_id: StableEntityId;
  reporter_geo_id: StableEntityId;
  origin_geo_id: StableEntityId;
  origin_aggregation_level: AggregationLevel;
  destination_geo_id: StableEntityId;
  product_id: StableEntityId;
  hs_version: string;
  hs_code: string;
  period_start: string;
  period_end: string;
  trade_direction: 'EXPORT' | 'IMPORT' | 'RE_EXPORT';
  value: number | null;
  value_currency: string | null;
  quantity: number | null;
  quantity_unit: string | null;
  net_weight_kg: number | null;
  transport_mode: TransportMode | null;
  customs_or_port_ref: string | null;
  provider_id: string;
  evidence_id: StableEntityId;
  quality_status: QualityStatus;
}>;

export type ShipmentObservation = Readonly<{
  shipment_id: StableEntityId;
  provider_shipment_id: string;
  shipper_company_id: StableEntityId | null;
  consignee_company_id: StableEntityId | null;
  origin_facility_id: StableEntityId | null;
  origin_node_id: StableEntityId;
  destination_node_id: StableEntityId;
  product_description: string | null;
  hs_code: string | null;
  container_count: number | null;
  weight: number | null;
  weight_unit: string | null;
  vessel_imo: string | null;
  bill_of_lading_ref: string | null;
  observed_at: string;
  license_scope: string;
  provider_id: string;
  evidence_id: StableEntityId;
}>;

export type LogisticsNode = Readonly<{
  node_id: StableEntityId;
  node_type: LogisticsNodeType;
  name: string;
  geo_id: StableEntityId | null;
  lat: number | null;
  lon: number | null;
  evidence_ids: readonly StableEntityId[];
}>;

export type LogisticsRoute = Readonly<{
  route_id: StableEntityId;
  origin_node_id: StableEntityId;
  destination_node_id: StableEntityId;
  via_node_ids: readonly StableEntityId[];
  transport_modes: readonly TransportMode[];
  route_class: 'DIRECT' | 'CORRIDOR' | 'ALTERNATIVE' | 'LAST_MILE';
  observed_or_modelled: 'OBSERVED' | 'MODELLED';
  distance_km: number | null;
  estimated_duration_hours: number | null;
  valid_period_start: string | null;
  valid_period_end: string | null;
  methodology_version: string | null;
  evidence_ids: readonly StableEntityId[];
}>;

export type TradeLogisticsRegistry = Readonly<{
  flows: readonly TradeFlowObservation[];
  shipments: readonly ShipmentObservation[];
  nodes: readonly LogisticsNode[];
  routes: readonly LogisticsRoute[];
  evidence: readonly SourceEvidence[];
}>;

export const TRADE_LOGISTICS_REGISTRY: TradeLogisticsRegistry = Object.freeze({
  flows: Object.freeze([]),
  shipments: Object.freeze([]),
  nodes: Object.freeze([]),
  routes: Object.freeze([]),
  evidence: Object.freeze([]),
});

export type ComtradeAdapterInput = Readonly<{
  providerRecordId: string;
  reporterGeoId: StableEntityId;
  partnerGeoId: StableEntityId;
  productId: StableEntityId;
  hsVersion: string;
  hsCode: string;
  periodStart: string;
  periodEnd: string;
  tradeDirection: 'EXPORT' | 'IMPORT' | 'RE_EXPORT';
  value: number | null;
  valueCurrency: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  netWeightKg: number | null;
  transportMode?: TransportMode | null;
  customsOrPortRef?: string | null;
}>;

function finiteNonNegative(value: number | null, field: string): void {
  if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error(`${field} must be null or a finite non-negative number`);
}

function requireTimestamp(value: string, field: string): void {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
}

export function assertTradeFlowObservation(flow: TradeFlowObservation, evidence: SourceEvidence): void {
  assertEvidenceCanEnterFactTable(evidence);
  if (evidence.evidenceClass !== 'OBSERVED_TRADE') throw new Error('trade flow evidence must be OBSERVED_TRADE');
  if (flow.evidence_id !== evidence.sourceId || flow.provider_id !== evidence.providerId) throw new Error('trade flow source identity mismatch');
  if (flow.origin_aggregation_level !== evidence.aggregationLevel) throw new Error('trade flow aggregation must match its source evidence');
  assertStableEntityId(flow.flow_id, 'flow');
  assertStableEntityId(flow.reporter_geo_id, 'geo');
  assertStableEntityId(flow.origin_geo_id, 'geo');
  assertStableEntityId(flow.destination_geo_id, 'geo');
  assertStableEntityId(flow.product_id, 'product');
  if (!/^\d{2,10}$/u.test(flow.hs_code)) throw new Error('hs_code must contain 2–10 digits');
  if (!flow.hs_version.trim()) throw new Error('hs_version is required');
  requireTimestamp(flow.period_start, 'period_start');
  requireTimestamp(flow.period_end, 'period_end');
  if (Date.parse(flow.period_start) > Date.parse(flow.period_end)) throw new Error('period_end must not be before period_start');
  finiteNonNegative(flow.value, 'value');
  finiteNonNegative(flow.quantity, 'quantity');
  finiteNonNegative(flow.net_weight_kg, 'net_weight_kg');
  if ((flow.value === null) !== (flow.value_currency === null)) throw new Error('value and value_currency must be present together');
  if ((flow.quantity === null) !== (flow.quantity_unit === null)) throw new Error('quantity and quantity_unit must be present together');
  if (flow.transport_mode !== null && !TRANSPORT_MODES.includes(flow.transport_mode)) throw new Error('transport_mode is invalid');
  if (flow.quality_status !== evidence.qualityStatus) throw new Error('trade flow quality must match its source evidence');
}

/** UN Comtrade is adapted only as COUNTRY aggregate evidence. */
export function adaptComtradeObservation(input: ComtradeAdapterInput, evidence: SourceEvidence): TradeFlowObservation {
  assertEvidenceCanEnterFactTable(evidence);
  if (evidence.evidenceClass !== 'OBSERVED_TRADE') throw new Error('Comtrade evidence must be OBSERVED_TRADE');
  if (evidence.aggregationLevel !== 'COUNTRY') throw new Error('Comtrade evidence must retain COUNTRY aggregation');
  if (!input.providerRecordId.trim()) throw new Error('providerRecordId is required');
  if (!/^\d{2,10}$/.test(input.hsCode)) throw new Error('hsCode must be a 2-10 digit code');
  requireTimestamp(input.periodStart, 'periodStart');
  requireTimestamp(input.periodEnd, 'periodEnd');
  finiteNonNegative(input.value, 'value');
  finiteNonNegative(input.quantity, 'quantity');
  finiteNonNegative(input.netWeightKg, 'netWeightKg');
  if ((input.value === null) !== (input.valueCurrency === null)) throw new Error('value and valueCurrency must be present together');
  if ((input.quantity === null) !== (input.quantityUnit === null)) throw new Error('quantity and quantityUnit must be present together');
  const flow: TradeFlowObservation = Object.freeze({
    flow_id: createStableEntityId('flow', `comtrade-${input.providerRecordId}`),
    reporter_geo_id: input.reporterGeoId,
    origin_geo_id: input.reporterGeoId,
    origin_aggregation_level: 'COUNTRY',
    destination_geo_id: input.partnerGeoId,
    product_id: input.productId,
    hs_version: input.hsVersion,
    hs_code: input.hsCode,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    trade_direction: input.tradeDirection,
    value: input.value,
    value_currency: input.valueCurrency,
    quantity: input.quantity,
    quantity_unit: input.quantityUnit,
    net_weight_kg: input.netWeightKg,
    transport_mode: input.transportMode ?? null,
    customs_or_port_ref: input.customsOrPortRef ?? null,
    provider_id: evidence.providerId,
    evidence_id: evidence.sourceId,
    quality_status: evidence.qualityStatus,
  });
  assertTradeFlowObservation(flow, evidence);
  return flow;
}

export type LawfulCustomsImportManifest = Readonly<{
  file_sha256: string;
  publisher: string;
  publication_date: string;
  aggregation_level: AggregationLevel;
  license_status: 'VERIFIED' | 'RESTRICTED';
  permitted_uses: readonly ('LOCAL_ANALYSIS' | 'DISPLAY' | 'EXPORT' | 'REDISTRIBUTION')[];
  source_reference: string;
}>;

export function assertLawfulCustomsImport(manifest: LawfulCustomsImportManifest): void {
  if (!/^[a-f0-9]{64}$/i.test(manifest.file_sha256)) throw new Error('customs import requires a SHA-256 checksum');
  if (!manifest.publisher.trim() || !manifest.source_reference.trim()) throw new Error('customs import requires publisher and source reference');
  requireTimestamp(manifest.publication_date, 'publication_date');
  if (!['COUNTRY', 'STATE_PROVINCE', 'CITY', 'COUNTY_DISTRICT'].includes(manifest.aggregation_level)) {
    throw new Error('customs import aggregation is unsupported');
  }
  if (!manifest.permitted_uses.includes('LOCAL_ANALYSIS')) throw new Error('customs import is not licensed for local analysis');
}

export type ShipmentProviderContract = Readonly<{
  provider_id: string;
  enabled: boolean;
  license_status: 'VERIFIED' | 'RESTRICTED' | 'REVIEW_REQUIRED' | 'NOT_CONFIGURED';
  permitted_fields: readonly (keyof ShipmentObservation)[];
  permits_display: boolean;
  permits_export: boolean;
}>;

export function assertShipmentObservation(
  shipment: ShipmentObservation,
  contract: ShipmentProviderContract,
  evidence: SourceEvidence,
): void {
  if (!contract.enabled || contract.license_status === 'NOT_CONFIGURED' || contract.license_status === 'REVIEW_REQUIRED') {
    throw new Error('shipment Provider is disabled or its license is not verified');
  }
  if (shipment.provider_id !== contract.provider_id || evidence.providerId !== contract.provider_id) {
    throw new Error('shipment Provider identity mismatch');
  }
  if (evidence.evidenceClass === 'AIS_OBSERVATION') throw new Error('AIS evidence cannot populate a shipment');
  if (evidence.evidenceClass !== 'CONTRACTED_SHIPMENT') throw new Error('shipment evidence must be CONTRACTED_SHIPMENT');
  if (evidence.aggregationLevel !== 'SHIPMENT') throw new Error('shipment evidence must retain SHIPMENT aggregation');
  assertEvidenceCanEnterFactTable(evidence);
  assertStableEntityId(shipment.shipment_id, 'shipment');
  assertStableEntityId(shipment.origin_node_id, 'node');
  assertStableEntityId(shipment.destination_node_id, 'node');
  requireTimestamp(shipment.observed_at, 'observed_at');
  if (!shipment.provider_shipment_id.trim() || !shipment.license_scope.trim()) throw new Error('shipment Provider ID and license scope are required');
  for (const [field, value] of Object.entries(shipment) as Array<[keyof ShipmentObservation, unknown]>) {
    if (value !== null && !contract.permitted_fields.includes(field)) throw new Error(`shipment field ${field} is outside the Provider contract`);
  }
  finiteNonNegative(shipment.container_count, 'container_count');
  finiteNonNegative(shipment.weight, 'weight');
}

/** Prevent aggregate flow from being relabelled as a finer-grained actual. */
export function canDisplayFlowAsActualAt(
  flow: TradeFlowObservation,
  requestedGeoId: StableEntityId,
  requestedAggregation: AggregationLevel,
): boolean {
  return flow.origin_geo_id === requestedGeoId && flow.origin_aggregation_level === requestedAggregation;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const safeText = typeof value === 'string' && /^[\u0000-\u0020\u007f-\u009f\uFEFF]*[=+\-@]/u.test(text)
    ? `'${text}`
    : text;
  return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText;
}

/** Export keeps the truth-bearing period, units, source and aggregation. */
export function exportTradeFlowsCsv(flows: readonly TradeFlowObservation[]): string {
  const fields: readonly (keyof TradeFlowObservation)[] = [
    'flow_id', 'reporter_geo_id', 'origin_geo_id', 'origin_aggregation_level',
    'destination_geo_id', 'product_id', 'hs_version', 'hs_code', 'period_start',
    'period_end', 'trade_direction', 'value', 'value_currency', 'quantity',
    'quantity_unit', 'net_weight_kg', 'transport_mode', 'customs_or_port_ref',
    'provider_id', 'evidence_id', 'quality_status',
  ];
  return [fields.join(','), ...flows.map((flow) => fields.map((field) => csvCell(flow[field])).join(','))].join('\n');
}

export function tradeFlowAvailability(registry = TRADE_LOGISTICS_REGISTRY): Readonly<{
  status: 'NOT_CONFIGURED' | 'OBSERVED';
  observedFlowCount: number;
  shipmentCount: number;
  observedRouteCount: number;
  modelledRouteCount: number;
}> {
  return Object.freeze({
    status: registry.flows.length === 0 && registry.shipments.length === 0 ? 'NOT_CONFIGURED' : 'OBSERVED',
    observedFlowCount: registry.flows.length,
    shipmentCount: registry.shipments.length,
    observedRouteCount: registry.routes.filter((route) => route.observed_or_modelled === 'OBSERVED').length,
    modelledRouteCount: registry.routes.filter((route) => route.observed_or_modelled === 'MODELLED').length,
  });
}
