// Turns an order read from a chat message (see scan-order) into sale lines:
// matches each product to the user's inventory (for the buying price), and
// when the message gives ONE price for several products, splits it across them.
// Pure functions, no I/O, so they can be unit tested.

export interface ScannedOrderItem {
  name: string;
  quantity: number;
  /** A price written for this item alone, if any. */
  price: number | null;
  pricePerUnit: boolean;
}

export interface ScannedOrder {
  isOrder: boolean;
  customerName: string;
  customerPhone: string;
  location: string;
  deliveryPerson: string;
  date: string;
  /** The single price stated for the whole order, if any. */
  totalPrice: number | null;
  items: ScannedOrderItem[];
  notes: string;
}

export interface CatalogItem {
  name: string;
  costPrice: number;
  sellingPrice: number;
  itemType: 'goods' | 'service';
  colors: string[];
}

export interface SaleLineDraft {
  /** The inventory name when matched, otherwise the wording from the message. */
  name: string;
  quantity: number;
  unitPrice: number;
  buyingPrice: number;
  itemType: 'goods' | 'service';
  colors: string[];
  matched: boolean;
}

export interface OrderDraft {
  lines: SaleLineDraft[];
  total: number;
  warnings: string[];
  /** Set when one stated price had to be divided between several products. */
  splitNote: string | null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function singular(token: string): string {
  if (token.length > 3 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

export function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(singular);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length];
}

/** Two words are "the same" if equal, or (for longer words) one typo apart, e.g. "chaor" for "chair". */
function sameToken(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5) return false;
  return editDistance(a, b) <= 1;
}

/** 0 to 1: how well a name in a message matches an inventory name. */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  if (ta.join(' ') === tb.join(' ')) return 1;

  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Set<number>();
  let hits = 0;
  for (const token of short) {
    const idx = long.findIndex((t, i) => !used.has(i) && sameToken(token, t));
    if (idx >= 0) {
      used.add(idx);
      hits++;
    }
  }
  if (hits === 0) return 0;

  const dice = (2 * hits) / (ta.length + tb.length);
  // Every word of the shorter name appears in the longer one ("office chair"
  // inside "headrest office chair"): a strong match, but not an exact one.
  const containment = hits === short.length ? 0.6 + 0.3 * (short.length / long.length) : 0;
  return Math.min(0.99, Math.max(dice, containment));
}

export const MATCH_THRESHOLD = 0.6;
/** If a second, different item scores this close to the best, the choice is a guess. */
const AMBIGUITY_MARGIN = 0.1;

export interface MatchResult {
  item: CatalogItem | null;
  score: number;
  /** Other items that matched about as well, when the best pick is uncertain. */
  ambiguousWith: CatalogItem[];
}

export function matchProduct(name: string, catalog: CatalogItem[]): MatchResult {
  const scored = catalog
    .map(item => ({ item, score: nameSimilarity(name, item.name) }))
    .filter(s => s.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length);

  if (scored.length === 0) return { item: null, score: 0, ambiguousWith: [] };

  const best = scored[0];
  const close = scored.slice(1).filter(s => best.score - s.score <= AMBIGUITY_MARGIN && s.item.name !== best.item.name);
  if (best.score < 1 && close.length > 0) {
    return { item: null, score: best.score, ambiguousWith: [best.item, ...close.map(c => c.item)] };
  }
  return { item: best.item, score: best.score, ambiguousWith: [] };
}

// ---------------------------------------------------------------------------
// Splitting one price across several products
// ---------------------------------------------------------------------------

/** Divides `total` into integer-cent shares proportional to `weights`, adding up to exactly `total`. */
export function splitTotal(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const totalCents = Math.round(total * 100);
  const clean = weights.map(w => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  const effective = sum > 0 ? clean : clean.map(() => 1);
  const effectiveSum = effective.reduce((a, b) => a + b, 0);

  const exact = effective.map(w => (totalCents * w) / effectiveSum);
  const floors = exact.map(Math.floor);
  let remaining = totalCents - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remaining <= 0) break;
    floors[index] += 1;
    remaining--;
  }
  return floors.map(c => c / 100);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function splitWeights(lines: Array<{ quantity: number; match: CatalogItem | null }>): number[] {
  if (lines.every(l => l.match && l.match.sellingPrice > 0)) {
    return lines.map(l => l.match!.sellingPrice * l.quantity);
  }
  if (lines.every(l => l.match && l.match.itemType === 'goods' && l.match.costPrice > 0)) {
    return lines.map(l => l.match!.costPrice * l.quantity);
  }
  return lines.map(l => l.quantity);
}

