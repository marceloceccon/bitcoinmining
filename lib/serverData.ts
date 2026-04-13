/**
 * Loads the static hardware catalogs from disk and caches them in module scope.
 *
 * **Server-only**: this module uses Node's `fs` and `path` and is not safe to
 * import from the Edge runtime (middleware.ts, edge route handlers). All
 * callers are App Router route handlers running on the Node runtime.
 *
 * The first call per server lifecycle reads from disk and populates the cache;
 * subsequent calls return the cached array. Cold-start cost is negligible (a
 * few KB of JSON), so we deliberately avoid async loaders here.
 */
import fs from 'fs';
import path from 'path';
import type { Miner, DryCoolerModel, AirFanModel } from '@/types';

let _miners: Miner[] | null = null;
let _dryCoolers: DryCoolerModel[] | null = null;
let _airFans: AirFanModel[] | null = null;

function readJson<T>(filename: string): T {
  const filePath = path.join(process.cwd(), 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getMiners(): Miner[] {
  if (!_miners) _miners = readJson<Miner[]>('miners.json');
  return _miners;
}

export function getDryCoolers(): DryCoolerModel[] {
  if (!_dryCoolers) _dryCoolers = readJson<DryCoolerModel[]>('dryCoolers.json');
  return _dryCoolers;
}

export function getAirFans(): AirFanModel[] {
  if (!_airFans) _airFans = readJson<AirFanModel[]>('airFans.json');
  return _airFans;
}

export function getUpdates() {
  return readJson<Record<string, { lastUpdated: string; note: string }>>('updates.json');
}

/**
 * Test-only: clears the module cache so unit tests can stub the data files
 * and exercise the disk-load path independently.
 */
export function __resetCacheForTests(): void {
  _miners = null;
  _dryCoolers = null;
  _airFans = null;
}
