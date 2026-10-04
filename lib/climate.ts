/**
 * Site lookup and climate: place search and reverse geocoding (Nominatim) and a
 * year of ERA5 reanalysis (Open-Meteo archive). Shared by the browser and, later,
 * the MCP server.
 *
 * Nominatim usage policy: at most 1 request/second and an identifying client.
 * Callers debounce searches; server-side callers must also send a User-Agent.
 */
import type { LocationData } from '@/types';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

export interface PlaceResult {
  name: string;
  /** Full place description, e.g. "Asunción, Paraguay" */
  label: string;
  lat: number;
  lng: number;
}

export type Climate = Pick<LocationData, 'avgYearlyTempC' | 'maxTempC' | 'minTempC' | 'avgHumidityPercent'>;

interface Options {
  signal?: AbortSignal;
  /** Required server-side by the Nominatim policy */
  userAgent?: string;
}

function headers(opts: Options): HeadersInit {
  return { 'Accept-Language': 'en', ...(opts.userAgent ? { 'User-Agent': opts.userAgent } : {}) };
}

/** Free-text place search (min. 3 characters), up to 5 results. */
export async function searchPlaces(query: string, opts: Options = {}): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`, {
    headers: headers(opts),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const rows = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string }[];
  return rows.map((r) => {
    const parts = r.display_name.split(',').map((p) => p.trim());
    return {
      name: r.name || parts[0],
      label: parts.length > 1 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts[0],
      lat: Number(r.lat),
      lng: Number(r.lon),
    };
  });
}

/** Nearest city/town name for a point, falling back to coordinates. */
export async function reverseGeocode(lat: number, lng: number, opts: Options = {}): Promise<string> {
  const fallback = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  try {
    const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: headers(opts),
      signal: opts.signal,
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const a = data.address || {};
    return a.city || a.town || a.village || a.county || a.state || data.display_name?.split(',')[0] || fallback;
  } catch {
    return fallback;
  }
}

/** Summarize a year of daily max/min temperature and hourly humidity. Pure. */
export function summarizeClimate(maxTemps: number[], minTemps: number[], humidity: number[]): Climate {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const round1 = (v: number) => Math.round(v * 10) / 10;
  if (maxTemps.length === 0 || minTemps.length === 0) throw new Error('No climate data for this location');
  return {
    avgYearlyTempC: round1((avg(maxTemps) + avg(minTemps)) / 2),
    maxTempC: round1(Math.max(...maxTemps)),
    minTempC: round1(Math.min(...minTemps)),
    avgHumidityPercent: humidity.length ? round1(avg(humidity)) : 60,
  };
}

/** A full calendar year of ERA5 data (default: the previous year) for a point. */
export async function fetchClimate(
  lat: number,
  lng: number,
  opts: Options & { year?: number } = {},
): Promise<Climate> {
  const year = opts.year ?? new Date().getFullYear() - 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${year}-01-01&end_date=${year}-12-31` +
    `&daily=temperature_2m_max,temperature_2m_min&hourly=relative_humidity_2m&timezone=auto`;
  const res = await fetch(url, { signal: opts.signal, headers: opts.userAgent ? { 'User-Agent': opts.userAgent } : undefined });
  if (!res.ok) throw new Error(`Climate lookup failed (${res.status})`);
  const data = await res.json();
  return summarizeClimate(
    (data.daily?.temperature_2m_max ?? []).filter((v: unknown) => typeof v === 'number'),
    (data.daily?.temperature_2m_min ?? []).filter((v: unknown) => typeof v === 'number'),
    (data.hourly?.relative_humidity_2m ?? []).filter((v: unknown) => typeof v === 'number'),
  );
}
