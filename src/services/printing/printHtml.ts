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
export async function printHtml(html: string): Promise<void> {
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
