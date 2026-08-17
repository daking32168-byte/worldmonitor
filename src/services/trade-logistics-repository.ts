import type { GlobalIntelligenceSnapshot } from '../../shared/global-intelligence-import';
import {
  TRADE_LOGISTICS_REGISTRY,
  assertTradeFlowObservation,
  type TradeFlowObservation,
  type TradeLogisticsRegistry,
} from '../../shared/trade-logistics';
import { globalIntelligenceLocalRepository } from './global-intelligence-local-repository';

export function tradeLogisticsRegistryFromSnapshot(snapshot: GlobalIntelligenceSnapshot): TradeLogisticsRegistry {
  const flows: TradeFlowObservation[] = [];
  const evidence = [...TRADE_LOGISTICS_REGISTRY.evidence];
  const evidenceIds = new Set(evidence.map((item) => item.sourceId));
  const flowIds = new Set(TRADE_LOGISTICS_REGISTRY.flows.map((item) => item.flow_id));

  for (const record of Object.values(snapshot.records.trade_flows ?? {})) {
    const storedEvidence = snapshot.evidence[record.sourceEvidenceId];
    if (!storedEvidence) throw new Error(`${record.recordId} has no stored source evidence`);
    if (!storedEvidence.permittedUses.includes('DISPLAY')) throw new Error(`${record.recordId} source license does not permit display`);
    const flow = Object.freeze({ ...record.values }) as unknown as TradeFlowObservation;
    assertTradeFlowObservation(flow, storedEvidence.evidence);
    if (flowIds.has(flow.flow_id)) throw new Error(`duplicate trade flow ${flow.flow_id}`);
    flowIds.add(flow.flow_id);
    flows.push(flow);
    if (!evidenceIds.has(storedEvidence.evidence.sourceId)) {
      evidence.push(storedEvidence.evidence);
      evidenceIds.add(storedEvidence.evidence.sourceId);
    }
  }

  return Object.freeze({
    flows: Object.freeze([...TRADE_LOGISTICS_REGISTRY.flows, ...flows].sort((left, right) => right.period_end.localeCompare(left.period_end))),
    shipments: TRADE_LOGISTICS_REGISTRY.shipments,
    nodes: TRADE_LOGISTICS_REGISTRY.nodes,
    routes: TRADE_LOGISTICS_REGISTRY.routes,
    evidence: Object.freeze(evidence),
  });
}

export const tradeLogisticsRepository = Object.freeze({
  async load(): Promise<TradeLogisticsRegistry> {
    return tradeLogisticsRegistryFromSnapshot(await globalIntelligenceLocalRepository.load());
  },

  async exportableFlows(): Promise<readonly TradeFlowObservation[]> {
    const snapshot = await globalIntelligenceLocalRepository.load();
    const registry = tradeLogisticsRegistryFromSnapshot(snapshot);
    return registry.flows.filter((flow) => snapshot.evidence[flow.evidence_id]?.permittedUses.includes('EXPORT') ?? false);
  },
});
