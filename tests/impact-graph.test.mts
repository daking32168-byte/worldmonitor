import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertImpactEdge,
  explainImpactPath,
  traverseImpactGraph,
  type ImpactEdge,
  type ImpactNode,
} from '../shared/impact-graph.ts';
import { createStableEntityId, type SourceEvidence, type StableEntityId } from '../shared/global-intelligence-contract.ts';
import { createImpactGraphRepository, type ImpactGraphRepositoryAdapter } from '../src/services/impact-graph-repository.ts';

const event = createStableEntityId('event', 'port-alert');
const geo = createStableEntityId('geo', 'cn-dongguan');
const cluster = createStableEntityId('cluster', 'cn-dongguan-footwear');
const product = createStableEntityId('product', 'womens-footwear');
const security = createStableEntityId('security', 'xnas-test');
const factSource = createStableEntityId('source', 'official-001');
const modelSource = createStableEntityId('source', 'model-001');

const nodes: readonly ImpactNode[] = [
  { node_id: event, node_type: 'EVENT', label: '港口官方警报', detail_path: `/impact/${event}` },
  { node_id: geo, node_type: 'GEO_UNIT', label: '东莞', detail_path: `/industry-map/location/${geo}` },
  { node_id: cluster, node_type: 'INDUSTRY_CLUSTER', label: '鞋业集群', detail_path: `/industry-map/cluster/${cluster}` },
  { node_id: product, node_type: 'PRODUCT', label: '女鞋', detail_path: `/trade-flows/product/${product}` },
  { node_id: security, node_type: 'SECURITY', label: 'TEST / XNAS', detail_path: `/global-markets/${security}` },
];

function source(overrides: Partial<SourceEvidence> = {}): SourceEvidence {
  return {
    sourceId: factSource,
    providerId: 'official-registry-test',
    sourceType: 'OFFICIAL_RECORD',
    sourceTitle: 'Official test record',
    sourceUrl: 'https://official.example.test/record/001',
    sourceReference: 'record-001',
    sourcePublishedAt: '2026-08-14T00:00:00Z',
    observedAt: '2026-08-14T00:00:00Z',
    retrievedAt: '2026-08-15T00:00:00Z',
    validFrom: '2026-08-14T00:00:00Z',
    validTo: null,
    periodStart: null,
    periodEnd: null,
    evidenceClass: 'OFFICIAL_REGISTRY',
    aggregationLevel: 'CITY',
    licenseStatus: 'VERIFIED',
    freshnessStatus: 'CURRENT',
    qualityStatus: 'VERIFIED',
    confidence: 1,
    methodologyVersion: 'official-record/v1',
    nullReasons: {
      validTo: { code: 'NOT_PROVIDED', explanation: 'Open-ended official record.' },
      periodStart: { code: 'NOT_APPLICABLE', explanation: 'Not a period aggregate.' },
      periodEnd: { code: 'NOT_APPLICABLE', explanation: 'Not a period aggregate.' },
    },
    ...overrides,
  };
}

function edge(id: string, from: StableEntityId, to: StableEntityId, relationship: ImpactEdge['relationship_type'], overrides: Partial<ImpactEdge> = {}): ImpactEdge {
  return {
    edge_id: `edge_${id}`,
    from_id: from,
    to_id: to,
    relationship_type: relationship,
    evidence_class: 'OFFICIAL_REGISTRY',
    source_evidence_ids: [factSource],
    confidence: 0.95,
    valid_from: '2026-08-14T00:00:00Z',
    valid_to: null,
    methodology_version: 'fact-link/v1',
    ...overrides,
  };
}

function memoryAdapter(): ImpactGraphRepositoryAdapter {
  const values = new Map<string, unknown>();
  return {
    async read<T>(key: string): Promise<T | null> { return (values.get(key) as T | undefined) ?? null; },
    async write<T>(key: string, value: T): Promise<void> { values.set(key, structuredClone(value)); },
  };
}

