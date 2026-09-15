import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const eqMock = vi.fn();
const upsertMock = vi.fn();
const updateMock = vi.fn();
const fromMock = vi.fn();
const selectAfterUpsertMock = vi.fn();

vi.mock('../../utils/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // select().order().limit().eq() chain for listNotifications
  const chain: any = {};
  chain.select = selectMock.mockReturnValue(chain);
  chain.order = orderMock.mockReturnValue(chain);
  chain.limit = limitMock.mockReturnValue(chain);
  chain.eq = eqMock.mockReturnValue(chain);
  chain.then = (resolve: any) => resolve({ data: [], error: null });
  // upsert().select('id') — a genuinely-new row comes back, a duplicate ignored via ON CONFLICT DO NOTHING comes back empty.
  selectAfterUpsertMock.mockResolvedValue({ data: [{ id: 'notif-1' }], error: null });
  chain.upsert = upsertMock.mockReturnValue({ select: selectAfterUpsertMock });
  chain.update = updateMock.mockReturnValue({ eq: eqMock.mockReturnValue({ eq: eqMock, then: (r: any) => r({ error: null }) }) });
  fromMock.mockReturnValue(chain);
});

describe('publishNotification', () => {
  it('upserts on the (user_id, dedupe_key) unique index, ignores duplicates, and reports a genuinely new row', async () => {
    const { publishNotification } = await import('./notificationService');

    const isNew = await publishNotification({
      type: 'low_stock',
      priority: 'high',
      title: 'Widget is running low',
      dedupeKey: 'low_stock:widget-1',
    });

    expect(fromMock).toHaveBeenCalledWith('notifications');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'low_stock',
        priority: 'high',
        dedupe_key: 'low_stock:widget-1',
      }),
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true }
    );
    expect(isNew).toBe(true);
  });

  it('reports false when the row already existed (conflict ignored, no row returned)', async () => {
    selectAfterUpsertMock.mockResolvedValue({ data: [], error: null });

    const { publishNotification } = await import('./notificationService');
    const isNew = await publishNotification({
      type: 'low_stock',
      priority: 'high',
      title: 'Widget is running low',
      dedupeKey: 'low_stock:widget-1',
    });

    expect(isNew).toBe(false);
  });

  it('does nothing when there is no logged-in user', async () => {
    const supabaseModule = await import('../../utils/supabase');
    (supabaseModule.supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: null } });

    const { publishNotification } = await import('./notificationService');
    const isNew = await publishNotification({ type: 'x', priority: 'low', title: 't', dedupeKey: 'k' });

    expect(upsertMock).not.toHaveBeenCalled();
    expect(isNew).toBe(false);
  });
});
