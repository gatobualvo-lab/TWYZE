import { describe, it, expect } from 'vitest';
import { buildReceiptEscPos, EscPosBuilder, twoColumn, wrapText } from './escpos';

const decode = (bytes: Uint8Array) => Array.from(bytes).map(b => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : b === 0x0a ? '\n' : '·')).join('');

describe('twoColumn', () => {
  it('pads to exactly the column width', () => {
    const line = twoColumn('TOTAL', 'KES 1,500', 32);
    expect(line).toHaveLength(32);
    expect(line.startsWith('TOTAL')).toBe(true);
    expect(line.endsWith('KES 1,500')).toBe(true);
  });

  it('truncates a long left side instead of overflowing', () => {
    expect(twoColumn('A very long product name that cannot fit', 'KES 100', 32)).toHaveLength(32);
    expect(twoColumn('x'.repeat(40), 'y'.repeat(40), 32).length).toBeLessThanOrEqual(32);
  });
});

describe('wrapText', () => {
  it('wraps on spaces and hard-splits words longer than a line', () => {
    expect(wrapText('Office desk American Walnut', 16)).toEqual(['Office desk', 'American Walnut']);
    expect(wrapText('a'.repeat(40), 32)).toEqual(['a'.repeat(32), 'a'.repeat(8)]);
  });
});

describe('EscPosBuilder', () => {
  it('starts with the initialise command and replaces non-Latin text with ?', () => {
    const bytes = new EscPosBuilder().text('Café ✓').toBytes();
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(decode(bytes)).toContain('Caf?');
  });

  it('ends a receipt with a paper cut', () => {
    const bytes = buildReceiptEscPos({
      businessName: 'Furniture Homeland',
      phone: '0712345678',
      date: '15 Oct 2026',
      customerName: 'Irene',
      items: [{ name: 'Office desk', quantity: 2, unitPrice: 6500 }],
      total: 13000,
      columns: 32,
      formatMoney: n => `KES ${n}`,
    });
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
    const text = decode(bytes);
    expect(text).toContain('Office desk');
    expect(text).toContain('2 x KES 6500');
    expect(text).toContain('TOTAL');
  });
});
