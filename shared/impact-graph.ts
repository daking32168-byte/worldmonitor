/** Phase 23 evidence-gated event → industry → logistics → market graph. */

import {
  assertEvidenceCanEnterFactTable,
  assertSourceEvidence,
  assertStableEntityId,
  type EvidenceClass,
  type SourceEvidence,
  type StableEntityId,
} from './global-intelligence-contract';

export const IMPACT_NODE_TYPES = [
  'EVENT',
  'GEO_UNIT',
  'INDUSTRY_CLUSTER',
  'PRODUCT',
  'FACILITY',
  'COMPANY',
  'SECURITY',
  'LOGISTICS_NODE',
  'LOGISTICS_ROUTE',
  'DESTINATION_MARKET',
] as const;

export type ImpactNodeType = (typeof IMPACT_NODE_TYPES)[number];

export const IMPACT_RELATIONSHIP_TYPES = [
  'LOCATED_IN',
  'RECOGNIZED_AS_CLUSTER',
  'PRODUCES',
  'OPERATES',
  'OWNS',
  'BRANDS',
  'LISTED_AS',
  'SUPPLIES',
  'CUSTOMER_OF',
  'USES_LOGISTICS_NODE',
  'OBSERVED_TRADE_TO',
  'OBSERVED_SHIPMENT_TO',
  'MODELLED_ROUTE_TO',
  'MENTIONED_BY',
  'RELATED_TO',
  'POTENTIALLY_IMPACTS',
] as const;

export type ImpactRelationshipType = (typeof IMPACT_RELATIONSHIP_TYPES)[number];

export const MODEL_RELATIONSHIP_TYPES = [
  'MODELLED_ROUTE_TO',
  'RELATED_TO',
  'POTENTIALLY_IMPACTS',
] as const satisfies readonly ImpactRelationshipType[];

export const MODEL_EDGE_EVIDENCE_CLASSES = [
  'MODELLED_ROUTE',
  'MODELLED_FLOW',
  'MODELLED_IMPACT',
  'AI_SPECULATION',
] as const satisfies readonly EvidenceClass[];

const NODE_PREFIX: Readonly<Record<ImpactNodeType, Parameters<typeof assertStableEntityId>[1]>> = Object.freeze({
  EVENT: 'event',
  GEO_UNIT: 'geo',
  INDUSTRY_CLUSTER: 'cluster',
  PRODUCT: 'product',
  FACILITY: 'facility',
  COMPANY: 'company',
  SECURITY: 'security',
  LOGISTICS_NODE: 'node',
  LOGISTICS_ROUTE: 'route',
  DESTINATION_MARKET: 'geo',
});

export type ImpactNode = Readonly<{
  node_id: StableEntityId;
  node_type: ImpactNodeType;
  label: string;
  detail_path: string | null;
}>;

export type ImpactEdge = Readonly<{
  edge_id: string;
  from_id: StableEntityId;
  to_id: StableEntityId;
  relationship_type: ImpactRelationshipType;
  evidence_class: EvidenceClass;
  source_evidence_ids: readonly StableEntityId[];
  confidence: number;
  valid_from: string;
  valid_to: string | null;
  methodology_version: string;
}>;

export type ImpactPath = Readonly<{
  origin_id: StableEntityId;
  destination_id: StableEntityId;
  nodes: readonly ImpactNode[];
  edges: readonly ImpactEdge[];
  kind: 'DIRECT_FACT' | 'INDIRECT_FACT' | 'MODELLED';
  explanation: string;
}>;

export type ImpactTraversalOptions = Readonly<{
  max_depth?: number;
  max_paths?: number;
  direction?: 'FORWARD' | 'REVERSE';
  include_model_edges?: boolean;
}>;

