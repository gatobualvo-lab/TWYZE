import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatInCurrency, fetchBasePerUnit, isValidCurrencyCode } from './currency';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatInCurrency', () => {
  it('formats KES exactly like the standard formatter', () => {
    expect(formatInCurrency(341040, 'KES', 1)).toBe('KES 341,040');
    expect(formatInCurrency(1500, undefined, undefined)).toBe('KES 1,500');
  });

  it('converts a KES amount using KES-per-unit', () => {
    expect(formatInCurrency(12950, 'USD', 129.5)).toBe('USD 100.00');
  });

  it('is case-insensitive about the currency code', () => {
    expect(formatInCurrency(12950, 'usd', 129.5)).toBe('USD 100.00');
  });

  it('falls back to a rate of 1 rather than dividing by zero or NaN', () => {
    expect(formatInCurrency(500, 'USD', 0)).toBe('USD 500.00');
    expect(formatInCurrency(500, 'USD', 'abc')).toBe('USD 500.00');
  });

  it('never throws on a currency code Intl does not know', () => {
    expect(() => formatInCurrency(1000, 'ZZZ', 10)).not.toThrow();
  });

  it('uses regular spaces, not non-breaking ones', () => {
    expect(formatInCurrency(12950, 'USD', 129.5)).not.toMatch(/[  ]/);
  });
});

describe('isValidCurrencyCode', () => {
  it('accepts three uppercase letters only', () => {
    expect(isValidCurrencyCode('USD')).toBe(true);
    expect(isValidCurrencyCode('usd')).toBe(false);
    expect(isValidCurrencyCode('US')).toBe(false);
    expect(isValidCurrencyCode('US1')).toBe(false);
  });
});

describe('fetchBasePerUnit', () => {
  it('inverts the API rate (units per KES) into KES per unit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { USD: 0.0077 } }) }));
    expect(await fetchBasePerUnit('USD')).toBeCloseTo(129.8701, 3);
  });

  it('returns null when the request fails, the currency is missing, or the rate is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchBasePerUnit('USD')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: {} }) }));
    expect(await fetchBasePerUnit('USD')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { USD: 0 } }) }));
    expect(await fetchBasePerUnit('USD')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchBasePerUnit('USD')).toBeNull();
  });
});
