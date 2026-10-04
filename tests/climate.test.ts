import { describe, it, expect, vi } from 'vitest';
import { searchPlaces, summarizeClimate } from '@/lib/climate';

describe('summarizeClimate', () => {
  it('averages daily max/min, takes the extremes, and averages humidity', () => {
    expect(summarizeClimate([30, 40, 35], [10, 20, 15], [50, 70])).toEqual({
      avgYearlyTempC: 25,
      maxTempC: 40,
      minTempC: 10,
      avgHumidityPercent: 60,
    });
  });

  it('refuses an empty series instead of producing NaN', () => {
    expect(() => summarizeClimate([], [], [])).toThrow(/No climate data/);
  });
});

describe('searchPlaces', () => {
  it('needs 3 characters and maps Nominatim rows to short labels', async () => {
    expect(await searchPlaces('as')).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { name: 'Asunción', display_name: 'Asunción, Distrito Capital, Paraguay', lat: '-25.28', lon: '-57.63' },
    ]))));
    expect(await searchPlaces('Asuncion')).toEqual([{ name: 'Asunción', label: 'Asunción, Paraguay', lat: -25.28, lng: -57.63 }]);
  });
});
