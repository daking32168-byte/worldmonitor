export const INDUSTRY_MAP_PATH = '/industry-map';

export function isIndustryMapPath(pathname: string): boolean {
  return /^\/industry-map(?:\/(?:location|cluster)\/[^/]+)?\/?$/.test(pathname);
}
