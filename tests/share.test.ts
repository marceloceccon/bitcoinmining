import { describe, it, expect } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/share';
import { buildPresetConfig, getPreset } from '@/lib/presets';
import { MINERS } from '@/lib/catalog';
import { DEFAULT_FORECAST_PARAMS } from '@/lib/forecastStore';

describe('share links', () => {
  it('round-trips a preset farm and forecast params, storing catalog miners by id', async () => {
    const config = buildPresetConfig(getPreset('small-farm'));
    const s = await encodeShare({ config, params: DEFAULT_FORECAST_PARAMS, growthOverride: 12 });
    expect(s).toMatch(/^[jz][A-Za-z0-9_-]+$/);
    expect(s.length).toBeLessThan(1500);
    expect(await decodeShare(s)).toEqual({ config, params: DEFAULT_FORECAST_PARAMS, growthOverride: 12 });
  });

  it('resolves catalog miners against the current catalog (no stale prices)', async () => {
    const config = buildPresetConfig(getPreset('garage'));
    const s = await encodeShare({ config });
    const repriced = MINERS.map((m) => (m.id === 's21-xp' ? { ...m, price_usd: 1 } : m));
    const decoded = await decodeShare(s, repriced);
    expect(decoded!.config.miners[0].miner.price_usd).toBe(1);
  });

  it('keeps custom miners verbatim and compresses large payloads', async () => {
    const base = buildPresetConfig(getPreset('garage'));
    const custom = Array.from({ length: 12 }, (_, i) => ({ miner: { ...MINERS[0], id: `custom-${i}`, name: `My rig ${i}` }, quantity: i + 1 }));
    const config = { ...base, miners: custom };
    const s = await encodeShare({ config });
    expect(s[0]).toBe('z');
    expect((await decodeShare(s))!.config.miners).toEqual(custom);
  });

  it('rejects garbage', async () => {
    expect(await decodeShare('jnot-json')).toBeNull();
    expect(await decodeShare('x123')).toBeNull();
  });
});
