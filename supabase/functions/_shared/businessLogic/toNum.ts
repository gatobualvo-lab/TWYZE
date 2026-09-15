// Deno copy of src/utils/number.ts's toNum(). SOURCE OF TRUTH: src/utils/number.ts.
export const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
