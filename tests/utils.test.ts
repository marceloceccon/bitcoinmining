import { describe, it, expect, vi } from 'vitest';
import {
  formatUsd,
  formatBtc,
  formatHashRate,
  formatPower,
  formatPercent,
  formatNumber,
  formatDate,
  debounce,
  getRoiColor,
  generateId,
} from '@/lib/utils';

// ════════════════════════════════════════════════════════════════════════
// FORMAT USD
// ════════════════════════════════════════════════════════════════════════

describe('formatUsd', () => {
  it('formats zero as $0', () => {
    expect(formatUsd(0)).toBe('$0');
  });

  it('formats positive integer', () => {
    expect(formatUsd(1000)).toBe('$1,000');
  });

  it('formats large number with commas', () => {
    expect(formatUsd(1234567)).toBe('$1,234,567');
  });

  it('rounds decimals to zero fraction digits', () => {
    expect(formatUsd(99.99)).toBe('$100');
  });

  it('formats negative numbers', () => {
    expect(formatUsd(-500)).toBe('-$500');
  });
});

// ════════════════════════════════════════════════════════════════════════
// FORMAT BTC
// ════════════════════════════════════════════════════════════════════════

describe('formatBtc', () => {
  it('formats with 8 decimal places by default', () => {
    expect(formatBtc(1.5)).toBe('1.50000000 ₿');
  });

  it('formats zero', () => {
    expect(formatBtc(0)).toBe('0.00000000 ₿');
  });

  it('respects custom decimal places', () => {
    expect(formatBtc(0.123456, 4)).toBe('0.1235 ₿');
  });

  it('formats very small amounts (satoshi-level)', () => {
    expect(formatBtc(0.00000001)).toBe('0.00000001 ₿');
  });
});

// ════════════════════════════════════════════════════════════════════════
// FORMAT HASH RATE
// ════════════════════════════════════════════════════════════════════════

describe('formatHashRate', () => {
  it('formats TH/s for < 1000', () => {
    expect(formatHashRate(234)).toBe('234.00 TH/s');
  });

  it('converts to PH/s for 1000-999999', () => {
    expect(formatHashRate(2340)).toBe('2.34 PH/s');
  });

  it('converts to EH/s for ≥ 1,000,000', () => {
    expect(formatHashRate(1000000)).toBe('1.00 EH/s');
  });

  it('formats 750,000,000 TH/s as 750.00 EH/s', () => {
    expect(formatHashRate(750000000)).toBe('750.00 EH/s');
  });

  it('formats exactly 1000 as PH/s', () => {
    expect(formatHashRate(1000)).toBe('1.00 PH/s');
  });
});

// ════════════════════════════════════════════════════════════════════════
// FORMAT POWER
// ════════════════════════════════════════════════════════════════════════

describe('formatPower', () => {
  it('formats kW for < 1000', () => {
    expect(formatPower(368.55)).toBe('368.55 kW');
  });

  it('converts to MW for ≥ 1000', () => {
    expect(formatPower(1500)).toBe('1.50 MW');
  });

  it('formats exactly 1000 as MW', () => {
    expect(formatPower(1000)).toBe('1.00 MW');
  });

  it('formats small values', () => {
    expect(formatPower(3.51)).toBe('3.51 kW');
  });
});

// ════════════════════════════════════════════════════════════════════════
// FORMAT PERCENT
// ════════════════════════════════════════════════════════════════════════

describe('formatPercent', () => {
  it('formats with 1 decimal by default', () => {
    expect(formatPercent(42.567)).toBe('42.6%');
  });

  it('respects custom decimals', () => {
    expect(formatPercent(99.1234, 2)).toBe('99.12%');
  });

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats negative values', () => {
    expect(formatPercent(-5.5)).toBe('-5.5%');
  });
});

// ════════════════════════════════════════════════════════════════════════
// FORMAT NUMBER
// ════════════════════════════════════════════════════════════════════════

describe('formatNumber', () => {
  it('formats with commas and 0 decimals by default', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('respects decimal places', () => {
    expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

// ════════════════════════════════════════════════════════════════════════
// FORMAT DATE
// ════════════════════════════════════════════════════════════════════════

describe('formatDate', () => {
  it('formats date as "Month Year"', () => {
    const date = new Date(2026, 0, 15); // Jan 15, 2026
    expect(formatDate(date)).toBe('Jan 2026');
  });

  it('formats December correctly', () => {
    const date = new Date(2028, 11, 1); // Dec 1, 2028
    expect(formatDate(date)).toBe('Dec 2028');
  });
});

// ════════════════════════════════════════════════════════════════════════
// DEBOUNCE
// ════════════════════════════════════════════════════════════════════════

describe('debounce', () => {
  it('calls function after wait period', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('resets timer on subsequent calls', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // reset
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('passes arguments to the debounced function', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('hello', 42);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('hello', 42);

    vi.useRealTimers();
  });
});

// ════════════════════════════════════════════════════════════════════════
// ROI COLOR
// ════════════════════════════════════════════════════════════════════════

describe('getRoiColor', () => {
  it('returns red for negative ROI', () => {
    expect(getRoiColor(-10)).toBe('text-red-500');
  });

  it('returns yellow for 0-50% ROI', () => {
    expect(getRoiColor(25)).toBe('text-yellow-500');
  });

  it('returns orange for 50-100% ROI', () => {
    expect(getRoiColor(75)).toBe('text-orange-500');
  });

  it('returns green for ≥ 100% ROI', () => {
    expect(getRoiColor(150)).toBe('text-green-500');
  });

  it('edge case: exactly 0% → yellow', () => {
    expect(getRoiColor(0)).toBe('text-yellow-500');
  });

  it('edge case: exactly 50% → orange', () => {
    expect(getRoiColor(50)).toBe('text-orange-500');
  });

  it('edge case: exactly 100% → green', () => {
    expect(getRoiColor(100)).toBe('text-green-500');
  });
});

// ════════════════════════════════════════════════════════════════════════
// GENERATE ID
// ════════════════════════════════════════════════════════════════════════

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('contains only alphanumeric characters', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});
