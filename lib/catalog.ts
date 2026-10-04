/**
 * The hardware catalogs — the **single source** for the engine, the REST API, MCP and the UI.
 *
 * `data/*.json` is canonical. Edit the JSON (and `data/updates.json`), never a copy.
 * JSON is imported statically so the catalogs work everywhere: Node and Edge
 * route handlers, the browser bundle and tests.
 */
import minersJson from '@/data/miners.json';
import dryCoolersJson from '@/data/dryCoolers.json';
import airFansJson from '@/data/airFans.json';
import updatesJson from '@/data/updates.json';
import type { CatalogMiner, DryCoolerModel, AirFanModel } from '@/types';

export const MINERS: CatalogMiner[] = minersJson as CatalogMiner[];
export const DRY_COOLERS: DryCoolerModel[] = dryCoolersJson as DryCoolerModel[];
export const AIR_FANS: AirFanModel[] = airFansJson as AirFanModel[];
export const CATALOG_UPDATES: Record<string, { lastUpdated: string; note: string }> = updatesJson;

// Accessors used by the API routes (and spied on in tests).
export function getMiners(): CatalogMiner[] {
  return MINERS;
}

export function getDryCoolers(): DryCoolerModel[] {
  return DRY_COOLERS;
}

export function getAirFans(): AirFanModel[] {
  return AIR_FANS;
}

export function getUpdates(): Record<string, { lastUpdated: string; note: string }> {
  return CATALOG_UPDATES;
}

/** "Oct 2026": when hardware prices were last refreshed (data/updates.json). UTC, so server and client agree. */
export function hardwarePricesAsOf(): string {
  return new Date(CATALOG_UPDATES.miners.lastUpdated).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
