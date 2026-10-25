import React, { useEffect, useRef, useState } from 'react';
import { Receipt, Printer, Download, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadSaleReceipt } from '../services/receipts/saleReceipt';
import { downloadReceiptPdf, printReceipt, shareReceiptPdf } from '../services/receipts/receiptService';

interface ReceiptActionsProps {
  saleId: string;
  /** Icon-only trigger for tight rows. */
  compact?: boolean;
}

type Action = 'print' | 'share' | 'download';

/** "Receipt" button for an already-recorded sale: print it, send it as a PDF (WhatsApp), or download it. */
const ReceiptActions: React.FC<ReceiptActionsProps> = ({ saleId, compact = false }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const run = async (action: Action) => {
    setOpen(false);
    setBusy(true);
    try {
      const receipt = await loadSaleReceipt(saleId);
      if (action === 'print') await printReceipt(receipt);
      else if (action === 'share') await shareReceiptPdf(receipt);
      else await downloadReceiptPdf(receipt);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the receipt');
    } finally {
      setBusy(false);
    }
  };

  const item = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50';

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={busy}
        title="Receipt"
        aria-label="Receipt"
        className={`inline-flex items-center gap-1 rounded text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 ${compact ? 'p-1.5' : 'px-3 py-1 text-xs'}`}
      >
        <Receipt className="w-3.5 h-3.5" />
        {!compact && (busy ? 'Preparing...' : 'Receipt')}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-30 w-52 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <button type="button" className={item} onClick={() => run('print')}><Printer className="w-4 h-4" /> Print</button>
          <button type="button" className={item} onClick={() => run('share')}><MessageCircle className="w-4 h-4 text-green-600" /> Send PDF (WhatsApp)</button>
          <button type="button" className={item} onClick={() => run('download')}><Download className="w-4 h-4" /> Download PDF</button>
        </div>
      )}
    </div>
  );
};

export default ReceiptActions;
