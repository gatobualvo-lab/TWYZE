import { describe, it, expect } from 'vitest';
import {
  buildOrderDraft,
  matchProduct,
  nameSimilarity,
  splitTotal,
  type CatalogItem,
  type ScannedOrder,
} from './orderToSale';

const catalog: CatalogItem[] = [
  { name: 'Headrest Office Chair', costPrice: 5000, sellingPrice: 7500, itemType: 'goods', colors: ['Black'] },
  { name: 'Office Desk', costPrice: 9000, sellingPrice: 15000, itemType: 'goods', colors: [] },
  { name: 'Dining Chair', costPrice: 2000, sellingPrice: 3500, itemType: 'goods', colors: [] },
  { name: 'Delivery Setup', costPrice: 0, sellingPrice: 500, itemType: 'service', colors: [] },
];

const order = (over: Partial<ScannedOrder> = {}): ScannedOrder => ({
  isOrder: true,
  customerName: 'Jane',
  customerPhone: '0712345678',
  location: 'Kilimani',
  deliveryPerson: '',
  date: '',
  totalPrice: null,
  items: [],
  notes: '',
  ...over,
});

const item = (name: string, quantity = 1, price: number | null = null, pricePerUnit = false) => ({ name, quantity, price, pricePerUnit });

describe('splitTotal', () => {
  it('always adds up to exactly the total', () => {
    for (const [total, weights] of [
      [15000, [7500, 15000]],
      [100, [1, 1, 1]],
      [9999.99, [3, 7, 11]],
      [10, [0, 0]],
    ] as Array<[number, number[]]>) {
      const shares = splitTotal(total, weights);
      expect(Math.round(shares.reduce((a, b) => a + b, 0) * 100)).toBe(Math.round(total * 100));
    }
  });

  it('is proportional to the weights', () => {
    expect(splitTotal(15000, [1, 2])).toEqual([5000, 10000]);
  });

  it('splits evenly when there are no usable weights', () => {
    expect(splitTotal(1000, [0, 0])).toEqual([500, 500]);
    expect(splitTotal(100, [1, 1, 1])).toEqual([33.34, 33.33, 33.33]);
  });

  it('handles an empty list', () => {
    expect(splitTotal(100, [])).toEqual([]);
  });
});

describe('nameSimilarity / matchProduct', () => {
  it('matches exact, plural and differently-cased names', () => {
    expect(nameSimilarity('office desk', 'Office Desk')).toBe(1);
    expect(nameSimilarity('office desks', 'Office Desk')).toBe(1);
  });

  it('tolerates a one-letter typo in a longer word', () => {
    expect(matchProduct('headrest ofice chair', catalog).item?.name).toBe('Headrest Office Chair');
  });

  it('matches a shorter wording that sits inside the inventory name', () => {
    expect(matchProduct('headrest chair', catalog).item?.name).toBe('Headrest Office Chair');
  });

  it('does not match unrelated products', () => {
    expect(matchProduct('laptop bag', catalog).item).toBeNull();
  });

  it('refuses to guess when two products fit equally well', () => {
    const result = matchProduct('chair', catalog);
    expect(result.item).toBeNull();
    expect(result.ambiguousWith.map(i => i.name)).toEqual(expect.arrayContaining(['Headrest Office Chair', 'Dining Chair']));
  });
});

