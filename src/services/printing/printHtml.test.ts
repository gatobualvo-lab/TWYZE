import { describe, it, expect } from 'vitest';
import { PRINT_PAGE_POLICY, withPrintPagePolicy } from './printHtml';

describe('printed page policy', () => {
  it('forbids scripts, plug-ins, frames, forms and a changed base address', () => {
    for (const rule of ["script-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'"]) {
      expect(PRINT_PAGE_POLICY).toContain(rule);
    }
  });

  it('goes first in the head of a page, before anything a person wrote could appear', () => {
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>INV-1</title></head><body>Hello</body></html>';
    const result = withPrintPagePolicy(html);
    expect(result.indexOf(PRINT_PAGE_POLICY)).toBe(result.indexOf('<head>') + '<head>'.length);
    expect(result).toContain('<title>INV-1</title>');
  });

  it('is added even when the page has no head, and keeps the page intact', () => {
    expect(withPrintPagePolicy('<p>Receipt</p>')).toBe(`${PRINT_PAGE_POLICY}<p>Receipt</p>`);
    expect(withPrintPagePolicy('<HEAD lang="en"><b>x</b>')).toContain(`<HEAD lang="en">${PRINT_PAGE_POLICY}`);
  });
});
