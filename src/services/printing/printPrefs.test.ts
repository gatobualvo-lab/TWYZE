import { describe, it, expect, beforeEach } from 'vitest';
import { getPrintPrefs, setPrintPrefs, receiptPaperCss } from './printPrefs';

const KEY = 'trackwyze_print_prefs';

beforeEach(() => {
  localStorage.clear();
});

describe('print preferences', () => {
  it('defaults to standard paper, dialog printing, default printer', () => {
    expect(getPrintPrefs()).toEqual({ receiptPaper: 'standard', silent: false, printerName: '' });
  });

  it('persists changes and merges partial updates', () => {
    setPrintPrefs({ receiptPaper: 'thermal80' });
    setPrintPrefs({ silent: true, printerName: 'Front Desk' });
    expect(getPrintPrefs()).toEqual({ receiptPaper: 'thermal80', silent: true, printerName: 'Front Desk' });
  });

  it('survives corrupted storage', () => {
    localStorage.setItem(KEY, '{not json');
    expect(getPrintPrefs().receiptPaper).toBe('standard');
  });

  it('ignores an unknown paper value', () => {
    localStorage.setItem(KEY, JSON.stringify({ receiptPaper: 'huge', silent: 'yes' }));
    expect(getPrintPrefs()).toEqual({ receiptPaper: 'standard', silent: false, printerName: '' });
  });
});

describe('receiptPaperCss', () => {
  it('leaves standard paper without a page rule', () => {
    expect(receiptPaperCss('standard').page).toBe('');
  });

  it('sizes the page for 80mm and 58mm rolls', () => {
    expect(receiptPaperCss('thermal80').page).toContain('80mm');
    expect(receiptPaperCss('thermal58').page).toContain('58mm');
  });
});
