import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProductImages } from './productImages';

const mocks = vi.hoisted(() => ({ in: vi.fn() }));
vi.mock('../../utils/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ in: mocks.in }) }) }) },
}));

beforeEach(() => vi.clearAllMocks());

describe('fetchProductImages', () => {
  it('maps a photo to its exact product name, skipping products with none', async () => {
    mocks.in.mockResolvedValue({
      data: [
        { product_name: 'Sugar 2kg', image_url: 'https://placeholder.supabase.co/storage/v1/object/public/product-images/a/sugar.png' },
        { product_name: 'Rice 5kg', image_url: null },
      ],
      error: null,
    });
    const result = await fetchProductImages(['Sugar 2kg', 'Rice 5kg']);
    expect(result.get('Sugar 2kg')).toBe('https://placeholder.supabase.co/storage/v1/object/public/product-images/a/sugar.png');
    expect(result.has('Rice 5kg')).toBe(false);
  });

  it('drops an address that is not this app\'s own stored image', async () => {
    mocks.in.mockResolvedValue({ data: [{ product_name: 'Sugar 2kg', image_url: 'https://evil.example.com/x.png' }], error: null });
    const result = await fetchProductImages(['Sugar 2kg']);
    expect(result.has('Sugar 2kg')).toBe(false);
  });

  it('asks for nothing, and returns nothing, when there are no names', async () => {
    const result = await fetchProductImages([]);
    expect(result.size).toBe(0);
    expect(mocks.in).not.toHaveBeenCalled();
  });

  it('fails soft: a broken query gives an empty map rather than throwing', async () => {
    mocks.in.mockResolvedValue({ data: null, error: new Error('down') });
    await expect(fetchProductImages(['Sugar 2kg'])).resolves.toEqual(new Map());
  });
});
