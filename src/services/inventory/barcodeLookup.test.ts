import { describe, it, expect } from 'vitest';
import { addScannedProduct, type ScannedProduct } from './barcodeLookup';

interface Line {
  id: string;
  product: string;
  quantity: number;
  buyingPrice: number;
  sellingPrice: number;
  itemType: 'goods' | 'service';
  availableColors?: string[];
}

let n = 0;
const blank = (): Line => ({ id: `new-${++n}`, product: '', quantity: 1, buyingPrice: 0, sellingPrice: 0, itemType: 'goods' });

const soap: ScannedProduct = { name: 'Soap', costPrice: 40, sellingPrice: 60, colors: [], inStock: 10 };
const milk: ScannedProduct = { name: 'Milk', costPrice: 50, sellingPrice: 70, colors: ['White'], inStock: 4 };

describe('addScannedProduct', () => {
  it('fills the first empty line instead of adding another', () => {
    const lines = addScannedProduct([blank()], soap, blank);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ product: 'Soap', quantity: 1, buyingPrice: 40, sellingPrice: 60 });
  });

  it('appends a new line once every line is used', () => {
    const lines = addScannedProduct(addScannedProduct([blank()], soap, blank), milk, blank);
    expect(lines.map(l => l.product)).toEqual(['Soap', 'Milk']);
    expect(lines[1].availableColors).toEqual(['White']);
  });

  it('adds one to the quantity when the same item is scanned again', () => {
    let lines = addScannedProduct([blank()], soap, blank);
    lines = addScannedProduct(lines, soap, blank);
    lines = addScannedProduct(lines, { ...soap, name: 'SOAP' }, blank);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  it('does not touch a service line that happens to share the name', () => {
    const service: Line = { ...blank(), product: 'Soap', itemType: 'service' };
    const lines = addScannedProduct([service], soap, blank);
    expect(lines).toHaveLength(2);
    expect(lines[0].quantity).toBe(1);
  });
});
