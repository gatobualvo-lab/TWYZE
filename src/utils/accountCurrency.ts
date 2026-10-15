// The currency this account works in. Chosen at signup, changeable in Account
// Settings, stored on profiles.currency and cached on the device so the very
// first render after a reload already shows the right symbol. Amounts are
// recorded and displayed in this currency; nothing is converted.

import { useSyncExternalStore } from 'react';

export const DEFAULT_CURRENCY = 'KES';
const KEY = 'trackwyze_account_currency';

const CURRENCY_NAMES: Array<{ code: string; name: string }> = [
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'ZMW', name: 'Zambian Kwacha' },
  { code: 'MWK', name: 'Malawian Kwacha' },
  { code: 'BWP', name: 'Botswana Pula' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
];

/** Currencies offered in the pickers (anyone can still be added later; the code is just three letters). */
export const ACCOUNT_CURRENCIES = CURRENCY_NAMES;

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

function readCached(): string {
  try {
    const v = localStorage.getItem(KEY);
    return isCurrencyCode(v) ? v : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

let current = readCached();
const listeners = new Set<() => void>();

export function getAccountCurrency(): string {
  return current;
}

/** Updates the working currency (and the device cache) and re-renders subscribed components. */
export function setAccountCurrency(code: unknown): void {
  const next = isCurrencyCode(String(code ?? '').toUpperCase()) ? String(code).toUpperCase() : DEFAULT_CURRENCY;
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Storage blocked: the profile value is re-applied on every load anyway.
  }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Components that render money subscribe with this so they update if the currency changes. */
export function useAccountCurrency(): string {
  return useSyncExternalStore(subscribe, getAccountCurrency, () => DEFAULT_CURRENCY);
}

export function currencyName(code: string): string {
  return CURRENCY_NAMES.find(c => c.code === code)?.name ?? code;
}

/** Test helper. */
export function __resetAccountCurrencyForTests(): void {
  current = DEFAULT_CURRENCY;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
