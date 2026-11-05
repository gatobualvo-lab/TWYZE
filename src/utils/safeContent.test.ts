import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { csvCell, escapeHtml, isSafeImageUrl, safeImageSrc } from './safeContent';
import { documentTitle, resolveDocumentStyle } from './documentTheme';

// The tests run with VITE_SUPABASE_URL set to this placeholder (see vitest.config.ts).
const STORAGE = 'https://placeholder.supabase.co/storage/v1/object/public';

describe('escapeHtml', () => {
  it('makes every special character inert, in text and inside quoted attributes', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
  });

  it('leaves ordinary text alone and treats nothing as empty', () => {
    expect(escapeHtml('Wanjiku & Sons Ltd')).toBe('Wanjiku &amp; Sons Ltd');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('isSafeImageUrl', () => {
  it('accepts a file in this project\'s public storage and a small inline PNG, JPEG or WebP', () => {
    expect(isSafeImageUrl(`${STORAGE}/business-assets/abc/logo-1.png`)).toBe(true);
    expect(isSafeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeImageUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
  });

  it('refuses anything else: other websites, scripts, SVG, odd protocols', () => {
    for (const url of [
      'https://evil.example.com/pixel.png',
      `https://placeholder.supabase.co.evil.com/storage/v1/object/public/x.png`,
      `http://placeholder.supabase.co/storage/v1/object/public/x.png`,
      'https://placeholder.supabase.co/rest/v1/profiles',
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:text/html;base64,PHNjcmlwdD48L3NjcmlwdD4=',
      'file:///etc/passwd',
      '//evil.example.com/x.png',
      '',
      null,
      undefined,
      42,
    ]) {
      expect(isSafeImageUrl(url), String(url)).toBe(false);
    }
  });

  it('gives an escaped attribute value, or nothing', () => {
    expect(safeImageSrc(`${STORAGE}/a/b.png?x=1&y=2`)).toBe(`${STORAGE}/a/b.png?x=1&amp;y=2`);
    expect(safeImageSrc('javascript:alert(1)')).toBe('');
  });
});

describe('csvCell', () => {
  it('quotes the value and doubles any quotes inside it', () => {
    expect(csvCell('Say "hello", friend')).toBe('"Say ""hello"", friend"');
    expect(csvCell(null)).toBe('""');
  });

  it('stops text that would run as a spreadsheet formula', () => {
    expect(csvCell('=HYPERLINK("http://evil","click")')).toBe('"\'=HYPERLINK(""http://evil"",""click"")"');
    expect(csvCell('+254700000000 call')).toBe('"\'+254700000000 call"');
    expect(csvCell('@SUM(A1:A9)')).toBe('"\'@SUM(A1:A9)"');
    expect(csvCell('-2+3 cmd')).toBe('"\'-2+3 cmd"');
    expect(csvCell('\t=1+1')).toBe('"\'\t=1+1"');
  });

  it('leaves real numbers, including negative ones, alone', () => {
    for (const value of ['-500', '-1,200.50', '+12', '3.5', '1e5', 1200, -3]) {
      expect(csvCell(value), String(value)).toBe(`"${value}"`);
    }
  });
});

describe('printed pages', () => {
  it('a custom document title is stored as typed, so the printed page must escape it', () => {
    const style = resolveDocumentStyle({ document_style: { titles: { invoice: '<img src=x onerror=alert(1)>' } } } as never);
    expect(documentTitle(style, 'invoice')).toContain('<img');

    const source = readFileSync(resolve(__dirname, '../components/documents/DocumentPreview.tsx'), 'utf8');
    expect(source).toMatch(/const docTypeLabel = escapeHtml\(documentTitle\(/);
  });

  it('no printed page puts an image address in the page without checking it first', () => {
    for (const file of ['../components/documents/DocumentPreview.tsx', '../components/payments/VendorStatement.tsx', '../services/receipts/receiptService.ts']) {
      const source = readFileSync(resolve(__dirname, file), 'utf8');
      expect(source, file).not.toMatch(/src="\$\{escapeHtml\(/);
    }
  });
});
