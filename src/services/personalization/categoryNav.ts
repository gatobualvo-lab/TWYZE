import { getCategoryConfig, type CategoryTerminology } from '../../constants/businessCategory';

interface NavLeafLike {
  id: string;
  label: string;
}
interface NavGroupLike {
  kind: 'group';
  id: string;
  label: string;
  items: NavLeafLike[];
}
type NavTopItemLike = ({ kind: 'leaf' } & NavLeafLike) | NavGroupLike;

const LABEL_OVERRIDE_KEY: Record<string, keyof CategoryTerminology> = {
  sales: 'salesLabel',
  'add-sale': 'addSaleLabel',
  'view-sales': 'viewSalesLabel',
  'customers-group': 'customersLabel',
  'inventory-group': 'inventoryLabel',
};

/**
 * Relabels sales/customers/inventory nav entries per the user's business
 * category and reorders top-level items by that category's priority.
 * Ids with no configured order keep their original relative position at
 * the end (stable sort) — new nav sections never need a CATEGORY_CONFIG
 * update to keep showing up.
 */
export function applyCategoryToNav<T extends NavTopItemLike>(navItems: T[], category: string | null | undefined): T[] {
  const config = getCategoryConfig(category);

  const relabeled = navItems.map(entry => {
    const overrideKey = LABEL_OVERRIDE_KEY[entry.id];
    const label = overrideKey ? config[overrideKey] : entry.label;
    if (entry.kind === 'group') {
      const items = entry.items.map(item => {
        const itemOverrideKey = LABEL_OVERRIDE_KEY[item.id];
        return itemOverrideKey ? { ...item, label: config[itemOverrideKey] } : item;
      });
      return { ...entry, label, items } as T;
    }
    return { ...entry, label } as T;
  });

  const orderIndex = new Map(config.navOrder.map((id, i) => [id, i]));
  return [...relabeled].sort((a, b) => {
    const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}
