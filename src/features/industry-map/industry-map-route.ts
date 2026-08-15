import {
  industryClusterById,
  industryGeoUnitById,
  type IndustryCluster,
  type GeoUnit,
} from '../../../shared/industry-map';
import {
  companyById,
  facilityById,
  type Company,
  type Facility,
} from '../../../shared/company-facility-registry';
import { INDUSTRY_MAP_PATH } from './industry-map-path';

export { INDUSTRY_MAP_PATH, isIndustryMapPath } from './industry-map-path';

export type IndustryMapRoute =
  | Readonly<{ kind: 'overview' }>
  | Readonly<{ kind: 'location'; geo: GeoUnit }>
  | Readonly<{ kind: 'cluster'; cluster: IndustryCluster }>
  | Readonly<{ kind: 'company'; company: Company }>
  | Readonly<{ kind: 'facility'; facility: Facility }>
  | Readonly<{ kind: 'not-found'; requestedPath: string }>;

function safelyDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseIndustryMapRoute(pathname: string): IndustryMapRoute {
  if (/^\/industry-map\/?$/.test(pathname)) return { kind: 'overview' };
  const match = pathname.match(/^\/industry-map\/(location|cluster|company|facility)\/([^/]+)\/?$/);
  if (!match) return { kind: 'not-found', requestedPath: pathname };
  const id = safelyDecode(match[2]!);
  if (!id) return { kind: 'not-found', requestedPath: pathname };
  if (match[1] === 'location') {
    const geo = industryGeoUnitById(id);
    return geo ? { kind: 'location', geo } : { kind: 'not-found', requestedPath: pathname };
  }
  if (match[1] === 'company') {
    const company = companyById(id);
    return company ? { kind: 'company', company } : { kind: 'not-found', requestedPath: pathname };
  }
  if (match[1] === 'facility') {
    const facility = facilityById(id);
    return facility ? { kind: 'facility', facility } : { kind: 'not-found', requestedPath: pathname };
  }
  const cluster = industryClusterById(id);
  return cluster ? { kind: 'cluster', cluster } : { kind: 'not-found', requestedPath: pathname };
}

export function industryMapOverviewUrl(query = '', mode: 'industry' | 'companies' = 'industry'): string {
  const normalized = query.trim();
  const params = new URLSearchParams();
  if (normalized) params.set('q', normalized);
  if (mode === 'companies') params.set('mode', mode);
  const search = params.toString();
  return search ? `${INDUSTRY_MAP_PATH}?${search}` : INDUSTRY_MAP_PATH;
}

export function industryMapLocationUrl(geoId: string): string {
  return `${INDUSTRY_MAP_PATH}/location/${encodeURIComponent(geoId)}`;
}

export function industryMapClusterUrl(clusterId: string): string {
  return `${INDUSTRY_MAP_PATH}/cluster/${encodeURIComponent(clusterId)}`;
}

export function industryMapCompanyUrl(companyId: string): string {
  return `${INDUSTRY_MAP_PATH}/company/${encodeURIComponent(companyId)}`;
}

export function industryMapFacilityUrl(facilityId: string): string {
  return `${INDUSTRY_MAP_PATH}/facility/${encodeURIComponent(facilityId)}`;
}
