import { describe, it, expect, beforeEach } from 'vitest';
import { __resetAccountCurrencyForTests, getAccountCurrency, isCurrencyCode, setAccountCurrency } from './accountCurrency';
import { formatCurrency } from './format';
import { formatInCurrency } from './currency';

beforeEach(() => {
  __resetAccountCurrencyForTests();
});

describe('account currency', () => {
  it('defaults to KES and keeps KES formatting unchanged', () => {
    expect(getAccountCurrency()).toBe('KES');
    expect(formatCurrency(182900)).toBe('KES 182,900');
  });

  it('switches every formatted amount to the chosen currency', () => {
    setAccountCurrency('USD');
    expect(getAccountCurrency()).toBe('USD');
    expect(formatCurrency(1234.5)).toBe('USD 1,234.50');
    setAccountCurrency('ugx');
    expect(formatCurrency(1234.5)).toBe('UGX 1,235');
  });

  it('ignores invalid values and falls back to KES', () => {
    setAccountCurrency('USD');
    setAccountCurrency('dollars');
    expect(getAccountCurrency()).toBe('KES');
    setAccountCurrency(null);
    expect(getAccountCurrency()).toBe('KES');
  });

  it('validates three-letter codes', () => {
    expect(isCurrencyCode('NGN')).toBe(true);
    expect(isCurrencyCode('ngn')).toBe(false);
    expect(isCurrencyCode(5)).toBe(false);
  });

  it('documents in the account currency need no conversion; others convert at the rate', () => {
    setAccountCurrency('NGN');
    expect(formatInCurrency(15000, undefined, undefined)).toBe('NGN 15,000.00');
    expect(formatInCurrency(15000, 'NGN', 1)).toBe('NGN 15,000.00');
    expect(formatInCurrency(15000, 'USD', 1500)).toBe('USD 10.00');
  });
});
