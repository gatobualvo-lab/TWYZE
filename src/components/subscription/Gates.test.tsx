import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const counts = vi.hoisted(() => ({ sales: 0, inventory_items: 0, customers: 0 }));

vi.mock('../../utils/supabase', () => {
  const builder = (table: keyof typeof counts) => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'gte', 'or', 'neq']) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ count: counts[table], error: null }).then(resolve);
    return chain;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: (table: keyof typeof counts) => builder(table),
    },
  };
});

import { EntitlementsProvider } from '../../contexts/EntitlementsContext';
import { LimitGate, LimitMeter, PlanBanner, TabGate } from './Gates';

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

const FREE = { subscription_status: 'expired' };
const FREE_MONTH = { subscription_status: 'trial', trial_end_date: inDays(20) };
const STARTER = { subscription_status: 'active', current_billing_cycle: 'starter', subscription_expiry: inDays(10) };
const BUSINESS = { subscription_status: 'active', current_billing_cycle: 'business', subscription_expiry: inDays(10) };

function renderWith(profile: Record<string, string>, ui: React.ReactNode, onNavigate = vi.fn()) {
  render(
    <EntitlementsProvider profile={profile} onNavigate={onNavigate} activeTab="dashboard">
      {ui}
    </EntitlementsProvider>
  );
  return onNavigate;
}

beforeEach(() => {
  counts.sales = 0;
  counts.inventory_items = 0;
  counts.customers = 0;
});

describe('TabGate', () => {
  it('explains what to upgrade to when the page is on a higher plan', async () => {
    const onNavigate = renderWith(FREE, <TabGate id="profit-analytics"><p>the analytics</p></TabGate>);
    expect(screen.queryByText('the analytics')).not.toBeInTheDocument();
    expect(screen.getByText('Profit analytics is on the Business plan')).toBeInTheDocument();
    expect(screen.getByText(/KES 1,000 a month/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Upgrade to Business' }));
    expect(onNavigate).toHaveBeenCalledWith('payment-management');
  });

  it('a Starter page asks for Starter, not Business', () => {
    renderWith(FREE, <TabGate id="daily-closing"><p>the report</p></TabGate>);
    expect(screen.getByText('Daily closing report is on the Starter plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade to Starter' })).toBeInTheDocument();
  });

  it('shows the page when the plan includes it', () => {
    renderWith(STARTER, <TabGate id="daily-closing"><p>the report</p></TabGate>);
    expect(screen.getByText('the report')).toBeInTheDocument();
  });

  it('Starter still does not include Business pages', () => {
    renderWith(STARTER, <TabGate id="advisor"><p>advisor</p></TabGate>);
    expect(screen.queryByText('advisor')).not.toBeInTheDocument();
  });

  it('the free month and Business include everything', () => {
    for (const profile of [FREE_MONTH, BUSINESS]) {
      const { unmount } = render(
        <EntitlementsProvider profile={profile} onNavigate={vi.fn()}>
          <TabGate id="profit-analytics"><p>analytics</p></TabGate>
        </EntitlementsProvider>
      );
      expect(screen.getByText('analytics')).toBeInTheDocument();
      unmount();
    }
  });

  it('pages every plan includes are never gated', () => {
    renderWith(FREE, <TabGate id="inventory"><p>inventory page</p></TabGate>);
    expect(screen.getByText('inventory page')).toBeInTheDocument();
  });
});

describe('LimitGate', () => {
  it('lets a Free account add a sale while it is under 40 this month', async () => {
    counts.sales = 12;
    renderWith(FREE, <LimitGate resource="sales"><p>sale form</p></LimitGate>);
    await waitFor(() => expect(screen.getByText('sale form')).toBeInTheDocument());
  });

  it('stops at 40 sales and explains, without touching what exists', async () => {
    counts.sales = 40;
    renderWith(FREE, <LimitGate resource="sales"><p>sale form</p></LimitGate>);
    await waitFor(() => expect(screen.getByText("You've reached the Free plan limit")).toBeInTheDocument());
    expect(screen.queryByText('sale form')).not.toBeInTheDocument();
    expect(screen.getByText(/up to 40 sales a month, and you have 40/)).toBeInTheDocument();
    expect(screen.getByText(/starts again on the 1st of next month/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade to Starter' })).toBeInTheDocument();
  });

  it('is never in the way on paid plans or in the free month, however much has been added', async () => {
    counts.sales = 5000;
    for (const profile of [STARTER, BUSINESS, FREE_MONTH]) {
      const { unmount } = render(
        <EntitlementsProvider profile={profile} onNavigate={vi.fn()}>
          <LimitGate resource="sales"><p>sale form</p></LimitGate>
        </EntitlementsProvider>
      );
      expect(screen.getByText('sale form')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('LimitMeter', () => {
  it('shows how much of the Free allowance is used', async () => {
    counts.inventory_items = 14;
    renderWith(FREE, <LimitMeter resource="products" />);
    await waitFor(() => expect(screen.getByText(/14 of 20 products used on the Free plan/)).toBeInTheDocument());
  });

  it('shows nothing on a paid plan', () => {
    renderWith(STARTER, <LimitMeter resource="products" />);
    expect(screen.queryByText(/used on the Free plan/)).not.toBeInTheDocument();
  });
});

describe('PlanBanner', () => {
  it('counts down the last days of the free month', () => {
    renderWith({ subscription_status: 'trial', trial_end_date: inDays(4) }, <PlanBanner onNavigate={vi.fn()} />);
    expect(screen.getByText(/ends in/)).toBeInTheDocument();
    expect(screen.getByText(/4 days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See plans' })).toBeInTheDocument();
  });

  it('is quiet early in the free month and on every plan afterwards', () => {
    for (const profile of [FREE_MONTH, FREE, STARTER, BUSINESS]) {
      const { container, unmount } = render(
        <EntitlementsProvider profile={profile} onNavigate={vi.fn()}>
          <PlanBanner onNavigate={vi.fn()} />
        </EntitlementsProvider>
      );
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('tells a suspended account why it cannot add things', () => {
    renderWith({ subscription_status: 'suspended' }, <PlanBanner onNavigate={vi.fn()} />);
    expect(screen.getByText(/has been suspended/)).toBeInTheDocument();
  });
});