describe('buildOrderDraft', () => {
  it('splits one price over two products in proportion to selling prices, and fills buying prices', () => {
    // 7,500 : 15,000 catalog prices = 1 : 2, so 15,000 becomes 5,000 + 10,000
    const draft = buildOrderDraft(
      order({ totalPrice: 15000, items: [item('headrest office chair'), item('office desk')] }),
      catalog
    );
    expect(draft.lines.map(l => [l.name, l.unitPrice, l.buyingPrice])).toEqual([
      ['Headrest Office Chair', 5000, 5000],
      ['Office Desk', 10000, 9000],
    ]);
    expect(draft.total).toBe(15000);
    expect(draft.splitNote).toContain('split across 2 items');
    expect(draft.warnings).toEqual([]);
  });

  it('splits using quantity too, and the lines still add up to the stated total', () => {
    const draft = buildOrderDraft(
      order({ totalPrice: 20000, items: [item('headrest office chair', 2), item('office desk', 1)] }),
      catalog
    );
    const sum = draft.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    expect(Math.abs(sum - 20000)).toBeLessThan(0.05);
    expect(draft.total).toBe(20000);
  });

  it('does not split a single product', () => {
    const draft = buildOrderDraft(order({ totalPrice: 7000, items: [item('office desk')] }), catalog);
    expect(draft.lines[0].unitPrice).toBe(7000);
    expect(draft.splitNote).toBeNull();
  });

  it('uses per-item prices when each item has its own', () => {
    const draft = buildOrderDraft(
      order({ items: [item('office desk', 1, 14000), item('dining chair', 4, 3000, true)] }),
      catalog
    );
    expect(draft.lines.map(l => l.unitPrice)).toEqual([14000, 3000]);
    expect(draft.total).toBe(26000);
  });

  it('treats a per-line price as the total for that line unless it is marked per unit', () => {
    const draft = buildOrderDraft(order({ items: [item('dining chair', 4, 12000)] }), catalog);
    expect(draft.lines[0].unitPrice).toBe(3000);
    expect(draft.total).toBe(12000);
  });

  it('splits only what is left after items that have their own price', () => {
    const draft = buildOrderDraft(
      order({ totalPrice: 20000, items: [item('office desk', 1, 14000), item('dining chair'), item('headrest office chair')] }),
      catalog
    );
    expect(draft.lines[0].unitPrice).toBe(14000);
    expect(draft.lines[1].unitPrice + draft.lines[2].unitPrice).toBe(6000);
    expect(draft.total).toBe(20000);
  });

  it('flags a product that is not in inventory, keeping the wording from the message', () => {
    const draft = buildOrderDraft(order({ totalPrice: 3000, items: [item('laptop bag')] }), catalog);
    expect(draft.lines[0]).toMatchObject({ name: 'laptop bag', matched: false, buyingPrice: 0, unitPrice: 3000 });
    expect(draft.warnings[0]).toContain('not in your inventory');
  });

  it('splits equally by quantity when nothing matches inventory', () => {
    const draft = buildOrderDraft(order({ totalPrice: 3000, items: [item('thing a'), item('thing b')] }), catalog);
    expect(draft.lines.map(l => l.unitPrice)).toEqual([1500, 1500]);
  });

  it('treats a matched service as a service with no buying price', () => {
    const draft = buildOrderDraft(order({ totalPrice: 500, items: [item('delivery setup')] }), catalog);
    expect(draft.lines[0]).toMatchObject({ itemType: 'service', buyingPrice: 0, unitPrice: 500 });
  });

  it('falls back to the inventory selling price when the message has no price', () => {
    const draft = buildOrderDraft(order({ items: [item('dining chair', 2)] }), catalog);
    expect(draft.lines[0].unitPrice).toBe(3500);
    expect(draft.total).toBe(7000);
  });

  it('warns when item prices disagree with the stated total', () => {
    const draft = buildOrderDraft(
      order({ totalPrice: 20000, items: [item('office desk', 1, 14000), item('dining chair', 1, 3000)] }),
      catalog
    );
    expect(draft.warnings.join(' ')).toContain('add up to');
  });

  it('trusts the total when per-item prices already exceed it', () => {
    const draft = buildOrderDraft(
      order({ totalPrice: 10000, items: [item('office desk', 1, 14000), item('dining chair')] }),
      catalog
    );
    expect(draft.total).toBe(10000);
    expect(draft.splitNote).toContain('did not add up');
  });
});