const EDGE_ID_PATTERN = /^edge_[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;

function isModelRelationship(value: ImpactRelationshipType): boolean {
  return MODEL_RELATIONSHIP_TYPES.includes(value as (typeof MODEL_RELATIONSHIP_TYPES)[number]);
}

export function isModelEdge(edge: Pick<ImpactEdge, 'relationship_type' | 'evidence_class'>): boolean {
  return isModelRelationship(edge.relationship_type)
    && MODEL_EDGE_EVIDENCE_CLASSES.includes(edge.evidence_class as (typeof MODEL_EDGE_EVIDENCE_CLASSES)[number]);
}

export function assertImpactNode(node: ImpactNode): void {
  if (!IMPACT_NODE_TYPES.includes(node.node_type)) throw new Error(`Unsupported impact node type ${node.node_type}`);
  assertStableEntityId(node.node_id, NODE_PREFIX[node.node_type]);
  if (!node.label.trim()) throw new Error('Impact node label is required');
  if (node.detail_path !== null && (!node.detail_path.startsWith('/') || node.detail_path.startsWith('//'))) {
    throw new Error('Impact node detail_path must be an application-relative path');
  }
}

function timestamp(value: string, field: string): void {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
}

function evidenceIndex(evidence: readonly SourceEvidence[]): ReadonlyMap<string, SourceEvidence> {
  const index = new Map<string, SourceEvidence>();
  for (const item of evidence) {
    assertSourceEvidence(item);
    const existing = index.get(item.sourceId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw new Error(`Conflicting SourceEvidence ${item.sourceId}`);
    index.set(item.sourceId, item);
  }
  return index;
}

export function assertImpactEdge(
  edge: ImpactEdge,
  nodes: ReadonlyMap<string, ImpactNode>,
  evidence: readonly SourceEvidence[],
): void {
  if (!EDGE_ID_PATTERN.test(edge.edge_id)) throw new Error(`Invalid impact edge ID ${edge.edge_id}`);
  assertStableEntityId(edge.from_id);
  assertStableEntityId(edge.to_id);
  if (edge.from_id === edge.to_id) throw new Error('Impact graph self edges are forbidden');
  if (!nodes.has(edge.from_id) || !nodes.has(edge.to_id)) throw new Error('Impact edge endpoints must already exist');
  if (!IMPACT_RELATIONSHIP_TYPES.includes(edge.relationship_type)) throw new Error(`Unsupported relationship ${edge.relationship_type}`);
  if (!Number.isFinite(edge.confidence) || edge.confidence < 0 || edge.confidence > 1) throw new Error('Impact edge confidence must be between 0 and 1');
  timestamp(edge.valid_from, 'valid_from');
  if (edge.valid_to !== null) {
    timestamp(edge.valid_to, 'valid_to');
    if (Date.parse(edge.valid_to) <= Date.parse(edge.valid_from)) throw new Error('valid_to must be after valid_from');
  }
  if (!edge.methodology_version.trim()) throw new Error('Impact edge methodology_version is required');
  if (edge.source_evidence_ids.length === 0) throw new Error('Every impact edge requires traceable SourceEvidence');
  if (new Set(edge.source_evidence_ids).size !== edge.source_evidence_ids.length) throw new Error('Impact edge evidence IDs must be unique');

  const index = evidenceIndex(evidence);
  const linked = edge.source_evidence_ids.map((id) => {
    assertStableEntityId(id, 'source');
    const item = index.get(id);
    if (!item) throw new Error(`Impact edge references missing SourceEvidence ${id}`);
    return item;
  });

  const modelClass = MODEL_EDGE_EVIDENCE_CLASSES.includes(edge.evidence_class as (typeof MODEL_EDGE_EVIDENCE_CLASSES)[number]);
  if (modelClass) {
    if (!isModelRelationship(edge.relationship_type)) {
      throw new Error('AI or model evidence cannot create a fact relationship');
    }
    if (!linked.every((item) => MODEL_EDGE_EVIDENCE_CLASSES.includes(item.evidenceClass as (typeof MODEL_EDGE_EVIDENCE_CLASSES)[number]))) {
      throw new Error('Model edges may reference only model/speculation evidence');
    }
    return;
  }

  if (isModelRelationship(edge.relationship_type)) {
    throw new Error('Weak/model relationship types must be explicitly stored as model evidence');
  }
  for (const item of linked) assertEvidenceCanEnterFactTable(item);
  if (!linked.some((item) => item.evidenceClass === edge.evidence_class)) {
    throw new Error('Fact edge evidence_class must match at least one linked SourceEvidence record');
  }
}

export function explainImpactPath(nodes: readonly ImpactNode[], edges: readonly ImpactEdge[]): string {
  if (nodes.length !== edges.length + 1 || edges.length === 0) throw new Error('Impact path must contain connected nodes and at least one edge');
  const statements = edges.map((edge, index) => `${nodes[index]!.label} —${edge.relationship_type}→ ${nodes[index + 1]!.label}`);
  const model = edges.some(isModelEdge);
  return `${statements.join('；')}。${model ? '路径包含模型关系，只表示潜在影响，不是已证明因果。' : '路径仅由已通过来源、许可和质量门禁的事实边组成。'}`;
}

export function traverseImpactGraph(
  originId: StableEntityId,
  nodes: readonly ImpactNode[],
  edges: readonly ImpactEdge[],
  options: ImpactTraversalOptions = {},
): readonly ImpactPath[] {
  const nodeMap = new Map(nodes.map((node) => [node.node_id, node]));
  if (!nodeMap.has(originId)) return Object.freeze([]);
  const maxDepth = Math.min(9, Math.max(1, Math.trunc(options.max_depth ?? 8)));
  const maxPaths = Math.min(250, Math.max(1, Math.trunc(options.max_paths ?? 100)));
  const reverse = options.direction === 'REVERSE';
  const eligibleEdges = edges.filter((edge) => options.include_model_edges !== false || !isModelEdge(edge));
  const adjacency = new Map<string, ImpactEdge[]>();
  for (const edge of eligibleEdges) {
    const key = reverse ? edge.to_id : edge.from_id;
    const list = adjacency.get(key) ?? [];
    list.push(edge);
    adjacency.set(key, list);
  }
  for (const list of adjacency.values()) list.sort((a, b) => a.edge_id.localeCompare(b.edge_id));

  const results: ImpactPath[] = [];
  const queue: Array<{ current: StableEntityId; nodes: ImpactNode[]; edges: ImpactEdge[]; visited: Set<string> }> = [{
    current: originId,
    nodes: [nodeMap.get(originId)!],
    edges: [],
    visited: new Set([originId]),
  }];
  while (queue.length > 0 && results.length < maxPaths) {
    const state = queue.shift()!;
    if (state.edges.length >= maxDepth) continue;
    for (const edge of adjacency.get(state.current) ?? []) {
      const nextId = (reverse ? edge.from_id : edge.to_id) as StableEntityId;
      if (state.visited.has(nextId)) continue;
      const nextNode = nodeMap.get(nextId);
      if (!nextNode) continue;
      const pathNodes = [...state.nodes, nextNode];
      const pathEdges = [...state.edges, edge];
      const model = pathEdges.some(isModelEdge);
      results.push(Object.freeze({
        origin_id: originId,
        destination_id: nextId,
        nodes: Object.freeze(pathNodes),
        edges: Object.freeze(pathEdges),
        kind: model ? 'MODELLED' : pathEdges.length === 1 ? 'DIRECT_FACT' : 'INDIRECT_FACT',
        explanation: explainImpactPath(pathNodes, pathEdges),
      }));
      if (results.length >= maxPaths) break;
      queue.push({ current: nextId, nodes: pathNodes, edges: pathEdges, visited: new Set([...state.visited, nextId]) });
    }
  }
  return Object.freeze(results);
}
