import { formatCurrency } from './format';

// Amounts on a document are stored in KES so every report keeps adding up.
// A document can be *shown* in the customer's currency: `rate` is KES per 1
// unit of that currency (e.g. USD at 129.5), so shown = KES amount / rate.

export const COMMON_CURRENCIES: Array<{ code: string; name: string }> = [
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'CNY', name: 'Chinese Yuan' },
];

export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** Formats a KES amount in the document's currency. KES documents format exactly as before. */
export function formatInCurrency(amountKes: unknown, currency: string | null | undefined, rate: unknown): string {
  const code = (currency || 'KES').toUpperCase();
  if (code === 'KES') return formatCurrency(amountKes);

  const kes = Number(amountKes);
  const r = Number(rate);
  const converted = (Number.isFinite(kes) ? kes : 0) / (Number.isFinite(r) && r > 0 ? r : 1);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'code' })
      .format(converted)
      .replace(/[  ]/g, ' ');
  } catch {
    return `${code} ${converted.toFixed(2)}`;
  }
}

/** Today's market rate as KES per 1 unit of `currency`, or null if it can't be fetched. */
export async function fetchKesPerUnit(currency: string): Promise<number | null> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/KES');
    if (!response.ok) return null;
    const data = await response.json();
    const unitsPerKes = Number(data?.rates?.[currency]);
    if (!Number.isFinite(unitsPerKes) || unitsPerKes <= 0) return null;
    return Math.round((1 / unitsPerKes) * 10000) / 10000;
  } catch {
    return null;
  }
}
