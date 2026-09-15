import type { PermissionSection } from './teamService';

// Which permission section gates each nav leaf. Anything not listed here
// (Opportunity Center, Advisor, Goals, Calendar, Notifications, Reports,
// Payments, Dropdown Management, Admin) is a cross-section or
// owner-only view and stays hidden from staff for this first version —
// safer than trying to partially render an aggregate report a staff
// member only has half the underlying data for.
export const SECTION_BY_NAV_ID: Partial<Record<string, PermissionSection>> = {
  'add-sale': 'sales',
  'view-sales': 'sales',
  'add-supplier': 'suppliers',
  'view-suppliers': 'suppliers',
  'ad-expenses': 'expenses',
  'general-expenses': 'expenses',
  'recurring-expenses': 'expenses',
  'expense-overview': 'expenses',
  inventory: 'inventory',
  'inventory-predictions': 'inventory',
  clients: 'customers',
  'customer-timeline': 'customers',
  'documents-quotations': 'documents',
  'documents-invoices': 'documents',
  'documents-receipts': 'documents',
  'documents-settings': 'documents',
  'recurring-invoices': 'documents',
  projects: 'documents',
};

const ALWAYS_VISIBLE_TO_STAFF = new Set(['dashboard']);

export function isNavIdVisible(id: string, permissions: PermissionSection[]): boolean {
  if (ALWAYS_VISIBLE_TO_STAFF.has(id)) return true;
  const section = SECTION_BY_NAV_ID[id];
  if (!section) return false;
  return permissions.includes(section);
}

interface NavLeafLike {
  id: string;
}
interface NavGroupLike {
  kind: 'group';
  items: NavLeafLike[];
}
type NavTopItemLike = ({ kind: 'leaf' } & NavLeafLike) | NavGroupLike;

/** Owners see the full, unfiltered nav (byte-for-byte the same experience as before team accounts existed). Staff see only sections they've been granted, and a group disappears entirely once none of its items are visible. */
export function filterNavForRole<T extends NavTopItemLike>(navItems: T[], isStaff: boolean, permissions: PermissionSection[]): T[] {
  if (!isStaff) return navItems;

  return navItems.reduce<T[]>((acc, entry) => {
    if (entry.kind === 'group') {
      const items = entry.items.filter(item => isNavIdVisible(item.id, permissions));
      if (items.length > 0) acc.push({ ...entry, items } as T);
    } else if (isNavIdVisible(entry.id, permissions)) {
      acc.push(entry);
    }
    return acc;
  }, []);
}
