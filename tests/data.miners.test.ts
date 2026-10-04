import { describe, it, expect } from 'vitest';
import { MINERS, CATALOG_UPDATES } from '@/lib/catalog';
import { PRESETS } from '@/lib/presets';

const STALE_AFTER_DAYS = 120;
const ENUMS = {
  cooling: ['air', 'hydro', 'immersion'],
  status: ['current', 'legacy', 'announced'],
  segment: ['industrial', 'home'],
  price_basis: ['new', 'used', 'index'],
} as const;

describe('data/miners.json (schema v2)', () => {
  it.each(MINERS.map((m) => [m.id, m] as const))('%s has every field with a valid value', (_id, m) => {
    for (const key of ['id', 'name', 'manufacturer', 'price_as_of', 'price_source', 'spec_source'] as const) {
      expect(typeof m[key], key).toBe('string');
      expect(m[key].length, key).toBeGreaterThan(0);
    }
    for (const key of ['hash_rate_ths', 'power_watts', 'price_usd', 'efficiency_jth', 'release_year'] as const) {
      expect(m[key], key).toBeGreaterThan(0);
    }
    for (const [key, allowed] of Object.entries(ENUMS)) {
      expect(allowed, key).toContain(m[key as keyof typeof ENUMS]);
    }
    expect(m.algorithm).toBe('SHA-256');
    expect(m.watercooled).toBe(m.cooling !== 'air');
    expect(Number.isNaN(Date.parse(m.price_as_of))).toBe(false);
  });

  it.each(MINERS.map((m) => [m.id, m] as const))('%s: power / hashrate agrees with efficiency within 3%', (_id, m) => {
    const derived = m.power_watts / m.hash_rate_ths;
    expect(Math.abs(derived - m.efficiency_jth) / m.efficiency_jth).toBeLessThan(0.03);
  });

  it('ids are unique and URL-safe', () => {
    const ids = MINERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('announced (not yet shipping) models are never used by presets', () => {
    const announced = new Set(MINERS.filter((m) => m.status === 'announced').map((m) => m.id));
    for (const preset of PRESETS) {
      for (const { minerId } of preset.miners) expect(announced.has(minerId), `${preset.id} → ${minerId}`).toBe(false);
    }
  });

  it('updates.json records the catalog refresh no earlier than the newest price', () => {
    const newest = Math.max(...MINERS.map((m) => Date.parse(m.price_as_of)));
    expect(Date.parse(CATALOG_UPDATES.miners.lastUpdated)).toBeGreaterThanOrEqual(newest - 86_400_000);
  });

  // Warning only: data ages visibly in the test output instead of breaking CI.
  it(`prices are at most ${STALE_AFTER_DAYS} days old (warning only)`, () => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 86_400_000;
    const stale = MINERS.filter((m) => Date.parse(m.price_as_of) < cutoff).map((m) => `${m.id} (${m.price_as_of})`);
    if (stale.length > 0) {
      console.warn(`[data] ${stale.length} miner price(s) older than ${STALE_AFTER_DAYS} days — time for the quarterly refresh: ${stale.join(', ')}`);
    }
    expect(true).toBe(true);
  });
});
