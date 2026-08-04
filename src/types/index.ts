export interface Sale {
  id: string;
  productName: string;
  seller: string;
  buyingPrice: number;
  sellingPrice: number;
  deliveryGuy: string;
  deliveryFee: number;
  deliveryFeePaid: boolean;
  location: string;
  paymentStatus: 'Paid' | 'Unpaid';
  date: string;
  profit: number;
  createdAt: string;
  lastModified?: string;
  modifiedBy?: string;
  // Tax fields
  taxType?: 'none' | 'vat' | 'turnover';
  vatAmount?: number;
  turnoverTaxAmount?: number;
  // Soft delete fields
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export const DELIVERY_GUYS = [
  'Mwai',
  'Deno', 
  'Peter',
  'Titus',
  'Haron',
  'Evans',
  'Kim',
  'Chris pickup',
  'Mutua',
  'Isaac'
] as const;

type DeliveryGuy = typeof DELIVERY_GUYS[number];

interface FilterOptions {
  startDate: string;
  endDate: string;
  deliveryGuy: string;
  paymentStatus: string;
}

export interface PeriodStats {
  totalProfit: number;
  totalSales: number;
  averageProfit: number;
  paidOrders: number;
  unpaidOrders: number;
  totalVAT: number;
  totalTurnoverTax: number;
}

export interface DeliveryStats {
  [key: string]: {
    totalFees: number;
    orderCount: number;
    paidFees: number;
    unpaidFees: number;
  };
}

// Ad Expenses Types
export interface AdExpense {
  id: string;
  adType: AdType;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export const AD_TYPES = [
  'Facebook Ads',
  'Instagram Boost',
  'Google Ads',
  'Tiktok Ads',
  'Twitter Ads',
  'NGC Story Ad',
  'Jiji Ads',
  'Jumia Ads'
] as const;

type AdType = typeof AD_TYPES[number];

interface AdExpenseFilters {
  startDate: string;
  endDate: string;
  adType: string;
  searchTerm: string;
}

export interface MonthlyAdStats {
  totalSpent: number;
  totalPayments: number;
  adTypeBreakdown: { [key in AdType]?: number };
}

export interface MonthlyProfitSummary {
  salesProfit: number;
  adSpend: number;
  actualProfit: number;
  month: string;
  year: number;
}

// General Expenses Types
export interface GeneralExpense {
  id: string;
  expenseType: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
  lastModified?: string;
  modifiedBy?: string;
  isDeleted?: boolean;
}

const EXPENSE_TYPES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Internet',
  'Transport',
  'Packaging',
  'Office Supplies',
  'Maintenance',
  'Insurance',
  'Licenses',
  'Subscriptions',
  'Other'
] as const;

type ExpenseType = typeof EXPENSE_TYPES[number];

interface GeneralExpenseFilters {
  startDate: string;
  endDate: string;
  expenseType: string;
  searchTerm: string;
}

// Supplier Types
export interface Supplier {
  id: string;
  client: string;
  product: string;
  deliveryGuy: string;
  buyingPrice: number;
  sellingPrice: number;
  paymentStatus: 'Paid' | 'Not Paid';
  date: string;
  profit: number;
  createdAt: string;
  lastModified?: string;
  modifiedBy?: string;
  // Tax fields
  taxType?: 'none' | 'vat' | 'turnover';
  vatAmount?: number;
  turnoverTaxAmount?: number;
  // Soft delete fields
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface SupplierStats {
  totalOwed: number;
  totalPaid: number;
  totalProfit: number;
  totalExpenses: number;
  totalVAT: number;
  totalTurnoverTax: number;
  clientBreakdown: { [client: string]: { owed: number; paid: number; total: number; expenses: number; netOwed: number } };
}

// Supplier Expense Types
export interface SupplierExpense {
  id: string;
  supplierId: string;
  supplierName: string;
  expenseType: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
  lastModified?: string;
  modifiedBy?: string;
  isDeleted?: boolean;
}

// Recycle Bin Types
export interface RecycleBinItem {
  id: string;
  type: 'sale' | 'supplier';
  originalData: Sale | Supplier;
  deletedAt: string;
  deletedBy?: string;
  autoDeleteAt: string; // 30 days from deletion
}

// Audit Trail Types
export interface AuditLogEntry {
  id: string;
  recordId: string;
  recordType: 'sale' | 'supplier';
  action: 'create' | 'update' | 'delete';
  field?: string;
  oldValue?: any;
  newValue?: any;
  userId?: string;
  userEmail?: string;
  timestamp: string;
  description: string;
}

// Enhanced User Types with Free Trial Logic
export interface User {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber: string;
  password?: string;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
  lastPaymentDate?: string;
  subscriptionExpiry?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  currentBillingCycle: 'trial' | 'month2-3' | 'month4+';
  isAdmin?: boolean;
  role?: UserRole;
  teamId?: string;
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';

type SubscriptionStatus = 'Trial' | 'Pending Approval' | 'Active' | 'Inactive' | 'Expired';

export interface PaymentSubmission {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  amountPaid: number;
  paymentDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
  notes?: string;
  billingCycle: 'month2-3' | 'month4+';
}

interface SubscriptionPlan {
  name: string;
  price: number;
  duration: string;
  features: string[];
  isPromo?: boolean;
  cycle: 'trial' | 'month2-3' | 'month4+';
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    name: 'Free Trial',
    price: 0,
    duration: 'Month 1',
    features: [
      'Full access to all features',
      'Sales & supplier tracking',
      'Ad expenses management',
      'Monthly analytics & reports',
      'Mobile app access',
      'Data backup & sync'
    ],
    cycle: 'trial'
  },
  {
    name: 'Early Bird Special',
    price: 500,
    duration: 'Months 2-3',
    features: [
      'Full access to all features',
      'Sales & supplier tracking',
      'Ad expenses management',
      'Monthly analytics & reports',
      'Mobile app access',
      'Data backup & sync',
      'Priority support'
    ],
    isPromo: true,
    cycle: 'month2-3'
  },
  {
    name: 'Regular Monthly',
    price: 1000,
    duration: 'Month 4 onwards',
    features: [
      'Full access to all features',
      'Sales & supplier tracking',
      'Ad expenses management',
      'Monthly analytics & reports',
      'Mobile app access',
      'Data backup & sync',
      'Priority support',
      'Advanced analytics'
    ],
    cycle: 'month4+'
  }
];

// Tax calculation constants
const VAT_RATE = 0.16; // 16%
const TURNOVER_TAX_RATE = 0.015; // 1.5%

// Tax calculation utilities
const calculateVAT = (sellingPrice: number): number => {
  return sellingPrice * VAT_RATE;
};

const calculateTurnoverTax = (sellingPrice: number): number => {
  return sellingPrice * TURNOVER_TAX_RATE;
};

export const calculateTaxAmount = (sellingPrice: number, taxType: 'none' | 'vat' | 'turnover'): { vatAmount: number; turnoverTaxAmount: number } => {
  switch (taxType) {
    case 'vat':
      return { vatAmount: calculateVAT(sellingPrice), turnoverTaxAmount: 0 };
    case 'turnover':
      return { vatAmount: 0, turnoverTaxAmount: calculateTurnoverTax(sellingPrice) };
    default:
      return { vatAmount: 0, turnoverTaxAmount: 0 };
  }
};

// Inventory Types
export interface InventoryItem {
  id: string;
  productName: string;
  sku?: string;
  category?: string;
  currentStock: number;
  reorderLevel: number;
  costPrice: number;
  sellingPrice: number;
  unit?: string;
  description?: string;
  createdAt: string;
  lastModified?: string;
  modifiedBy?: string;
  isDeleted?: boolean;
}

export interface StockTransaction {
  id: string;
  inventoryItemId: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'return';
  quantity: number;
  date: string;
  relatedRecordId?: string; // ID of related sale or purchase
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

// Journal/Notes Types
export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  tags?: string[];
  isPinned?: boolean;
  createdAt: string;
  lastModified?: string;
  createdBy: string;
  modifiedBy?: string;
}

// Team Types
export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  lastModified?: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: UserRole;
  permissions: Permission[];
  invitedAt: string;
  joinedAt?: string;
  invitedBy: string;
  status: 'pending' | 'active' | 'inactive';
}

export type Permission = 
  | 'view_sales' 
  | 'add_sales' 
  | 'edit_sales' 
  | 'delete_sales'
  | 'view_suppliers'
  | 'add_suppliers'
  | 'edit_suppliers'
  | 'delete_suppliers'
  | 'view_inventory'
  | 'add_inventory'
  | 'edit_inventory'
  | 'delete_inventory'
  | 'view_expenses'
  | 'add_expenses'
  | 'edit_expenses'
  | 'delete_expenses'
  | 'view_journal'
  | 'add_journal'
  | 'edit_journal'
  | 'delete_journal'
  | 'view_reports'
  | 'manage_team';

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  token: string;
  expiresAt: string;
  invitedBy: string;
  invitedAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

// Activity Log Types
export interface ActivityLogEntry {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  resourceType: 'sale' | 'supplier' | 'inventory' | 'expense' | 'journal' | 'team' | 'user' | 'system';
  resourceId?: string;
  details?: string;
  timestamp: string;
  ipAddress?: string;
  deviceInfo?: string;
}