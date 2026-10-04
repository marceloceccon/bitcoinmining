/**
 * Share links: the farm config and Projections inputs encoded into `?s=` as
 * base64url JSON, deflated when the JSON is over ~1.5 KB. Catalog miners are
 * stored by id and resolved against the current catalog on load, so a link
 * never revives stale specs or prices.
 */
import type { FarmConfig, ForecastParams, Miner } from '@/types';
import { MINERS } from '@/lib/catalog';
import { defaultConfig } from '@/lib/defaults';

export interface ShareState {
  config: FarmConfig;
  params?: ForecastParams;
  growthOverride?: number | null;
}

interface Payload {
  v: 1;
  /** Only the settings that differ from the defaults, plus the miners */
  c: Partial<Omit<FarmConfig, 'miners'>> & { miners: ({ id: string; q: number } | { m: Miner; q: number })[] };
  p?: ForecastParams;
  g?: number | null;
}

const COMPRESS_OVER = 1500;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeShare(state: ShareState, catalog: Miner[] = MINERS): Promise<string> {
  const ids = new Set(catalog.map((m) => m.id));
  const { miners: _miners, ...settings } = state.config;
  const changed = Object.fromEntries(
    Object.entries(settings).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((defaultConfig as unknown as Record<string, unknown>)[k])),
  );
  const payload: Payload = {
    v: 1,
    c: {
      ...changed,
      miners: state.config.miners.map(({ miner, quantity }) => (ids.has(miner.id) ? { id: miner.id, q: quantity } : { m: miner, q: quantity })),
    },
    ...(state.params ? { p: state.params } : {}),
    ...(state.growthOverride !== undefined ? { g: state.growthOverride } : {}),
  };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  if (json.length <= COMPRESS_OVER || typeof CompressionStream === 'undefined') return `j${toBase64Url(json)}`;
  return `z${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

/** Decode a share string; returns null for anything malformed or from an unknown version. */
export async function decodeShare(s: string, catalog: Miner[] = MINERS): Promise<ShareState | null> {
  try {
    const kind = s[0];
    let bytes = fromBase64Url(s.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') return null;
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Payload;
    if (payload?.v !== 1 || !payload.c || !Array.isArray(payload.c.miners)) return null;
    const miners = payload.c.miners.flatMap((entry) => {
      if ('m' in entry) return [{ miner: entry.m, quantity: entry.q }];
      const miner = catalog.find((m) => m.id === entry.id);
      return miner ? [{ miner, quantity: entry.q }] : [];
    });
    return { config: { ...defaultConfig, ...payload.c, miners }, params: payload.p, growthOverride: payload.g };
  } catch {
    return null;
  }
}
