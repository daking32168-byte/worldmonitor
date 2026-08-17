import {
  assertImpactEdge,
  assertImpactNode,
  traverseImpactGraph,
  type ImpactEdge,
  type ImpactNode,
  type ImpactPath,
  type ImpactTraversalOptions,
} from '../../shared/impact-graph';
import type { SourceEvidence, StableEntityId } from '../../shared/global-intelligence-contract';
import { getPersistentCache, setPersistentCache } from './persistent-cache';

const IMPACT_GRAPH_REPOSITORY_KEY = 'global-intelligence:impact-graph:v1:current';

export type ImpactGraphSnapshot = Readonly<{
  schemaVersion: 1;
  revision: number;
  nodes: Readonly<Record<string, ImpactNode>>;
  edges: Readonly<Record<string, ImpactEdge>>;
  evidence: Readonly<Record<string, SourceEvidence>>;
}>;

export type ImpactGraphRepositoryAdapter = Readonly<{
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}>;

function emptySnapshot(): ImpactGraphSnapshot {
  return { schemaVersion: 1, revision: 0, nodes: {}, edges: {}, evidence: {} };
}

function isSnapshot(value: unknown): value is ImpactGraphSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ImpactGraphSnapshot>;
  return candidate.schemaVersion === 1
    && Number.isInteger(candidate.revision)
    && (candidate.revision ?? -1) >= 0
    && typeof candidate.nodes === 'object' && candidate.nodes !== null
    && typeof candidate.edges === 'object' && candidate.edges !== null
    && typeof candidate.evidence === 'object' && candidate.evidence !== null;
}

const persistentAdapter: ImpactGraphRepositoryAdapter = {
  async read<T>(key: string): Promise<T | null> {
    return (await getPersistentCache<T>(key))?.data ?? null;
  },
  async write<T>(key: string, value: T): Promise<void> {
    await setPersistentCache(key, value);
  },
};

export function createImpactGraphRepository(adapter: ImpactGraphRepositoryAdapter = persistentAdapter) {
  let mutationQueue: Promise<void> = Promise.resolve();
  const load = async (): Promise<ImpactGraphSnapshot> => {
    const value = await adapter.read<ImpactGraphSnapshot>(IMPACT_GRAPH_REPOSITORY_KEY);
    if (value === null) return emptySnapshot();
    if (!isSnapshot(value)) throw new Error('Stored impact graph has an unsupported or corrupt schema');
    return value;
  };
  const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  return Object.freeze({
    load,

    async commit(
      nodes: readonly ImpactNode[],
      edges: readonly ImpactEdge[],
      evidence: readonly SourceEvidence[],
    ): Promise<Readonly<{ status: 'COMMITTED' | 'NO_CHANGE'; snapshot: ImpactGraphSnapshot }>> {
      return serialized(async () => {
        const snapshot = await load();
        const nextNodes: Record<string, ImpactNode> = { ...snapshot.nodes };
        const nextEvidence: Record<string, SourceEvidence> = { ...snapshot.evidence };
        const nextEdges: Record<string, ImpactEdge> = { ...snapshot.edges };
        for (const node of nodes) {
          assertImpactNode(node);
          const existing = nextNodes[node.node_id];
          if (existing && JSON.stringify(existing) !== JSON.stringify(node)) throw new Error(`Impact node ${node.node_id} conflicts with stored data`);
          nextNodes[node.node_id] = node;
        }
        for (const item of evidence) {
          const existing = nextEvidence[item.sourceId];
          if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw new Error(`SourceEvidence ${item.sourceId} conflicts with stored data`);
          nextEvidence[item.sourceId] = item;
        }
        const nodeMap = new Map(Object.values(nextNodes).map((node) => [node.node_id, node]));
        const allEvidence = Object.values(nextEvidence);
        for (const edge of edges) {
          assertImpactEdge(edge, nodeMap, allEvidence);
          const existing = nextEdges[edge.edge_id];
          if (existing && JSON.stringify(existing) !== JSON.stringify(edge)) throw new Error(`Impact edge ${edge.edge_id} conflicts with stored data`);
          nextEdges[edge.edge_id] = edge;
        }
        const changed = JSON.stringify([snapshot.nodes, snapshot.edges, snapshot.evidence]) !== JSON.stringify([nextNodes, nextEdges, nextEvidence]);
        if (!changed) return { status: 'NO_CHANGE', snapshot };
        const next: ImpactGraphSnapshot = { schemaVersion: 1, revision: snapshot.revision + 1, nodes: nextNodes, edges: nextEdges, evidence: nextEvidence };
        await adapter.write(IMPACT_GRAPH_REPOSITORY_KEY, next);
        return { status: 'COMMITTED', snapshot: next };
      });
    },

    async pathsFrom(originId: StableEntityId, options?: ImpactTraversalOptions): Promise<readonly ImpactPath[]> {
      const snapshot = await load();
      return traverseImpactGraph(originId, Object.values(snapshot.nodes), Object.values(snapshot.edges), options);
    },

    async pathsTo(destinationId: StableEntityId, options: Omit<ImpactTraversalOptions, 'direction'> = {}): Promise<readonly ImpactPath[]> {
      const snapshot = await load();
      return traverseImpactGraph(destinationId, Object.values(snapshot.nodes), Object.values(snapshot.edges), { ...options, direction: 'REVERSE' });
    },
  });
}

export const impactGraphRepository = createImpactGraphRepository();
