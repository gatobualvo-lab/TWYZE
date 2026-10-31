// Product categories are typed once on a product and then reused, so the list is simply
// whatever categories the business's products already carry. These helpers keep that list
// tidy: no blanks, no "Clothing" and "clothing" side by side, and a stable order.

const clean = (value: unknown): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/**
 * Merges category names from products with ones just added in a form and the product's
 * current value. Duplicates that differ only by letter case collapse to the first spelling.
 */
export function mergeCategories(
  fromProducts: Array<string | null | undefined>,
  added: string[] = [],
  current = ''
): string[] {
  const seen = new Map<string, string>();
  for (const raw of [...fromProducts, ...added, current]) {
    const name = clean(raw);
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** The spelling to store for a typed category: an existing one if it matches, else as typed. */
export function resolveCategory(typed: string, existing: string[]): string {
  const name = clean(typed);
  if (!name) return '';
  return existing.find(e => e.toLowerCase() === name.toLowerCase()) ?? name;
}
