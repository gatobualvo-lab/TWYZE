// Print settings live on the device (localStorage), not the account: which
// printer and paper a shop uses depends on the machine in front of the till.

export type ReceiptPaper = 'standard' | 'thermal80' | 'thermal58';

export interface PrintPrefs {
  receiptPaper: ReceiptPaper;
  /** Desktop app only: print straight to the printer without the dialog. */
  silent: boolean;
  /** Desktop app only: empty means the system default printer. */
  printerName: string;
  /** Send receipts to a paired Bluetooth thermal printer instead of the print window. */
  bluetooth: boolean;
  /** Name of the last paired Bluetooth printer, for display. */
  bluetoothName: string;
}

const KEY = 'trackwyze_print_prefs';
const DEFAULTS: PrintPrefs = { receiptPaper: 'standard', silent: false, printerName: '', bluetooth: false, bluetoothName: '' };

export function getPrintPrefs(): PrintPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PrintPrefs>;
    return {
      receiptPaper: ['standard', 'thermal80', 'thermal58'].includes(parsed.receiptPaper as string)
        ? (parsed.receiptPaper as ReceiptPaper)
        : DEFAULTS.receiptPaper,
      silent: parsed.silent === true,
      printerName: typeof parsed.printerName === 'string' ? parsed.printerName : '',
      bluetooth: parsed.bluetooth === true,
      bluetoothName: typeof parsed.bluetoothName === 'string' ? parsed.bluetoothName : '',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setPrintPrefs(patch: Partial<PrintPrefs>): PrintPrefs {
  const next = { ...getPrintPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the setting simply won't persist.
  }
  return next;
}

/** Page rules and content width for a receipt on the chosen paper. */
export function receiptPaperCss(paper: ReceiptPaper): { page: string; containerWidth: string; baseFont: string } {
  switch (paper) {
    case 'thermal80':
      return { page: '@page { size: 80mm auto; margin: 2mm; }', containerWidth: '72mm', baseFont: '12px' };
    case 'thermal58':
      return { page: '@page { size: 58mm auto; margin: 1.5mm; }', containerWidth: '52mm', baseFont: '11px' };
    default:
      return { page: '', containerWidth: '380px', baseFont: '14px' };
  }
}
