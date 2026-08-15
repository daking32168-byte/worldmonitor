export const MANUAL_ACTION_CENTER_PATH = '/manual-action-center';

export function isManualActionCenterPath(pathname: string): boolean {
  return pathname === MANUAL_ACTION_CENTER_PATH || pathname === `${MANUAL_ACTION_CENTER_PATH}/`;
}

export function manualActionCenterUrl(): string {
  return MANUAL_ACTION_CENTER_PATH;
}
