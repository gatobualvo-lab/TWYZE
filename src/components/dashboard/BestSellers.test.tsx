import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProductProfit } from '../../services/metrics/metricsService';

const mocks = vi.hoisted(() => ({ loadProfitByProduct: vi.fn(), fetchProductImages: vi.fn() }));
vi.mock('../../services/metrics/MetricsProvider', () => ({ useMetricsContext: () => ({ loadProfitByProduct: mocks.loadProfitByProduct }) }));
vi.mock('../../services/inventory/productImages', () => ({ fetchProductImages: mocks.fetchProductImages }));

import BestSellers from './BestSellers';

const row = (productName: string, revenue: number, unitsSold = 3): ProductProfit => ({ productName, unitsSold, revenue, cost: 0, profit: revenue, marginPct: null, transactionCount: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchProductImages.mockResolvedValue(new Map());
});

describe('BestSellers', () => {
  it('shows nothing while there are no sales to rank', async () => {
    mocks.loadProfitByProduct.mockResolvedValue([]);
    const { container } = render(<BestSellers onOpen={vi.fn()} />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it('ranks products with a badge, units sold, and a bar sized to the leader', async () => {
    mocks.loadProfitByProduct.mockResolvedValue([row('Rice 5kg', 2000, 5), row('Sugar 2kg', 1000, 2)]);
    render(<BestSellers onOpen={vi.fn()} />);
    expect(await screen.findByText('Rice 5kg')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // rank badge
    expect(screen.getByText('5 sold')).toBeInTheDocument();
    expect(screen.getByText('2 sold')).toBeInTheDocument();
  });

  it('shows a product photo when one is on file, and a plain icon (not a photo) otherwise', async () => {
    mocks.loadProfitByProduct.mockResolvedValue([row('Rice 5kg', 2000), row('Sugar 2kg', 1000)]);
    mocks.fetchProductImages.mockResolvedValue(new Map([['Rice 5kg', 'https://placeholder.supabase.co/storage/v1/object/public/product-images/a/rice.png']]));
    const { container } = render(<BestSellers onOpen={vi.fn()} />);
    await screen.findByText('Rice 5kg');
    // The photo is decorative (alt=""), so it never gets a text name — found by tag, not role.
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(1));
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://placeholder.supabase.co/storage/v1/object/public/product-images/a/rice.png');
  });

  it('opens the full list', async () => {
    mocks.loadProfitByProduct.mockResolvedValue([row('Rice 5kg', 2000)]);
    const onOpen = vi.fn();
    render(<BestSellers onOpen={onOpen} />);
    await screen.findByText('Rice 5kg');
    await userEvent.click(screen.getByRole('button', { name: /All/ }));
    expect(onOpen).toHaveBeenCalled();
  });
});
