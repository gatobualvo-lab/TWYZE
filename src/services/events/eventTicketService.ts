import { supabase } from '../../utils/supabase';

// A ticket tier IS a product: price = selling_price, capacity = current_stock, and it
// decrements exactly like any other inventory item when sold through the normal Sales
// flow (MultiProductSalesForm's Project/Event picker already attributes that sale here
// via sales.project_id) — no parallel ticketing system, just inventory scoped to an event.

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  /** Remaining stock — this IS the remaining capacity, same meaning as any other product. */
  remaining: number;
}

function mapRow(row: { id: string; product_name: string | null; selling_price: number | null; current_stock: number | null }): TicketTier {
  return {
    id: row.id,
    name: row.product_name ?? '',
    price: row.selling_price ?? 0,
    remaining: row.current_stock ?? 0,
  };
}

export async function listTicketTiers(projectId: string): Promise<TicketTier[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, product_name, selling_price, current_stock')
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
      category: 'Tickets',
    })
    .select('id, product_name, selling_price, current_stock')
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}
