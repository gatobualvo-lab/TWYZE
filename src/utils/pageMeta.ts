import { useEffect } from 'react';

export const SITE_URL = 'https://trackwyze.com';

export interface PageMeta {
  /** The browser tab and search result title. Keep it under about 60 characters. */
  title: string;
  /** The search result snippet. Keep it under about 155 characters. */
  description: string;
  /** The page's address on the site, e.g. "/help". */
  path: string;
  /** Extra structured data for search engines (for example the FAQ). */
  jsonLd?: Record<string, unknown>;
}

const JSON_LD_ID = 'page-json-ld';

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/** Sets the title, description, address and social-sharing details for the page being shown. */
export function applyPageMeta({ title, description, path, jsonLd }: PageMeta): void {
  const url = `${SITE_URL}${path === '/' ? '' : path}`;
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;

  document.getElementById(JSON_LD_ID)?.remove();
  if (jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}

/** Gives a public page its own title and description. The extra structured data is removed when leaving it. */
export function usePageMeta(meta: PageMeta): void {
  const { title, description, path } = meta;
  const jsonLd = meta.jsonLd ? JSON.stringify(meta.jsonLd) : undefined;
  useEffect(() => {
    applyPageMeta({ title, description, path, jsonLd: jsonLd ? JSON.parse(jsonLd) : undefined });
    return () => document.getElementById(JSON_LD_ID)?.remove();
  }, [title, description, path, jsonLd]);
}
