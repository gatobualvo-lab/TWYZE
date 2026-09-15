import { supabase } from '../../utils/supabase';

export type SearchResultType = 'customer' | 'product' | 'sale' | 'supplier' | 'document';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  actionTab: string;
}

const MIN_QUERY_LENGTH = 2;

export async function runUniversalSearch(query: string, limit = 20): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const { data, error } = await supabase.rpc('universal_search', { p_query: trimmed, p_limit: limit });
  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    type: row.result_type as SearchResultType,
    id: row.result_id,
    title: row.title,
    subtitle: row.subtitle,
    actionTab: row.action_tab,
  }));
}

const RECENT_KEY = 'trackwyze_recent_searches';
const MAX_RECENT = 5;

export function getRecentSearches(): SearchResult[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(result: SearchResult): void {
  try {
    const existing = getRecentSearches().filter(r => !(r.type === result.type && r.id === result.id));
    const updated = [result, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (private browsing, quota) — recent searches are a convenience, not critical
  }
}
