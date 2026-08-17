/** The single UI copy/tone mapping for Global Intelligence V2 data states. */

import {
  DATA_DISPLAY_STATUSES,
  type DataDisplayStatus,
} from '../../shared/global-intelligence-contract';

export type GlobalIntelligenceStatusDisplay = Readonly<{
  label: string;
  tone: 'success' | 'warning' | 'muted' | 'danger' | 'model';
  isObservedFact: boolean;
  isLive: boolean;
}>;

export const GLOBAL_INTELLIGENCE_STATUS_DISPLAY: Record<DataDisplayStatus, GlobalIntelligenceStatusDisplay> = {
  NOT_CONFIGURED: { label: '尚未配置', tone: 'muted', isObservedFact: false, isLive: false },
  UNAVAILABLE: { label: '当前不可用', tone: 'danger', isObservedFact: false, isLive: false },
  DELAYED_VERIFIED: { label: '已验证延迟行情', tone: 'success', isObservedFact: true, isLive: false },
  DELAYED_UNVERIFIED: { label: '延迟/授权未验证', tone: 'warning', isObservedFact: false, isLive: false },
  END_OF_DAY: { label: '日终行情', tone: 'success', isObservedFact: true, isLive: false },
  HISTORICAL_SNAPSHOT: { label: '历史快照', tone: 'success', isObservedFact: true, isLive: false },
  MARKET_CLOSED: { label: '市场休市 · 最近观测', tone: 'success', isObservedFact: true, isLive: false },
  STALE: { label: '数据已过期', tone: 'warning', isObservedFact: true, isLive: false },
  OBSERVED: { label: '来源支持的观测', tone: 'success', isObservedFact: true, isLive: false },
  REALTIME_VERIFIED: { label: '已验证实时', tone: 'success', isObservedFact: true, isLive: true },
  MODELLED_ESTIMATE: { label: '模型估算', tone: 'model', isObservedFact: false, isLive: false },
  AI_SPECULATION: { label: 'AI 推演（可能错误）', tone: 'model', isObservedFact: false, isLive: false },
  SOURCE_REQUIRED: { label: '尚缺合格来源', tone: 'muted', isObservedFact: false, isLive: false },
};

export function globalIntelligenceStatusDisplay(status: DataDisplayStatus): GlobalIntelligenceStatusDisplay {
  return GLOBAL_INTELLIGENCE_STATUS_DISPLAY[status];
}

export function assertCompleteGlobalIntelligenceStatusDisplay(): void {
  const mapped = Object.keys(GLOBAL_INTELLIGENCE_STATUS_DISPLAY).sort();
  const expected = [...DATA_DISPLAY_STATUSES].sort();
  if (mapped.length !== expected.length || mapped.some((status, index) => status !== expected[index])) {
    throw new Error('Global Intelligence status display mapping is incomplete');
  }
}
