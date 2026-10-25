import { describe, it, expect } from 'vitest';
import { buildReceiptFromSale } from './saleReceipt';

const sale = {
  id: 's1',
  product_name: 'Desk, Chair',
  selling_price: 19000,
  date: '2026-10-20T00:00:00+00:00',
  client_name: 'Irene',
  customer_phone: '0712345678',
  delivery_charge: 0,
};

describe('buildReceiptFromSale', () => {
  it('uses the sale line items', () => {
    const r = buildReceiptFromSale(sale, [
      { product_name: 'Desk', quantity: 2, selling_price: 6500, unit_price: 6500 },
      { product_name: 'Chair', quantity: 5, selling_price: 1200, unit_price: 1200 },
    ]);
    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(19000);
    expect(r.customerName).toBe('Irene');
    expect(r.customerPhone).toBe('0712345678');
    expect(r.date).toBe('2026-10-20');
  });

  it('falls back to one line for sales saved without line items', () => {
    const r = buildReceiptFromSale(sale, []);
    expect(r.items).toEqual([{ productName: 'Desk, Chair', quantity: 1, sellingPrice: 19000 }]);
  });

  it('adds the delivery charge as its own line when it explains the difference', () => {
    const r = buildReceiptFromSale({ ...sale, selling_price: 13500, delivery_charge: 500 }, [
      { product_name: 'Desk', quantity: 2, selling_price: 6500, unit_price: 6500 },
    ]);
    expect(r.items.map(i => i.productName)).toEqual(['Desk', 'Delivery']);
    expect(r.items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0)).toBe(13500);
  });

  it('does not invent a delivery line when the numbers do not match', () => {
    const r = buildReceiptFromSale({ ...sale, selling_price: 9999, delivery_charge: 500 }, [
      { product_name: 'Desk', quantity: 2, selling_price: 6500, unit_price: 6500 },
    ]);
    expect(r.items).toHaveLength(1);
  });
});
