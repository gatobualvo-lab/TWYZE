import { describe, it, expect } from 'vitest';
import { buildSupportUrl, SUPPORT_WHATSAPP_URL } from './supportLink';

const messageOf = (url: string) => decodeURIComponent(url.split('?text=')[1]);

describe('buildSupportUrl', () => {
  it('opens the team chat with the person, plan, page and question already written', () => {
    const url = buildSupportUrl({ email: 'wanjiku@example.com', plan: 'Business', page: 'Invoices', question: 'I paid but my plan did not change' });
    expect(url.startsWith(`${SUPPORT_WHATSAPP_URL}?text=`)).toBe(true);
    expect(messageOf(url)).toBe(
      'Hi TrackWyze team, I need help.\nEmail: wanjiku@example.com\nPlan: Business\nPage: Invoices\nMy question: I paid but my plan did not change'
    );
  });

  it('is just a greeting when nothing is known', () => {
    expect(messageOf(buildSupportUrl())).toBe('Hi TrackWyze team, I need help.');
    expect(messageOf(buildSupportUrl({ email: '  ', question: null }))).toBe('Hi TrackWyze team, I need help.');
  });

  it('keeps special characters and line breaks safe in the link', () => {
    const url = buildSupportUrl({ question: 'Why "50% & more"?\n\nHelp #1' });
    expect(url).not.toMatch(/[\s"&#]/);
    expect(messageOf(url)).toContain('My question: Why "50% & more"? Help #1');
  });

  it('cuts a very long question so the link stays usable', () => {
    const question = messageOf(buildSupportUrl({ question: 'x'.repeat(2000) })).split('My question: ')[1];
    expect(question).toHaveLength(300);
  });
});
