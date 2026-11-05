import { supabase } from '../../utils/supabase';
import { isSafeImageUrl } from '../../utils/safeContent';

/**
 * The stored photo for each of these product names, read from Inventory. Matched by the exact name
 * (sale records carry the product name as it was when sold, which is the inventory name at the time).
 * A product with no photo, or an address that is not one of this app's own stored images, is left out —
 * the caller shows a plain icon for those instead.
 */
export async function fetchProductImages(names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names.map(n => n.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from('inventory_items')
    .select('product_name, image_url')
    .eq('is_deleted', false)
    .in('product_name', unique);
  if (error || !data) return map;

  for (const row of data) {
    if (!row.product_name || map.has(row.product_name) || !isSafeImageUrl(row.image_url)) continue;
    map.set(row.product_name, row.image_url as string);
  }
  return map;
}
