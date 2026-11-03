import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { applyPageMeta, usePageMeta } from './pageMeta';

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

describe('applyPageMeta', () => {
  it('sets the title, description, address and sharing details', () => {
    applyPageMeta({ title: 'Help Center | Trackwyze', description: 'Answers about Trackwyze.', path: '/help' });
    expect(document.title).toBe('Help Center | Trackwyze');
    expect(meta('meta[name="description"]')).toBe('Answers about Trackwyze.');
    expect(meta('meta[property="og:title"]')).toBe('Help Center | Trackwyze');
    expect(meta('meta[property="og:url"]')).toBe('https://trackwyze.com/help');
    expect(meta('meta[name="twitter:description"]')).toBe('Answers about Trackwyze.');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://trackwyze.com/help');
  });

  it('updates the tags that are already there instead of adding more', () => {
    applyPageMeta({ title: 'A', description: 'one', path: '/a' });
    applyPageMeta({ title: 'B', description: 'two', path: '/b' });
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(meta('meta[name="description"]')).toBe('two');
  });

  it('adds structured data, and replaces it rather than stacking it', () => {
    applyPageMeta({ title: 'A', description: 'a', path: '/a', jsonLd: { '@type': 'FAQPage' } });
    applyPageMeta({ title: 'B', description: 'b', path: '/b', jsonLd: { '@type': 'Other' } });
    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].textContent!)).toEqual({ '@type': 'Other' });
  });
});

describe('usePageMeta', () => {
  it('applies the page details and removes its structured data when the page goes away', () => {
    const { unmount } = renderHook(() => usePageMeta({ title: 'Landing', description: 'Desc', path: '/landing', jsonLd: { '@type': 'FAQPage' } }));
    expect(document.title).toBe('Landing');
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    unmount();
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });
});
