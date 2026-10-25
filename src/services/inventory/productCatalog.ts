import { supabase } from '../../utils/supabase';

export interface CatalogExtras {
  item_type?: 'goods' | 'service';
  image_url?: string | null;
  is_active?: boolean;
}

/**
 * Keeps `user_products` (what the Add Sale picker reads) in step with the item
 * saved in inventory or services, so prices auto-fill on the next sale.
 */
export async function syncProductCatalog(
  userId: string,
  name: string,
  buyingPrice: number,
  sellingPrice: number,
  extras: CatalogExtras = {}
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  try {
    const { data: existing } = await supabase
      .from('user_products')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', trimmed)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_products')
        .update({
          buying_price: buyingPrice,
          price: sellingPrice,
          ...extras,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('user_products').insert({
        id: crypto.randomUUID(),
        user_id: userId,
        name: trimmed,
        price: sellingPrice,
        buying_price: buyingPrice,
        ...extras,
      });
    }
  } catch (err) {
    console.error('Failed to sync product catalog:', err);
  }
}
