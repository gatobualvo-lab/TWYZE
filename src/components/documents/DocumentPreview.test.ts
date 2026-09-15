import { describe, it, expect } from 'vitest';
import { escapeHtml } from './DocumentPreview';

// Regression coverage for the XSS fix: generatePrintHTML() interpolates
// business/customer/document text straight into an HTML string handed to
// document.write(). Every one of those fields must round-trip through
// escapeHtml() as plain, inert text.
describe('escapeHtml', () => {
  it('neutralizes a script tag so it renders as text, not markup', () => {
    const input = '<script>alert(1)</script>';
    const escaped = escapeHtml(input);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes quotes so attribute-breakout injection is not possible', () => {
    expect(escapeHtml(`"><img src=x onerror=alert(1)>`)).toBe(
      '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'
    );
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Jane Doe, 123 Main St')).toBe('Jane Doe, 123 Main St');
  });

  it('treats null/undefined as an empty string rather than the literal word', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-string values to text', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
