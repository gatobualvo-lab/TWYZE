// Canonical currency/date formatters. Previously redefined independently in
// 7 different components with drifting options — most used
// Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })
// which (depending on ICU data) renders as "Ksh 1,234.5", stray decimal and
// all, while DashboardHome's own version rendered "KES 1,235". Same number,
// different text depending which screen you're on. This is the one
// definition every screen now renders from.

export function formatCurrency(amount: unknown): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  return `KES ${value.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatDate(
  dateString: unknown,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
  if (!dateString) return '';
  const d = new Date(dateString as string);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', options);
}
