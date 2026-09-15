import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from './format';

describe('formatCurrency', () => {
  it('formats whole KES amounts with thousands separators', () => {
    expect(formatCurrency(182900)).toBe('KES 182,900');
  });

  it('rounds fractional amounts to whole shillings rather than leaking decimals', () => {
    expect(formatCurrency(1234.5)).toBe('KES 1,235');
  });

  it('treats non-numeric input as zero rather than showing NaN', () => {
    expect(formatCurrency('not-a-number')).toBe('KES 0');
    expect(formatCurrency(undefined)).toBe('KES 0');
    expect(formatCurrency(null)).toBe('KES 0');
  });

  it('renders negative amounts with a minus sign', () => {
    expect(formatCurrency(-500)).toBe('KES -500');
  });
});

describe('formatDate', () => {
  it('formats an ISO date as short month/day/year', () => {
    expect(formatDate('2026-08-05')).toBe('Aug 5, 2026');
  });

  it('returns an empty string for missing or invalid dates rather than "Invalid Date"', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });

  it('accepts custom Intl.DateTimeFormat options', () => {
    expect(formatDate('2026-08-05', { year: 'numeric', month: 'long', day: 'numeric' })).toBe(
      'August 5, 2026'
    );
  });
});
