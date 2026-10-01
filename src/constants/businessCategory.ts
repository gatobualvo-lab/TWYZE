export type BusinessCategory =
  | 'retail'
  | 'services'
  | 'food_beverage'
  | 'fashion_beauty'
  | 'construction_hardware'
  | 'agriculture'
  | 'other';

export const DEFAULT_CATEGORY: BusinessCategory = 'other';

export const BUSINESS_CATEGORIES: { value: BusinessCategory; label: string }[] = [
  { value: 'retail', label: 'Retail / Trading' },
  { value: 'services', label: 'Services (no physical goods)' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'fashion_beauty', label: 'Fashion & Beauty' },
  { value: 'construction_hardware', label: 'Construction & Hardware' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'other', label: 'Other' },
];

export type ReferralSource =
  | 'social_media'
  | 'whatsapp'
  | 'friend_referral'
  | 'search_engine'
  | 'radio_tv'
  | 'agent_representative'
  | 'other';

export const REFERRAL_SOURCES: { value: ReferralSource; label: string }[] = [
  { value: 'social_media', label: 'Facebook / Instagram / TikTok' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'friend_referral', label: 'A friend or colleague' },
  { value: 'search_engine', label: 'Google / online search' },
  { value: 'radio_tv', label: 'Radio or TV' },
  { value: 'agent_representative', label: 'A Trackwyze agent/representative' },
  { value: 'other', label: 'Other' },
];

export interface CategoryTerminology {
  /** Sidebar/nav group label for the sales section, e.g. "Sales" / "Jobs" / "Orders". */
  salesLabel: string;
  addSaleLabel: string;
  viewSalesLabel: string;
  /** Singular noun for a single transaction, e.g. "sale" / "job" / "order" — used in "3 jobs today" style copy. */
  saleNounSingular: string;
  customersLabel: string;
  inventoryLabel: string;
  /**
   * Priority order of top-level nav ids for this category — earlier ids are
   * shown first in the sidebar and given priority on the dashboard. Any nav
   * id not listed here keeps its original relative position at the end.
   */
  navOrder: string[];
}

const BASE_ORDER = [
  'dashboard', 'sales', 'inventory-group', 'money', 'customers-group',
  'documents', 'insights-group', 'settings-group',
];

export const CATEGORY_CONFIG: Record<BusinessCategory, CategoryTerminology> = {
  retail: {
    salesLabel: 'Sales', addSaleLabel: 'Add Sale', viewSalesLabel: 'View Sales',
    saleNounSingular: 'sale', customersLabel: 'Customers', inventoryLabel: 'Inventory',
    navOrder: BASE_ORDER,
  },
  services: {
    salesLabel: 'Jobs', addSaleLabel: 'Add Job', viewSalesLabel: 'View Jobs',
    saleNounSingular: 'job', customersLabel: 'Clients', inventoryLabel: 'Supplies',
    navOrder: ['dashboard', 'sales', 'customers-group', 'money', 'documents', 'insights-group', 'inventory-group', 'settings-group'],
  },
  food_beverage: {
    salesLabel: 'Orders', addSaleLabel: 'Add Order', viewSalesLabel: 'View Orders',
    saleNounSingular: 'order', customersLabel: 'Customers', inventoryLabel: 'Stock',
    navOrder: BASE_ORDER,
  },
  fashion_beauty: {
    salesLabel: 'Sales', addSaleLabel: 'Add Sale', viewSalesLabel: 'View Sales',
    saleNounSingular: 'sale', customersLabel: 'Customers', inventoryLabel: 'Stock',
    navOrder: ['dashboard', 'sales', 'inventory-group', 'customers-group', 'money', 'documents', 'insights-group', 'settings-group'],
  },
  construction_hardware: {
    salesLabel: 'Sales', addSaleLabel: 'Add Sale', viewSalesLabel: 'View Sales',
    saleNounSingular: 'sale', customersLabel: 'Clients', inventoryLabel: 'Materials',
    navOrder: BASE_ORDER,
  },
  agriculture: {
    salesLabel: 'Sales', addSaleLabel: 'Add Sale', viewSalesLabel: 'View Sales',
    saleNounSingular: 'sale', customersLabel: 'Buyers', inventoryLabel: 'Produce & Stock',
    navOrder: BASE_ORDER,
  },
  other: {
    salesLabel: 'Sales', addSaleLabel: 'Add Sale', viewSalesLabel: 'View Sales',
    saleNounSingular: 'sale', customersLabel: 'Customers', inventoryLabel: 'Inventory',
    navOrder: BASE_ORDER,
  },
};

export function getCategoryConfig(category: string | null | undefined): CategoryTerminology {
  return CATEGORY_CONFIG[category as BusinessCategory] ?? CATEGORY_CONFIG[DEFAULT_CATEGORY];
}
