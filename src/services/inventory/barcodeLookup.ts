import { supabase } from '../../utils/supabase';

export interface ScannedProduct {
  name: string;
  costPrice: number;
  sellingPrice: number;
  colors: string[];
  inStock: number;
}

/**
 * Finds one of the user's goods by what a scanner reads: the barcode, or the
 * SKU as a fallback for shops that print their own SKU labels. Services are
 * never matched (they have no barcode and no stock).
 */
export async function findProductByCode(code: string): Promise<ScannedProduct | null> {
  const value = code.trim();
  if (!value) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // A barcode wins over a SKU that happens to look the same.
  for (const column of ['barcode', 'sku'] as const) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('product_name, cost_price, selling_price, colors, current_stock')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .neq('item_type', 'service')
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.product_name) {
      return {
        name: data.product_name,
        costPrice: Number(data.cost_price ?? 0),
        sellingPrice: Number(data.selling_price ?? 0),
        colors: Array.isArray(data.colors) ? data.colors : [],
        inStock: Number(data.current_stock ?? 0),
      };
    }
  }
  return null;
}

interface SaleLineLike {
  id: string;
  product: string;
  quantity: number;
  buyingPrice: number;
  sellingPrice: number;
  itemType: 'goods' | 'service';
  availableColors?: string[];
}

/**
 * Adds a scanned product to the sale's lines: scanning the same item again
 * bumps its quantity, and the first empty line is filled before a new one is
 * appended, so a cashier scanning a basket never has to touch the screen.
 */
export function addScannedProduct<T extends SaleLineLike>(lines: T[], scanned: ScannedProduct, blank: () => T): T[] {
  const sameIndex = lines.findIndex(l => l.itemType !== 'service' && l.product.trim().toLowerCase() === scanned.name.toLowerCase());
  if (sameIndex >= 0) {
    return lines.map((l, i) => (i === sameIndex ? { ...l, quantity: l.quantity + 1 } : l));
  }

  const fill = (line: T): T => ({
    ...line,
    product: scanned.name,
    quantity: 1,
    buyingPrice: scanned.costPrice,
    sellingPrice: scanned.sellingPrice,
    itemType: 'goods',
    availableColors: scanned.colors,
  });

  const emptyIndex = lines.findIndex(l => l.product.trim() === '');
  if (emptyIndex >= 0) return lines.map((l, i) => (i === emptyIndex ? fill(l) : l));
  return [...lines, fill(blank())];
}
