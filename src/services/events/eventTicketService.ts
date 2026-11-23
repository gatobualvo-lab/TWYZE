import { supabase } from '../../utils/supabase';

// A ticket tier IS a product: price = selling_price, capacity = current_stock.
// Selling tickets, though, stays entirely inside the Events tab — organizers
// sell via Eventbrite/M-Pesa till/door cash/agents, not through TrackWyze's
// own POS screen, so recordTicketSale() logs a batch (qty + price) directly
// against the tier via a dedicated RPC (see migration 20261122150000),
// instead of routing through the generic multi-product Sales form.

export const TICKET_TYPE_OPTIONS = ['VIP', 'Regular', 'Early Bird', 'Group', 'Student', 'Complimentary', 'Other'] as const;
export type TicketType = typeof TICKET_TYPE_OPTIONS[number];

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  tierType: string | null;
  /** Remaining stock — this IS the remaining capacity, same meaning as any other product. */
  remaining: number;
}

function mapRow(row: { id: string; product_name: string | null; selling_price: number | null; current_stock: number | null; category: string | null }): TicketTier {
  return {
    id: row.id,
    name: row.product_name ?? '',
    price: row.selling_price ?? 0,
    tierType: row.category ?? null,
    remaining: row.current_stock ?? 0,
  };
}

export async function listTicketTiers(projectId: string): Promise<TicketTier[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, product_name, selling_price, current_stock, category')
    .eq('project_id', projectId)
    .eq('is_deleted', false)
    .order('product_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface AddTicketTierInput {
  projectId: string;
  name: string;
  price: number;
  /** Total capacity — stored as current_stock, decrementing as tickets sell. */
  capacity: number;
  tierType?: string;
}

export async function addTicketTier(input: AddTicketTierInput): Promise<TicketTier> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to add a ticket tier.');

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      product_name: input.name,
      selling_price: input.price,
      cost_price: 0,
      current_stock: input.capacity,
      reorder_level: 0,
      project_id: input.projectId,
      category: input.tierType || 'Regular',
    })
    .select('id, product_name, selling_price, current_stock, category')
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export interface TicketSaleBatch {
  id: string;
  date: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface SaleWithItemsRow {
  id: string;
  sale_date: string | null;
  sale_items: { quantity: number | null; unit_price: number | null; subtotal: number | null }[] | null;
}

/** Every ticket sale batch recorded for this event, grouped by tier name. */
export async function listTicketSalesByTier(projectId: string): Promise<Record<string, TicketSaleBatch[]>> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, sale_date, product_name, sale_items(quantity, unit_price, subtotal)')
    .eq('project_id', projectId)
    .order('sale_date', { ascending: false });
  if (error) throw new Error(error.message);

  const byTier: Record<string, TicketSaleBatch[]> = {};
  for (const row of (data ?? []) as (SaleWithItemsRow & { product_name: string | null })[]) {
    const item = row.sale_items?.[0];
    if (!item) continue;
    const tierName = row.product_name ?? '';
    const batch: TicketSaleBatch = {
      id: row.id,
      date: row.sale_date ?? '',
      quantity: item.quantity ?? 0,
      unitPrice: item.unit_price ?? 0,
      subtotal: item.subtotal ?? 0,
    };
    (byTier[tierName] ??= []).push(batch);
  }
  return byTier;
}

export interface RecordTicketSaleInput {
  projectId: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
}

export async function recordTicketSale(input: RecordTicketSaleInput): Promise<void> {
  const { error } = await supabase.rpc('record_ticket_sale' as never, {
    p_project_id: input.projectId,
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
  } as never);
  if (error) throw new Error(error.message);
}
