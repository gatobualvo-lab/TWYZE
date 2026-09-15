// Deterministic, keyword-based question classification — no LLM call. This
// is what keeps the AI Business Assistant's context bundles small and its
// per-question cost predictable: the Edge Function only ever fetches the
// domains this function selects, never a raw dump of every business table.
// Consistent with the rest of this app's intelligence layer (Opportunity
// Center, Health Score), routing is explainable rather than a black box.

export type DataDomain =
  | 'overview'
  | 'revenue_profit'
  | 'expenses'
  | 'receivables'
  | 'payables'
  | 'inventory'
  | 'customers'
  | 'products';

const MAX_DOMAINS = 5;

type KeywordDomain = Exclude<DataDomain, 'overview'>;

const DOMAIN_KEYWORDS: Record<KeywordDomain, string[]> = {
  revenue_profit: ['profit', 'revenue', 'sales', 'earning', 'income', 'performing', 'performance', 'trend'],
  expenses: ['expense', 'spend', 'spending', 'cost'],
  receivables: ['unpaid', 'owe me', 'owed to me', 'invoice', 'receivable', 'outstanding'],
  payables: ['owe', 'vendor', 'supplier', 'payable'],
  inventory: ['stock', 'reorder', 'inventory', 'restock'],
  customers: ['customer', 'client', 'follow up', 'follow-up', 'dormant', 'repeat', 'cross-sell', 'cross sell'],
  products: ['product', 'best sell', 'best-sell', 'bestsell', 'slow mov', 'margin', 'advertis'],
};

// Marketing questions ("which products should I promote", "give me
// marketing ideas") don't need their own data domain — they need the same
// product/customer performance data those two domains already fetch.
const MARKETING_KEYWORDS = ['campaign', 'offer', 'promotion', 'promote', 'marketing', 'audience'];

// "Where am I losing money?" has no single obvious domain — it could be
// expenses, unpaid receivables, vendor payables, or a low-margin product.
// Pull all four rather than guess which one the owner means.
const LOSING_MONEY_KEYWORDS = ['losing money', 'lose money', 'losing cash'];

/**
 * Classifies a free-text question into the data domains needed to answer
 * it. `overview` (health score + top opportunities) is always included so
 * the chat can never contradict the deterministic briefing cards shown
 * elsewhere in the app — both read the same underlying detectors.
 *
 * Capped at MAX_DOMAINS as a deterministic safety valve on cost/latency,
 * regardless of how many keywords happen to match.
 */
export function classifyQuestion(message: string): DataDomain[] {
  const text = message.toLowerCase();
  const domains = new Set<DataDomain>(['overview']);

  for (const domain of Object.keys(DOMAIN_KEYWORDS) as KeywordDomain[]) {
    if (DOMAIN_KEYWORDS[domain].some(kw => text.includes(kw))) {
      domains.add(domain);
    }
  }

  if (MARKETING_KEYWORDS.some(kw => text.includes(kw))) {
    domains.add('products');
    domains.add('customers');
  }

  if (LOSING_MONEY_KEYWORDS.some(kw => text.includes(kw))) {
    domains.add('expenses');
    domains.add('receivables');
    domains.add('payables');
    domains.add('products');
  }

  // No signal beyond the always-included overview — fall back to a sane
  // general default rather than sending Claude an almost-empty bundle.
  if (domains.size === 1) {
    domains.add('revenue_profit');
    domains.add('expenses');
  }

  return Array.from(domains).slice(0, MAX_DOMAINS);
}
