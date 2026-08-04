export type NumericInput = number | '';

export const toNum = (value: NumericInput | null | undefined): number => {
  if (value === '' || value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
};

export const parseInput = (raw: string): NumericInput => {
  if (raw === '' || raw === '-') return raw === '' ? '' : '';
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : '';
};
