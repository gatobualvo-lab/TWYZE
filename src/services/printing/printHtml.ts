import toast from 'react-hot-toast';
import { getPrintPrefs } from './printPrefs';

export interface DesktopPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface DesktopBridge {
  isDesktop: true;
  printHtml?: (
    html: string,
    options: { silent: boolean; deviceName?: string }
  ) => Promise<{ success: boolean; reason?: string }>;
  listPrinters?: () => Promise<DesktopPrinter[]>;
}

declare global {
  interface Window {
    trackwyze?: DesktopBridge;
  }
}

export function canPrintDirectly(): boolean {
  return typeof window !== 'undefined' && typeof window.trackwyze?.printHtml === 'function';
}

export async function listPrinters(): Promise<DesktopPrinter[]> {
  const bridge = window.trackwyze;
  if (!bridge?.listPrinters) return [];
  try {
    return await bridge.listPrinters();
  } catch {
    return [];
  }
}

/**
 * Prints a full HTML document.
 * - Desktop app with "print straight to printer" on: goes to the chosen (or
 *   default) printer with no dialog.
 * - Everywhere else: opens the print view, whose dialog lets the user pick
 *   any printer (or "Save as PDF").
 */
/**
 * A printed page never needs to run a script, so none may: this policy is put in the page's head. Even if some
 * text were ever left unescaped, the browser would refuse to run it. (The print window is opened from the app,
 * so it shares the app's origin; this is the second lock behind escaping every value.)
 */
export const PRINT_PAGE_POLICY = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'">`;

export function withPrintPagePolicy(html: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, match => `${match}${PRINT_PAGE_POLICY}`);
  return `${PRINT_PAGE_POLICY}${html}`;
}

export async function printHtml(rawHtml: string): Promise<void> {
  const html = withPrintPagePolicy(rawHtml);
  const prefs = getPrintPrefs();
  const bridge = window.trackwyze;

  if (bridge?.printHtml && prefs.silent) {
    try {
      const result = await bridge.printHtml(html, {
        silent: true,
        deviceName: prefs.printerName || undefined,
      });
      if (result.success) toast.success('Sent to the printer');
      else toast.error(`Could not print${result.reason ? `: ${result.reason}` : ''}. Check the printer is on and connected.`);
    } catch {
      toast.error('Could not reach the printer');
    }
    return;
  }

  // No noopener/noreferrer: they make window.open() return null, which looks
  // exactly like a blocked popup. Safe here since we only write our own HTML.
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Could not open the print window. Check your popup blocker.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
}
