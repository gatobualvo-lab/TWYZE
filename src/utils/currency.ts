import { formatCurrency } from './format';
import { ACCOUNT_CURRENCIES, getAccountCurrency } from './accountCurrency';

// Amounts are stored in the account's own currency (chosen at signup) so every
// report keeps adding up. A document can be *shown* in the customer's currency:
// `rate` is how many units of the account currency make 1 unit of that
// currency (e.g. a KES account, USD at 129.5), so shown = stored amount / rate.

export const COMMON_CURRENCIES = ACCOUNT_CURRENCIES;

export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** Formats a stored amount in the document's currency. Documents in the account currency format exactly as everywhere else. */
export function formatInCurrency(
  amount: unknown,
  currency: string | null | undefined,
  rate: unknown,
  base: string = getAccountCurrency()
): string {
  const code = (currency || base).toUpperCase();
  if (code === base) return formatCurrency(amount, base);

  const stored = Number(amount);
  const r = Number(rate);
  const converted = (Number.isFinite(stored) ? stored : 0) / (Number.isFinite(r) && r > 0 ? r : 1);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'code' })
      .format(converted)
      .replace(/[  ]/g, ' ');
  } catch {
    return `${code} ${converted.toFixed(2)}`;
  }
}

/** Today's market rate as units of `base` per 1 unit of `currency`, or null if it can't be fetched. */
export async function fetchBasePerUnit(currency: string, base: string = getAccountCurrency()): Promise<number | null> {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!response.ok) return null;
    const data = await response.json();
    const unitsPerBase = Number(data?.rates?.[currency]);
    if (!Number.isFinite(unitsPerBase) || unitsPerBase <= 0) return null;
    return Math.round((1 / unitsPerBase) * 10000) / 10000;
  } catch {
    return null;
  }
}
