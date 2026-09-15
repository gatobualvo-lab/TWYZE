import { describe, it, expect, vi, beforeEach } from 'vitest';

const projectsSelectMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === 'projects') {
    return { select: () => ({ order: () => projectsSelectMock() }) };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock('../../utils/supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args?: unknown) => rpcMock(fn, args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchProjectSummaries', () => {
  it('merges rollup totals onto each project and computes remainingBudget', async () => {
    projectsSelectMock.mockResolvedValue({
      data: [{ id: 'p1', name: 'Kitchen Remodel', client_name: 'Acme', budget: 100000, status: 'active', notes: null, created_at: '2026-01-01' }],
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: [{ project_id: 'p1', invoiced_total: 60000, spent_total: 40000 }],
      error: null,
    });

    const { fetchProjectSummaries } = await import('./projectRollupService');
    const result = await fetchProjectSummaries();

    expect(result).toEqual([{
      id: 'p1', name: 'Kitchen Remodel', clientName: 'Acme', budget: 100000, status: 'active', notes: null, createdAt: '2026-01-01',
      invoicedTotal: 60000, spentTotal: 40000, remainingBudget: 60000,
    }]);
  });

  it('defaults invoiced/spent to 0 for a project the rollup RPC has no row for yet', async () => {
    projectsSelectMock.mockResolvedValue({
      data: [{ id: 'p2', name: 'New Project', client_name: null, budget: null, status: 'active', notes: null, created_at: '2026-02-01' }],
      error: null,
    });
    rpcMock.mockResolvedValue({ data: [], error: null });

    const { fetchProjectSummaries } = await import('./projectRollupService');
    const result = await fetchProjectSummaries();

    expect(result[0].invoicedTotal).toBe(0);
    expect(result[0].spentTotal).toBe(0);
    // No budget set — "remaining" is meaningless, not just zero.
    expect(result[0].remainingBudget).toBeNull();
  });

  it('lets spent exceed budget, producing a negative remainingBudget (over budget)', async () => {
    projectsSelectMock.mockResolvedValue({
      data: [{ id: 'p3', name: 'Over Budget Job', client_name: null, budget: 10000, status: 'active', notes: null, created_at: '2026-03-01' }],
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: [{ project_id: 'p3', invoiced_total: 5000, spent_total: 15000 }],
      error: null,
    });

    const { fetchProjectSummaries } = await import('./projectRollupService');
    const result = await fetchProjectSummaries();

    expect(result[0].remainingBudget).toBe(-5000);
  });
});
