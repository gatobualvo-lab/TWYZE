import { describe, it, expect } from 'vitest';
import { documentPrintCss } from './documentPrintCss';
import { resolveDocumentStyle } from '../../utils/documentTheme';

const css = (document_style: Record<string, unknown> = {}, default_template = 'professional') =>
  documentPrintCss(resolveDocumentStyle({ default_template, document_style }));

describe('documentPrintCss', () => {
  it('uses the chosen brand colour instead of a fixed green', () => {
    const out = css({ accent: '#1d4ed8' });
    expect(out).toContain('#1d4ed8');
    expect(out).not.toContain('#086646');
    expect(out).not.toContain('#166534');
  });

  it('paints the table head solid, light or ruled', () => {
    expect(css({ tableStyle: 'solid', accent: '#1e3a5f' })).toMatch(/thead \{ background-color: #1e3a5f; color: #ffffff;/);
    expect(css({ tableStyle: 'light' })).toMatch(/thead \{ background-color: #[0-9a-f]{6}; color: #[0-9a-f]{6}; border-bottom/);
    expect(css({ tableStyle: 'lines' })).toMatch(/thead \{ background-color: transparent;/);
  });

  it('only stripes rows when the table is not ruled', () => {
    expect(css({ tableStyle: 'solid' })).toContain('nth-child(even)');
    expect(css({ tableStyle: 'lines' })).not.toContain('nth-child(even)');
  });

  it('makes a full-width band for the corporate header', () => {
    const out = css({}, 'corporate');
    expect(out).toContain('margin: calc(var(--pad) * -1)');
    expect(css({}, 'professional')).not.toContain('calc(var(--pad) * -1)');
  });

  it('applies the font and paper size', () => {
    const out = css({ font: 'serif', paper: 'letter' });
    expect(out).toContain('Georgia');
    expect(out).toContain('size: Letter');
    expect(css()).toContain('size: A4');
  });

  it('always asks the printer to keep background colours', () => {
    expect(css()).toContain('print-color-adjust: exact');
  });
});
