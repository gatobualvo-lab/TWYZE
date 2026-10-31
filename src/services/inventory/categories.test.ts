import { describe, it, expect } from 'vitest';
import { mergeCategories, resolveCategory } from './categories';

describe('mergeCategories', () => {
  it('drops blanks and nulls, trims, and sorts', () => {
    expect(mergeCategories(['Shoes', null, '  ', undefined, ' Clothing '])).toEqual(['Clothing', 'Shoes']);
  });

  it('treats different letter case as the same category and keeps the first spelling', () => {
    expect(mergeCategories(['Clothing', 'clothing', 'CLOTHING', 'Shoes'])).toEqual(['Clothing', 'Shoes']);
  });

  it('includes newly added names and the product\'s current value', () => {
    expect(mergeCategories(['Shoes'], ['Bags'], 'Hats')).toEqual(['Bags', 'Hats', 'Shoes']);
  });

  it('does not duplicate a current value that is already listed', () => {
    expect(mergeCategories(['Shoes'], [], 'shoes')).toEqual(['Shoes']);
  });

  it('collapses inner whitespace', () => {
    expect(mergeCategories(['Home   &  Garden'])).toEqual(['Home & Garden']);
  });
});

describe('resolveCategory', () => {
  it('reuses the existing spelling', () => {
    expect(resolveCategory('clothing', ['Clothing', 'Shoes'])).toBe('Clothing');
  });

  it('keeps a genuinely new name as typed (trimmed)', () => {
    expect(resolveCategory('  Hats ', ['Clothing'])).toBe('Hats');
  });

  it('empty stays empty', () => {
    expect(resolveCategory('   ', ['Clothing'])).toBe('');
  });
});
