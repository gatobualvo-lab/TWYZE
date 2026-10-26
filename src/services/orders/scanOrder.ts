import { supabase } from '../../utils/supabase';
import { readErrorCode, toJpegBase64 } from '../receipts/scanReceipt';
import type { CatalogItem, ScannedOrder } from './orderToSale';

export class OrderScanError extends Error {}

/** Reads an order from a screenshot of the message, pasted text, or both. */
export async function scanOrder(input: { file?: File | null; text?: string }): Promise<ScannedOrder> {
  const text = input.text?.trim() ?? '';
  const file = input.file ?? null;
  if (!file && !text) throw new OrderScanError('Choose a screenshot or paste the message first');
  if (file && !file.type.startsWith('image/')) throw new OrderScanError('Please choose a screenshot (an image)');

  const body: { image?: string; mediaType?: string; text?: string } = {};
  if (file) {
    body.image = await toJpegBase64(file).catch(() => {
      throw new OrderScanError('That file could not be read as an image');
    });
    body.mediaType = 'image/jpeg';
  }
  if (text) body.text = text;

  const { data, error } = await supabase.functions.invoke('scan-order', { body });

  if (error) {
    // A function that isn't deployed yet fails at the network level (the
    // gateway's 404 carries no CORS headers), so it surfaces as a fetch error.
    if ((error as { name?: string }).name === 'FunctionsFetchError') {
      throw new OrderScanError(
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? "You're offline. Reading an order needs a connection"
          : 'Order scanning is not available yet'
      );
    }
    const { status, code } = await readErrorCode(error);
    if (status === 404 || code === 'not_configured') throw new OrderScanError('Order scanning is not set up yet');
    if (code === 'rate_limited' || status === 429) throw new OrderScanError('Too many scans for now. Try again in a while');
    if (code === 'subscription_required') throw new OrderScanError('Order scanning needs an active plan or trial');
    if (code === 'text_too_long') throw new OrderScanError('That message is too long. Paste just the order');
    throw new OrderScanError('Could not read the order. Please try again');
  }
  return data as ScannedOrder;
}

/** The user's goods and (active) services, for matching names from a message and reading their buying prices. */
export async function loadCatalogForMatching(): Promise<CatalogItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('inventory_items')
    .select('product_name, cost_price, selling_price, item_type, colors, is_active')
    .eq('user_id', user.id)
    .eq('is_deleted', false);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter(row => (row.product_name ?? '').trim() !== '' && row.is_active !== false)
    .map(row => ({
      name: (row.product_name as string).trim(),
      costPrice: Number(row.cost_price ?? 0),
      sellingPrice: Number(row.selling_price ?? 0),
      itemType: row.item_type === 'service' ? ('service' as const) : ('goods' as const),
      colors: Array.isArray(row.colors) ? row.colors : [],
    }));
}
