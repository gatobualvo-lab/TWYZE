import { supabase } from '../../utils/supabase';
import type { ReceiptData } from './receiptService';

interface SaleRow {
  id: string;
  product_name: string | null;
  selling_price: number | null;
  date: string | null;
  client_name: string | null;
  customer_phone: string | null;
  delivery_charge: number | null;
}

interface SaleItemRow {
  product_name: string | null;
  quantity: number | null;
  selling_price: number | null;
  unit_price: number | null;
}

/**
 * Builds a receipt from a sale that is already recorded. Uses the sale's own
 * line items; sales saved before line items existed fall back to a single
 * line for the whole amount so a receipt can still be produced.
 */
export async function loadSaleReceipt(saleId: string): Promise<ReceiptData> {
  const { data: sale, error } = await supabase
    .from('sales')
    .select('id, product_name, selling_price, date, client_name, customer_phone, delivery_charge')
    .eq('id', saleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sale) throw new Error('That sale could not be found');

  const { data: itemRows, error: itemsError } = await supabase
    .from('sale_items')
    .select('product_name, quantity, selling_price, unit_price')
    .eq('sale_id', saleId)
    .eq('is_deleted', false)
    .order('created_at');
  if (itemsError) throw new Error(itemsError.message);

  return buildReceiptFromSale(sale as SaleRow, (itemRows ?? []) as SaleItemRow[]);
}

export function buildReceiptFromSale(sale: SaleRow, itemRows: SaleItemRow[]): ReceiptData {
  const total = Number(sale.selling_price ?? 0);

  const items = itemRows
    .filter(row => (row.product_name ?? '').trim() !== '')
    .map(row => ({
      productName: row.product_name as string,
      quantity: Number(row.quantity ?? 1) || 1,
      sellingPrice: Number(row.selling_price ?? row.unit_price ?? 0),
    }));

  // Delivery billed to the customer is part of the sale total but not a line
  // item, so show it as its own line rather than letting the receipt not add up.
  const itemsTotal = items.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const deliveryCharge = Number(sale.delivery_charge ?? 0);
  if (items.length > 0 && deliveryCharge > 0 && Math.abs(itemsTotal + deliveryCharge - total) < 0.01) {
    items.push({ productName: 'Delivery', quantity: 1, sellingPrice: deliveryCharge });
  }

  if (items.length === 0) {
    items.push({ productName: sale.product_name || 'Sale', quantity: 1, sellingPrice: total });
  }

  return {
    items,
    total,
    customerName: sale.client_name || undefined,
    customerPhone: sale.customer_phone || undefined,
    date: (sale.date || new Date().toISOString()).slice(0, 10),
  };
}
