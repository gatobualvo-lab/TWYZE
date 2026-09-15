import { describe, it, expect } from 'vitest';
import { filterNavForRole, isNavIdVisible } from './navPermissions';

const SAMPLE_NAV = [
  { kind: 'leaf' as const, id: 'dashboard' },
  { kind: 'leaf' as const, id: 'opportunities' },
  {
    kind: 'group' as const,
    id: 'sales',
    items: [
      { id: 'add-sale' },
      { id: 'view-sales' },
    ],
  },
  {
    kind: 'group' as const,
    id: 'expenses',
    items: [
      { id: 'ad-expenses' },
      { id: 'general-expenses' },
      { id: 'expense-overview' },
    ],
  },
];

describe('isNavIdVisible', () => {
  it('always shows dashboard regardless of permissions', () => {
    expect(isNavIdVisible('dashboard', [])).toBe(true);
  });

  it('hides a section-gated item with no matching permission', () => {
    expect(isNavIdVisible('view-sales', [])).toBe(false);
  });

  it('shows a section-gated item once the permission is granted', () => {
    expect(isNavIdVisible('view-sales', ['sales'])).toBe(true);
  });

  it('hides an unmapped item (e.g. cross-section reports) even with permissions', () => {
    expect(isNavIdVisible('opportunities', ['sales', 'suppliers', 'expenses', 'documents', 'customers', 'inventory'])).toBe(false);
  });

  it('gates projects on the documents permission (a project is fundamentally an invoicing wrapper)', () => {
    expect(isNavIdVisible('projects', [])).toBe(false);
    expect(isNavIdVisible('projects', ['documents'])).toBe(true);
  });
});

describe('filterNavForRole', () => {
  it('returns the nav completely unfiltered for an owner', () => {
    const result = filterNavForRole(SAMPLE_NAV, false, []);
    expect(result).toEqual(SAMPLE_NAV);
  });

  it('for staff with no permissions, keeps only dashboard', () => {
    const result = filterNavForRole(SAMPLE_NAV, true, []);
    expect(result).toEqual([{ kind: 'leaf', id: 'dashboard' }]);
  });

  it('drops a group entirely once none of its items are permitted', () => {
    const result = filterNavForRole(SAMPLE_NAV, true, ['inventory']);
    expect(result.some(e => 'id' in e && e.id === 'sales')).toBe(false);
    expect(result.some(e => 'id' in e && e.id === 'expenses')).toBe(false);
  });

  it('keeps a group but only its permitted items when partially granted', () => {
    const result = filterNavForRole(SAMPLE_NAV, true, ['expenses']);
    const expensesGroup = result.find(e => e.kind === 'group' && e.id === 'expenses');
    const items = expensesGroup && expensesGroup.kind === 'group' ? expensesGroup.items : [];
    expect(items.map(i => i.id)).toEqual(['ad-expenses', 'general-expenses', 'expense-overview']);
  });

  it('never shows opportunities/advisor/goals-style cross-section views to staff', () => {
    const result = filterNavForRole(SAMPLE_NAV, true, ['sales', 'suppliers', 'expenses', 'documents', 'customers', 'inventory']);
    expect(result.some(e => 'id' in e && e.id === 'opportunities')).toBe(false);
  });
});
