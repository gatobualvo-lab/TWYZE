// Deno copy of src/services/aiAssistant/domainRouter.ts.
// SOURCE OF TRUTH: src/services/aiAssistant/domainRouter.ts — keep in sync manually.

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

const MARKETING_KEYWORDS = ['campaign', 'offer', 'promotion', 'promote', 'marketing', 'audience'];

const LOSING_MONEY_KEYWORDS = ['losing money', 'lose money', 'losing cash'];

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

  if (domains.size === 1) {
    domains.add('revenue_profit');
    domains.add('expenses');
  }

  return Array.from(domains).slice(0, MAX_DOMAINS);
}
