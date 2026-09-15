import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression coverage for the bug where VendorTransactions.tsx's own
// hand-rolled update wrote to `date`/`amount` instead of the real
// `occurred_on`/`amount_kes` columns and silently no-opped. Both
// ExpenseOverview.tsx and VendorTransactions.tsx now go through this
// module's updateVendorExpense() instead of writing their own — this test
// pins down the payload it sends so that bug can't come back unnoticed.

const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../../utils/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}));

vi.mock('../../utils/security', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  RATE_LIMIT_MESSAGE: 'Too many requests.',
}));

beforeEach(() => {
  vi.clearAllMocks();
  fromMock.mockReturnValue({ update: updateMock });
  updateMock.mockReturnValue({ eq: eqMock });
  eqMock.mockReturnValue({ select: selectMock });
  selectMock.mockReturnValue({ single: singleMock });
  singleMock.mockResolvedValue({
    data: { id: 'exp-1', occurred_on: '2026-08-01', amount_kes: 500, expense_type: 'Payment' },
    error: null,
  });
});

describe('updateVendorExpense', () => {
  it('writes to occurred_on/amount_kes, never date/amount', async () => {
    const { updateVendorExpense } = await import('./api');

    await updateVendorExpense('exp-1', {
      expenseType: 'Payment',
      amountKES: 500,
      dateString: '2026-08-01',
      notes: 'corrected amount',
    });

    expect(fromMock).toHaveBeenCalledWith('vendor_expenses');
    const payload = updateMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      occurred_on: '2026-08-01',
      amount_kes: 500,
      expense_type: 'Payment',
      notes: 'corrected amount',
    });
    expect(payload).not.toHaveProperty('date');
    expect(payload).not.toHaveProperty('amount');
    expect(eqMock).toHaveBeenCalledWith('id', 'exp-1');
  });

  it('converts DD/MM/YYYY dates to ISO before writing', async () => {
    const { updateVendorExpense } = await import('./api');

    await updateVendorExpense('exp-1', { dateString: '25/12/2026' });

    const payload = updateMock.mock.calls[0][0];
    expect(payload.occurred_on).toBe('2026-12-25');
  });
});
