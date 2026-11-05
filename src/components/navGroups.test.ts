import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATEGORY_CONFIG } from '../constants/businessCategory';

// Reads the sidebar definition from the source (it is not exported) to check how the menu is grouped.
const source = readFileSync(resolve(__dirname, 'Dashboard.tsx'), 'utf8');
const nav = source.slice(source.indexOf('const NAV_ITEMS'), source.indexOf('const NAV_TITLES'));

function groupItems(groupId: string): string[] {
  const start = nav.indexOf(`id: '${groupId}'`);
  const end = nav.indexOf('],', start);
  return [...nav.slice(start, end).matchAll(/\{ id: '([a-z-]+)', label/g)].map(m => m[1]);
}

describe('sidebar groups', () => {
  it('keeps planning tools together in their own group, apart from Insights', () => {
    expect(groupItems('planner')).toEqual(['tasks', 'calendar', 'goals']);
    const insights = groupItems('insights-group');
    for (const id of ['tasks', 'calendar', 'goals', 'notifications']) expect(insights).not.toContain(id);
  });

  it('keeps the Notification Center with Settings', () => {
    expect(groupItems('settings-group')).toContain('notifications');
  });

  it('puts every group in each business type\'s menu order', () => {
    const groups = [...nav.matchAll(/kind: 'group', id: '([a-z-]+)'/g)].map(m => m[1]);
    for (const config of Object.values(CATEGORY_CONFIG)) {
      for (const id of groups) expect(config.navOrder, `"${id}" is missing from a menu order`).toContain(id);
    }
  });
});
