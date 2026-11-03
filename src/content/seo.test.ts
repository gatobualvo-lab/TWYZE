import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TIER_PRICES } from '../services/subscription/entitlements';
import { LANDING_FAQS, BUSINESS_TYPES, faqStructuredData } from './landingSeo';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const sitemap = readFileSync(resolve(__dirname, '../../public/sitemap.xml'), 'utf8');

function graph(): Array<Record<string, any>> {
  const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1];
  return JSON.parse(raw)['@graph'];
}

describe('index.html search details', () => {
  it('has a title and description of a good length', () => {
    const title = /<title>(.*?)<\/title>/.exec(html)![1];
    const description = /<meta name="description" content="(.*?)"/.exec(html)![1];
    expect(title.length).toBeLessThanOrEqual(65);
    expect(title).toMatch(/Kenya/);
    expect(description.length).toBeGreaterThan(80);
    expect(description.length).toBeLessThanOrEqual(165);
  });

  it('lists the same prices as the app', () => {
    const app = graph().find(item => item['@type'] === 'SoftwareApplication')!;
    const prices = Object.fromEntries(app.offers.map((o: any) => [o.name.toLowerCase(), Number(o.price)]));
    expect(prices).toEqual(TIER_PRICES);
  });

  it('describes the business and the site for search engines', () => {
    const types = graph().map(item => item['@type']);
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication']));
  });

  it('mentions the same prices for people without scripts', () => {
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)![1];
    expect(noscript).toContain(`KES ${TIER_PRICES.starter}`);
    expect(noscript).toContain(`KES ${TIER_PRICES.business.toLocaleString('en-US')}`);
  });
});

describe('landing page content', () => {
  it('gives every FAQ a real question and answer, and the structured data matches them', () => {
    expect(LANDING_FAQS.length).toBeGreaterThanOrEqual(5);
    for (const faq of LANDING_FAQS) {
      expect(faq.question.endsWith('?')).toBe(true);
      expect(faq.answer.length).toBeGreaterThan(40);
    }
    const data = faqStructuredData();
    expect(data.mainEntity.map(q => q.name)).toEqual(LANDING_FAQS.map(f => f.question));
  });

  it('quotes the plan prices from the app', () => {
    const pricing = LANDING_FAQS.find(f => /cost/.test(f.question))!.answer;
    expect(pricing).toContain('KES 500');
    expect(pricing).toContain('KES 1,000');
  });

  it('covers the kinds of business it is for', () => {
    expect(BUSINESS_TYPES.length).toBeGreaterThanOrEqual(4);
  });
});

describe('sitemap', () => {
  it('lists the public pages the site wants found', () => {
    for (const path of ['/landing', '/login', '/help', '/terms', '/privacy', '/refund']) {
      expect(sitemap).toContain(`<loc>https://trackwyze.com${path}</loc>`);
    }
  });
});
