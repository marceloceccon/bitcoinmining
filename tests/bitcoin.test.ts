import { describe, it, expect } from 'vitest';
import {
  averageSubsidy,
  estimateHalvingDate,
  hashpriceUsdPerPhDay,
  nextHalving,
  nextHalvingHeight,
  subsidyAtHeight,
} from '@/lib/bitcoin';

describe('subsidyAtHeight', () => {
  it('follows 50 / 2^floor(h / 210,000)', () => {
    expect(subsidyAtHeight(0)).toBe(50);
    expect(subsidyAtHeight(209_999)).toBe(50);
    expect(subsidyAtHeight(210_000)).toBe(25);
    expect(subsidyAtHeight(840_000)).toBe(3.125);
    expect(subsidyAtHeight(969_763)).toBe(3.125);
    expect(subsidyAtHeight(1_050_000)).toBe(1.5625);
    expect(subsidyAtHeight(64 * 210_000)).toBe(0);
  });
});

describe('nextHalvingHeight / averageSubsidy', () => {
  it('the next halving after the 2026 tip is block 1,050,000', () => {
    expect(nextHalvingHeight(969_763)).toBe(1_050_000);
    expect(nextHalvingHeight(1_050_000)).toBe(1_260_000);
  });

  it('weights a range that straddles a halving by blocks on each side', () => {
    expect(averageSubsidy(1_049_000, 1_051_000)).toBeCloseTo((1000 * 3.125 + 1000 * 1.5625) / 2000, 12);
    expect(averageSubsidy(900_000, 901_000)).toBe(3.125);
  });
});

describe('estimateHalvingDate', () => {
  it('lands block 1,050,000 ~557 days after the 2026-10-03 tip at 10 min/block', () => {
    const date = estimateHalvingDate(1_050_000, 969_763, new Date('2026-10-03T00:00:00Z'));
    expect(date.toISOString().slice(0, 10)).toBe('2028-04-12');
    expect(nextHalving(969_763, new Date('2026-10-03T00:00:00Z')).height).toBe(1_050_000);
  });

  it('scales with the assumed block interval', () => {
    const now = new Date('2026-10-03T00:00:00Z');
    const fast = estimateHalvingDate(1_050_000, 969_763, now, 9.5);
    const slow = estimateHalvingDate(1_050_000, 969_763, now, 10.5);
    expect(fast.getTime()).toBeLessThan(slow.getTime());
  });
});

describe('hashpriceUsdPerPhDay', () => {
  it('includes transaction fees: 144 × (subsidy + fees) × price / (EH × 1000)', () => {
    const market = { btcPriceUsd: 84714, networkHashrateEh: 964, blockReward: 3.125, avgFeesPerBlockBtc: 0.027 };
    expect(hashpriceUsdPerPhDay(market)).toBeCloseTo((144 * 3.152 * 84714) / 964000, 9);
    expect(hashpriceUsdPerPhDay(market)).toBeGreaterThan(hashpriceUsdPerPhDay({ ...market, avgFeesPerBlockBtc: 0 }));
  });

  it('is 0 for a zero hashrate instead of dividing by zero', () => {
    expect(hashpriceUsdPerPhDay({ btcPriceUsd: 1, networkHashrateEh: 0, blockReward: 3.125, avgFeesPerBlockBtc: 0 })).toBe(0);
  });
});