// ---------------------------------------------------------------------------
// Building the draft
// ---------------------------------------------------------------------------

export function buildOrderDraft(order: ScannedOrder, catalog: CatalogItem[]): OrderDraft {
  const warnings: string[] = [];
  let splitNote: string | null = null;

  const entries = order.items.map(item => {
    const result = matchProduct(item.name, catalog);
    if (!result.item) {
      warnings.push(
        result.ambiguousWith.length > 0
          ? `"${item.name}" could be ${result.ambiguousWith.map(i => `"${i.name}"`).join(' or ')}. Pick the right one and check its buying price.`
          : `"${item.name}" is not in your inventory. Enter its buying price yourself.`
      );
    }
    return { item, match: result.item, quantity: item.quantity > 0 ? item.quantity : 1 };
  });

  const lineTotals: Array<number | null> = entries.map(e =>
    e.item.price === null ? null : round2(e.item.pricePerUnit ? e.item.price * e.quantity : e.item.price)
  );

  const pricedIndexes = lineTotals.flatMap((t, i) => (t === null ? [] : [i]));
  const unpricedIndexes = lineTotals.flatMap((t, i) => (t === null ? [i] : []));
  const pricedSum = round2(pricedIndexes.reduce((s, i) => s + (lineTotals[i] as number), 0));
  const stated = order.totalPrice;

  if (stated !== null && unpricedIndexes.length > 0) {
    const remaining = round2(stated - pricedSum);
    if (pricedIndexes.length === 0 || remaining > 0) {
      const targets = unpricedIndexes;
      const shares = splitTotal(pricedIndexes.length === 0 ? stated : remaining, splitWeights(targets.map(i => entries[i])));
      targets.forEach((entryIndex, k) => {
        lineTotals[entryIndex] = shares[k];
      });
      if (targets.length > 1) splitNote = `The price ${formatPlain(pricedIndexes.length === 0 ? stated : remaining)} was split across ${targets.length} items in proportion to your selling prices.`;
    } else {
      // The individual prices already use up (or exceed) the total: the message is inconsistent, so trust the total.
      const shares = splitTotal(stated, splitWeights(entries));
      shares.forEach((share, i) => {
        lineTotals[i] = share;
      });
      splitNote = `The item prices did not add up to ${formatPlain(stated)}, so that total was split across the items.`;
    }
  } else if (stated !== null && unpricedIndexes.length === 0 && Math.abs(pricedSum - stated) > 1) {
    warnings.push(`The item prices add up to ${formatPlain(pricedSum)} but the message total is ${formatPlain(stated)}. Check the prices.`);
  } else if (stated === null && unpricedIndexes.length > 0) {
    // No price in the message for these: fall back to the inventory selling price.
    for (const i of unpricedIndexes) {
      const match = entries[i].match;
      if (match && match.sellingPrice > 0) {
        lineTotals[i] = round2(match.sellingPrice * entries[i].quantity);
      } else {
        lineTotals[i] = 0;
        warnings.push(`No price was given for "${entries[i].item.name}". Enter the selling price.`);
      }
    }
  }

  const lines: SaleLineDraft[] = entries.map((e, i) => {
    const total = lineTotals[i] ?? 0;
    const isService = e.match?.itemType === 'service';
    return {
      name: e.match ? e.match.name : e.item.name,
      quantity: e.quantity,
      unitPrice: round2(total / e.quantity),
      buyingPrice: e.match && !isService ? e.match.costPrice : 0,
      itemType: isService ? 'service' : 'goods',
      colors: e.match?.colors ?? [],
      matched: e.match !== null,
    };
  });

  return {
    lines,
    total: round2(lineTotals.reduce<number>((s, t) => s + (t ?? 0), 0)),
    warnings,
    splitNote,
  };
}

function formatPlain(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