describe('Phase 23 evidence-gated impact graph', () => {
  it('keeps every fact edge traceable to evidence that passed licence and quality gates', () => {
    const nodeMap = new Map(nodes.map((node) => [node.node_id, node]));
    assert.doesNotThrow(() => assertImpactEdge(edge('event_geo', event, geo, 'LOCATED_IN'), nodeMap, [source()]));
    assert.throws(
      () => assertImpactEdge(edge('unlicensed', event, geo, 'LOCATED_IN'), nodeMap, [source({ licenseStatus: 'REVIEW_REQUIRED' })]),
      /VERIFIED license is required/,
    );
    assert.throws(() => assertImpactEdge(edge('missing', event, geo, 'LOCATED_IN'), nodeMap, []), /missing SourceEvidence/);
  });

  it('prevents AI or model evidence from creating a fact edge', () => {
    const nodeMap = new Map(nodes.map((node) => [node.node_id, node]));
    const modelEvidence = source({
      sourceId: modelSource,
      evidenceClass: 'MODELLED_IMPACT',
      aggregationLevel: 'GLOBAL',
      licenseStatus: 'VERIFIED',
      freshnessStatus: 'NOT_APPLICABLE',
      qualityStatus: 'MODELLED',
      methodologyVersion: 'impact-model/v1',
    });
    assert.throws(
      () => assertImpactEdge(edge('ai_fact', event, security, 'LISTED_AS', { evidence_class: 'MODELLED_IMPACT', source_evidence_ids: [modelSource] }), nodeMap, [modelEvidence]),
      /cannot create a fact relationship/,
    );
    assert.doesNotThrow(
      () => assertImpactEdge(edge('ai_impact', event, security, 'POTENTIALLY_IMPACTS', { evidence_class: 'MODELLED_IMPACT', source_evidence_ids: [modelSource] }), nodeMap, [modelEvidence]),
    );
  });

  it('returns direct, indirect and model paths while stopping cycles and respecting hard bounds', () => {
    const edges = [
      edge('event_geo', event, geo, 'LOCATED_IN'),
      edge('geo_cluster', geo, cluster, 'RECOGNIZED_AS_CLUSTER'),
      edge('cluster_product', cluster, product, 'PRODUCES'),
      edge('product_geo_cycle', product, geo, 'LOCATED_IN'),
      edge('event_security_model', event, security, 'POTENTIALLY_IMPACTS', { evidence_class: 'MODELLED_IMPACT', source_evidence_ids: [modelSource] }),
    ];
    const paths = traverseImpactGraph(event, nodes, edges, { max_depth: 8, max_paths: 100 });
    assert.equal(paths.filter((path) => path.destination_id === geo).length, 1, 'cycle does not revisit geo');
    assert.ok(paths.some((path) => path.kind === 'DIRECT_FACT'));
    assert.ok(paths.some((path) => path.kind === 'INDIRECT_FACT'));
    assert.ok(paths.some((path) => path.kind === 'MODELLED'));
    assert.ok(paths.every((path) => path.nodes.length <= 9));
    assert.match(explainImpactPath([nodes[0]!, nodes[4]!], [edges[4]!]), /不是已证明因果/);
  });

  it('supports reverse queries and conflict-safe persistent commits', async () => {
    const repository = createImpactGraphRepository(memoryAdapter());
    const first = await repository.commit(nodes, [edge('event_geo', event, geo, 'LOCATED_IN'), edge('geo_cluster', geo, cluster, 'RECOGNIZED_AS_CLUSTER')], [source()]);
    assert.equal(first.status, 'COMMITTED');
    assert.equal((await repository.commit(nodes, [], [source()])).status, 'NO_CHANGE');
    const reverse = await repository.pathsTo(cluster);
    assert.ok(reverse.some((path) => path.destination_id === event));
    assert.ok(reverse.some((path) => path.explanation.includes('事实边')));
    await assert.rejects(
      () => repository.commit([{ ...nodes[0]!, label: 'conflicting label' }], [], []),
      /conflicts with stored data/,
    );
  });
});
