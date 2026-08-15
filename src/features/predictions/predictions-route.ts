export const PREDICTIONS_PATH = '/predictions';

export function isPredictionsPath(pathname: string): boolean {
  return pathname === PREDICTIONS_PATH || pathname === `${PREDICTIONS_PATH}/`;
}

export function predictionsUrl(): string {
  return PREDICTIONS_PATH;
}
