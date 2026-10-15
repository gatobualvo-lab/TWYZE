import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPrintPrefs, setPrintPrefs, type PrintPrefs, type ReceiptPaper } from '../../services/printing/printPrefs';
import { canPrintDirectly, listPrinters, printHtml, type DesktopPrinter } from '../../services/printing/printHtml';

interface PrintingSettingsProps {
  isDark: boolean;
}

const PAPER_OPTIONS: Array<{ value: ReceiptPaper; label: string }> = [
  { value: 'standard', label: 'Standard paper (A4 / A5)' },
  { value: 'thermal80', label: 'Thermal receipt roll, 80mm' },
  { value: 'thermal58', label: 'Thermal receipt roll, 58mm' },
];

const TEST_PAGE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Test print</title>
<style>body{font-family:Segoe UI,Tahoma,sans-serif;padding:16px;color:#222}h1{font-size:16px;margin:0 0 6px}p{font-size:12px;margin:2px 0}</style></head>
<body><h1>Trackwyze test print</h1><p>If you can read this, your printer is connected.</p><p>${new Date().toLocaleString()}</p></body></html>`;

const PrintingSettings: React.FC<PrintingSettingsProps> = ({ isDark }) => {
  const [prefs, setPrefs] = useState<PrintPrefs>(getPrintPrefs());
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const direct = canPrintDirectly();

  useEffect(() => {
    if (direct) listPrinters().then(setPrinters);
  }, [direct]);

  const update = (patch: Partial<PrintPrefs>) => setPrefs(setPrintPrefs(patch));

  const fieldClass = `w-full px-3 py-2 border rounded-lg ${
    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;
  const mutedClass = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Printer className="w-5 h-5 text-blue-500" />
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Printing on this device</h3>
          <p className={`text-sm ${mutedClass}`}>These settings are saved on this phone or computer only.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Receipt paper</label>
          <select value={prefs.receiptPaper} onChange={(e) => update({ receiptPaper: e.target.value as ReceiptPaper })} className={fieldClass}>
            {PAPER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className={`text-xs mt-1 ${mutedClass}`}>Pick the roll size if you print receipts on a thermal receipt printer.</p>
        </div>

        {direct ? (
          <>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Printer</label>
              <select value={prefs.printerName} onChange={(e) => update({ printerName: e.target.value })} className={fieldClass}>
                <option value="">System default printer</option>
                {printers.map(p => <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? ' (default)' : ''}</option>)}
              </select>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={prefs.silent} onChange={(e) => update({ silent: e.target.checked })} className="mt-1 w-4 h-4" />
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Print straight to the printer
                <span className={`block text-xs ${mutedClass}`}>Skips the print window. Receipts and documents go directly to the printer above.</span>
              </span>
            </label>
          </>
        ) : (
          <p className={`text-sm rounded-lg p-3 ${isDark ? 'bg-slate-700 text-gray-300' : 'bg-blue-50 text-blue-900'}`}>
            In the browser, Print opens your device's print window where you choose the printer. The Trackwyze Windows desktop app can also print straight to a printer without that window.
          </p>
        )}

        <button
          type="button"
          onClick={() => printHtml(TEST_PAGE).catch(() => toast.error('Could not print'))}
          className="px-4 py-2 rounded-lg border border-blue-600 text-blue-600 text-sm font-medium hover:bg-blue-50"
        >
          Print a test page
        </button>
      </div>
    </div>
  );
};

export default PrintingSettings;
