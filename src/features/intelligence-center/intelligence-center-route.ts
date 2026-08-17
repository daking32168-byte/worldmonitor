export const INTELLIGENCE_CENTER_PATH = '/intelligence-center';

export function isIntelligenceCenterPath(pathname: string): boolean {
  return pathname === INTELLIGENCE_CENTER_PATH || pathname === `${INTELLIGENCE_CENTER_PATH}/`;
}

export function intelligenceCenterUrl(input?: Readonly<{ type: string; id: string; label: string }>): string {
  if (!input) return INTELLIGENCE_CENTER_PATH;
  const query = new URLSearchParams({ watchType: input.type, watchId: input.id, watchLabel: input.label });
  return `${INTELLIGENCE_CENTER_PATH}?${query}`;
}
