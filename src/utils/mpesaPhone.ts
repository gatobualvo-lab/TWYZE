// Phone numbers for M-Pesa. The same rules as the server (supabase/functions/_shared/mpesa.ts),
// so the app can check a number before asking for a payment; a test keeps the two in step.

/**
 * Turns what a person types (0712 345 678, +254 712 345 678, 712345678, 0112...) into the
 * 2547XXXXXXXX / 2541XXXXXXXX form M-Pesa needs, or null if it is not a Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: unknown): string | null {
  const digits = String(input ?? '').replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) return null;
  let national = digits.startsWith('254') ? digits.slice(3) : digits;
  if (national.startsWith('0')) national = national.slice(1);
  return /^[17]\d{8}$/.test(national) ? `254${national}` : null;
}

/** 254712345678 -> 0712 345 678, for showing back to the person. */
export function formatKenyanPhone(normalized: string): string {
  const national = normalized.startsWith('254') ? `0${normalized.slice(3)}` : normalized;
  return national.length === 10 ? `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}` : national;
}
