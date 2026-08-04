export const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const safeCurrency = (v: unknown, locale = 'en-KE', currency = 'KES') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNum(v));

export const displayNumber = (v: unknown): string | number =>
  v === 0 || v === '0' || v === null || v === undefined ? '' : (v as number);
