/*
  # Fix vendor_expenses.expense_type CHECK constraint

  ## Why
  Found while live-verifying the vendor-transactions net-owed calculation:
  the CHECK constraint from 20251008112402_create_vendor_expenses_table.sql
  only allows ('Payment', 'Refund', 'Adjustment', 'Other'), but
  src/features/vendor-expenses/api.ts's EXPENSE_TYPE_OPTIONS — documented
  there as "the single source of truth" that ExpenseOverview.tsx and
  VendorTransactions.tsx both render their dropdown from — offers
  ('Payment', 'Reimbursement', 'Advance', 'Commission', 'Bonus',
  'Transport', 'Materials', 'Other'). The DB constraint was never updated
  when that option set was introduced, so selecting Reimbursement/Advance/
  Commission/Bonus/Transport/Materials in "Add Expense" fails outright with
  a check-constraint violation — this is exactly the "vendor pays me back"
  expense type. 'Refund'/'Adjustment' are kept in the allowed list (rather
  than dropped) purely for backward compatibility with any existing rows;
  they're just no longer offered in the UI.
*/

ALTER TABLE public.vendor_expenses DROP CONSTRAINT IF EXISTS vendor_expenses_expense_type_check;

ALTER TABLE public.vendor_expenses ADD CONSTRAINT vendor_expenses_expense_type_check
  CHECK (expense_type IN (
    'Payment', 'Reimbursement', 'Advance', 'Commission', 'Bonus', 'Transport', 'Materials', 'Other',
    'Refund', 'Adjustment'
  ));
