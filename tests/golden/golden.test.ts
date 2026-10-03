import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { calculateFarmMetrics } from '@/lib/calculations';
import { generateForecast } from '@/lib/forecasting';
import { GOLDEN_FORECAST_PARAMS, GOLDEN_MARKET, GOLDEN_NOW, GOLDEN_PRESETS, buildPresetConfig } from './cases';

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const REL_TOLERANCE = 1e-9;

/** JSON round-trip so Dates become ISO strings and undefined fields drop out. */
function normalize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** Deep compare with a relative tolerance on numbers; reports the first differing path. */
function diff(actual: unknown, expected: unknown, at = '$'): string | null {
  if (typeof actual === 'number' && typeof expected === 'number') {
    const scale = Math.max(Math.abs(actual), Math.abs(expected), 1e-12);
    return Math.abs(actual - expected) / scale <= REL_TOLERANCE ? null : `${at}: ${expected} → ${actual}`;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return `${at}: length ${expected.length} → ${actual.length}`;
    for (let i = 0; i < actual.length; i++) {
      const d = diff(actual[i], expected[i], `${at}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const k of keys) {
      const d = diff((actual as Record<string, unknown>)[k], (expected as Record<string, unknown>)[k], `${at}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return actual === expected ? null : `${at}: ${JSON.stringify(expected)} → ${JSON.stringify(actual)}`;
}

describe('golden fixtures: presets through the engine', () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: GOLDEN_NOW });
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  for (const preset of GOLDEN_PRESETS) {
    it(`${preset.slug} matches tests/golden/fixtures/${preset.slug}.json`, () => {
      const config = buildPresetConfig(preset);
      const actual = normalize({
        input: { config, params: GOLDEN_FORECAST_PARAMS, market: GOLDEN_MARKET },
        metrics: calculateFarmMetrics(config),
        forecast: generateForecast(config, GOLDEN_FORECAST_PARAMS, GOLDEN_MARKET, GOLDEN_NOW),
      });

      const file = path.join(FIXTURE_DIR, `${preset.slug}.json`);
      if (UPDATE) {
        fs.mkdirSync(FIXTURE_DIR, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(actual, null, 2) + '\n');
        return;
      }
      expect(fs.existsSync(file), `missing fixture; run pnpm test:golden:update`).toBe(true);
      const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(diff(actual, expected), 'golden drift (first differing path)').toBeNull();
    });
  }
});
