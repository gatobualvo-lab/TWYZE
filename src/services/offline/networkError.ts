/**
 * Heuristic for "this failed because there's no connection" vs. a real
 * validation/business error. Supabase-js doesn't throw on a fetch failure —
 * it resolves with an error object carrying the underlying fetch/TypeError
 * message and no real Postgres error code, which is what these patterns
 * target. Shared by every offline write queue (sales, and the generic one).
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error) return false;
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error);
  return /failed to fetch|network ?error|load failed|err_internet_disconnected|err_network|err_connection/i.test(message);
}
