import { describe, it, expect } from 'vitest';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  TITLE_MAX_LENGTH,
  contrastRatio,
  documentColors,
  documentTitle,
  ensureContrast,
  normalizeHex,
  readableOn,
  resolveDocumentStyle,
  styleToStored,
  tint,
} from './documentTheme';

describe('normalizeHex', () => {
  it('accepts 6 and 3 digit colours with or without #', () => {
    expect(normalizeHex('#0A7F56')).toBe('#0a7f56');
    expect(normalizeHex('0a7f56')).toBe('#0a7f56');
    expect(normalizeHex('#fa0')).toBe('#ffaa00');
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'red', '#12345', '#gggggg', null, undefined, 42, '#0a7f56; x']) {
      expect(normalizeHex(bad)).toBeNull();
    }
  });
});

describe('colour helpers', () => {
  it('picks white on dark colours and dark ink on light ones', () => {
    expect(readableOn('#1e3a5f')).toBe('#ffffff');
    expect(readableOn('#fde68a')).toBe('#0f1b2d');
  });

  it('every preset keeps readable text on top of it', () => {
    for (const { hex } of ACCENT_PRESETS) {
      expect(contrastRatio(hex, readableOn(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('darkens a pale brand colour until it can be read on white paper', () => {
    const fixed = ensureContrast('#fde68a', '#ffffff');
    expect(contrastRatio(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#0a7f56', '#ffffff')).toBe('#0a7f56');
  });

  it('lightens a dark brand colour for a dark background', () => {
    const fixed = ensureContrast('#1e3a5f', '#1f2937');
    expect(contrastRatio(fixed, '#1f2937')).toBeGreaterThanOrEqual(4.5);
  });

  it('tint moves towards white', () => {
    expect(tint('#000000', 1)).toBe('#ffffff');
    expect(tint('#336699', 0)).toBe('#336699');
  });
});

describe('resolveDocumentStyle', () => {
  it('gives sensible defaults when nothing is stored', () => {
    const s = resolveDocumentStyle(null);
    expect(s.accent).toBe(DEFAULT_ACCENT);
    expect(s).toMatchObject({ headerStyle: 'plain', tableStyle: 'solid', font: 'sans', paper: 'a4', showLogo: true, showSignature: true });
    expect(s.titles).toEqual({ invoice: '', quotation: '', receipt: '' });
  });

  it('takes its layout defaults from the chosen template', () => {
    expect(resolveDocumentStyle({ default_template: 'classic' })).toMatchObject({ font: 'serif', tableStyle: 'lines' });
    expect(resolveDocumentStyle({ default_template: 'corporate' }).headerStyle).toBe('band');
  });

  it('lets saved choices override the template', () => {
    const s = resolveDocumentStyle({ default_template: 'classic', document_style: { font: 'sans', accent: '#1d4ed8' } });
    expect(s.font).toBe('sans');
    expect(s.accent).toBe('#1d4ed8');
    expect(s.tableStyle).toBe('lines');
  });

  it('ignores invalid or hostile stored values', () => {
    const s = resolveDocumentStyle({
      default_template: 'nope',
      document_style: {
        accent: 'red; background:url(x)',
        headerStyle: 'weird',
        paper: 'a0',
        showLogo: 'yes',
        titles: { invoice: 42, quotation: '<b>x</b>' },
      },
    });
    expect(s.accent).toBe(DEFAULT_ACCENT);
    expect(s.headerStyle).toBe('plain');
    expect(s.paper).toBe('a4');
    expect(s.showLogo).toBe(true);
    expect(s.titles.invoice).toBe('');
    expect(s.titles.quotation).toBe('<b>x</b>'); // escaped later, where it is printed
  });

  it('survives non-object stored values', () => {
    for (const bad of ['text', 5, [], [1, 2]]) {
      expect(resolveDocumentStyle({ document_style: bad }).accent).toBe(DEFAULT_ACCENT);
    }
  });

  it('cleans and limits custom titles', () => {
    const long = 'A'.repeat(80);
    const s = resolveDocumentStyle({ document_style: { titles: { invoice: `  TAX\n\tINVOICE  `, receipt: long } } });
    expect(s.titles.invoice).toBe('TAX INVOICE');
    expect(s.titles.receipt).toHaveLength(TITLE_MAX_LENGTH);
  });
});

describe('documentTitle', () => {
  it('uses the custom wording or the default word', () => {
    const s = resolveDocumentStyle({ document_style: { titles: { invoice: 'Tax Invoice' } } });
    expect(documentTitle(s, 'invoice')).toBe('Tax Invoice');
    expect(documentTitle(s, 'quotation')).toBe('QUOTATION');
  });
});

describe('styleToStored', () => {
  it('round-trips through resolveDocumentStyle', () => {
    const original = resolveDocumentStyle({
      default_template: 'minimal',
      document_style: { accent: '#6d28d9', headerStyle: 'band', font: 'serif', showSignature: false, titles: { receipt: 'Payment Receipt' } },
    });
    const stored = styleToStored(original, 'minimal');
    expect(resolveDocumentStyle({ default_template: 'minimal', document_style: stored })).toEqual(original);
  });

  it('leaves out values the template already provides', () => {
    const stored = styleToStored(resolveDocumentStyle({ default_template: 'classic' }), 'classic');
    expect(stored).toEqual({ accent: DEFAULT_ACCENT, paper: 'a4' });
  });
});

describe('documentColors', () => {
  it('derives text, wash and line colours from the accent', () => {
    const c = documentColors(resolveDocumentStyle({ document_style: { accent: '#fde68a' } }));
    expect(c.onAccent).toBe('#0f1b2d');
    expect(contrastRatio(c.accentText, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(c.wash).not.toBe(c.accent);
  });
});
