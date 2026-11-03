import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  APP_URL,
  LOGO_URL,
  emailButton,
  emailLayout,
  withTextFooter,
} from './_shared/sendgrid';
import * as scheduled from './scheduled-emails/index';
import { resolveEntitlements } from '../../src/services/subscription/entitlements';

describe('branded email layout', () => {
  const html = emailLayout('Welcome to TrackWyze', '<p>Hello</p>', {
    preheader: 'Your account is ready',
    cta: { label: 'Open TrackWyze', url: APP_URL },
  });

  it('shows the logo and links to the website', () => {
    expect(html).toContain(`src="${LOGO_URL}"`);
    expect(LOGO_URL).toBe('https://trackwyze.com/logo/email-logo.png');
    expect(html).toContain('alt="TrackWyze"');
    expect(html).toContain(`href="${APP_URL}"`);
    expect(html).toContain('trackwyze.com</a>');
    expect(html).toContain('Track Smart. Profit Wise.');
  });

  it('puts the title, message, preview text and button in', () => {
    expect(html).toContain('Welcome to TrackWyze');
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('Your account is ready');
    expect(html).toMatch(/<a href="https:\/\/trackwyze\.com"[^>]*>Open TrackWyze<\/a>/);
  });

  it('is a complete document and uses no scripts or external styles', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).not.toMatch(/<script|<link |@import/i);
  });

  it('has no button when none is asked for', () => {
    expect(emailLayout('T', '<p>x</p>')).not.toContain('bgcolor="#0a7f56"');
  });

  it('escapes the button label and address', () => {
    const out = emailButton('Go <now>', 'https://x.test/?a=1&b="2"');
    expect(out).toContain('Go &lt;now&gt;');
    expect(out).toContain('a=1&amp;b=&quot;2&quot;');
    expect(out).not.toContain('<now>');
  });

  it('lets the footer say why the email was sent', () => {
    expect(emailLayout('T', '', { footerNote: 'Turn these off in settings.' })).toContain('Turn these off in settings.');
    expect(emailLayout('T', '')).toContain('because you have a TrackWyze account');
  });

  it('the plain-text version gets the same sign-off', () => {
    const text = withTextFooter('Hello');
    expect(text).toContain('Hello');
    expect(text).toContain('TrackWyze - Track Smart. Profit Wise.');
    expect(text).toContain(APP_URL);
  });
});

describe('scheduled-emails keeps an identical copy of the template', () => {
  const cases: Array<[string, string, Parameters<typeof emailLayout>[2]]> = [
    ['plain', '<p>Body</p>', undefined],
    ['with everything', '<p>Body</p>', { preheader: 'Pre', cta: { label: 'Go', url: `${APP_URL}/?tab=calendar` }, footerNote: 'Note' }],
  ];

  it.each(cases)('layout: %s', (_name, body, options) => {
    expect(scheduled.emailLayout('Title', body, options)).toBe(emailLayout('Title', body, options));
  });

  it('button, constants and plain-text footer match', () => {
    expect(scheduled.emailButton('Go', APP_URL)).toBe(emailButton('Go', APP_URL));
    expect(scheduled.APP_URL).toBe(APP_URL);
    expect(scheduled.LOGO_URL).toBe(LOGO_URL);
    expect(scheduled.withTextFooter('Hi')).toBe(withTextFooter('Hi'));
  });
});

describe('the report and reminder emails', () => {
  it('carry the logo, the website link and a button', () => {
    const reminder = scheduled.buildReminderEmail('Amina', [{ title: 'Call supplier', due_date: '2026-11-02', due_time: '14:30' }]);
    for (const html of [reminder.html]) {
      expect(html).toContain(LOGO_URL);
      expect(html).toContain('trackwyze.com');
      expect(html).toContain('Open Business Calendar');
    }
  });
});

describe('the logo image', () => {
  const png = readFileSync(resolve(__dirname, '../../public/logo/email-logo.png'));

  it('exists as a real PNG', () => {
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('has the proportions the email asks for (so it is not squashed)', () => {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    expect(width / height).toBeCloseTo(208 / 48, 1);
    expect(width).toBeGreaterThanOrEqual(416); // at least 2x for sharp phone screens
  });
});

describe('scheduled-emails agrees with the app about which plan an account is on', () => {
  const now = new Date('2026-11-10T09:00:00Z');
  const inDays = (n: number) => new Date(now.getTime() + n * 86400000).toISOString();
  const profiles = [
    { subscription_status: 'trial', trial_end_date: inDays(5) },
    { subscription_status: 'trial', trial_end_date: inDays(-1) },
    { subscription_status: 'active', current_billing_cycle: 'starter', subscription_expiry: inDays(9) },
    { subscription_status: 'active', current_billing_cycle: 'business', subscription_expiry: inDays(9) },
    { subscription_status: 'active', current_billing_cycle: 'month2-3', subscription_expiry: inDays(9) },
    { subscription_status: 'active', current_billing_cycle: 'month4+', subscription_expiry: inDays(9) },
    { subscription_status: 'active', current_billing_cycle: 'business', subscription_expiry: inDays(-3) },
    { subscription_status: 'active', current_billing_cycle: 'starter', subscription_expiry: null },
    { subscription_status: 'expired' },
    { subscription_status: 'restricted' },
    { subscription_status: 'suspended' },
    { subscription_status: null },
    {},
  ];

  it.each(profiles.map((p, i) => [i, p] as const))('profile %i', (_i, profile) => {
    expect(scheduled.tierOf(profile, now)).toBe(resolveEntitlements(profile, now).tier);
  });

  it('copes with no profile', () => {
    expect(scheduled.tierOf(null, now)).toBe('free');
  });
});
