import React, { useRef, useState } from 'react';
import { MessageCircle, Image as ImageIcon, ClipboardPaste, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadCatalogForMatching, OrderScanError, scanOrder } from '../../services/orders/scanOrder';
import { buildOrderDraft, type OrderDraft, type ScannedOrder } from '../../services/orders/orderToSale';

interface ScanOrderCardProps {
  /** Called with what was read and the sale lines worked out from it. The parent fills in the sale form. */
  onApply: (order: ScannedOrder, draft: OrderDraft) => void;
}

/**
 * "Scan a WhatsApp order": upload a screenshot of the message or paste its text.
 * Nothing is saved; the Add Sale form is filled in for the user to check.
 */
const ScanOrderCard: React.FC<ScanOrderCardProps> = ({ onApply }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [text, setText] = useState('');

  const run = async (input: { file?: File | null; text?: string }) => {
    setBusy(true);
    try {
      const [order, catalog] = await Promise.all([scanOrder(input), loadCatalogForMatching().catch(() => [])]);
      if (!order.isOrder) {
        toast.error('That does not look like an order. Try a clearer screenshot, or paste the text.');
        return;
      }
      onApply(order, buildOrderDraft(order, catalog));
      setShowPaste(false);
      setText('');
    } catch (error) {
      toast.error(error instanceof OrderScanError ? error.message : 'Could not read the order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border-2 border-dashed border-green-300 bg-green-50 ${busy ? 'opacity-70' : ''}`}>
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{busy ? 'Reading the order...' : 'Scan a WhatsApp order'}</p>
            <p className="text-xs text-gray-600">
              Upload a screenshot or paste the message. The sale fills itself in: products, buying prices from your inventory, and a single price is split across the products. You check it before saving.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
          >
            <ImageIcon className="w-4 h-4" /> Screenshot
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPaste(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-600 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-60"
          >
            <ClipboardPaste className="w-4 h-4" /> Paste text
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) run({ file });
            }}
          />
        </div>
      </div>

      {showPaste && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Paste the order message</h3>
              <button type="button" onClick={() => setShowPaste(false)} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              autoFocus
              placeholder={'e.g. Deliver to Jane 0712 345 678, Kilimani\n1 headrest office chair + 1 office desk\n15,000'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPaste(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={() => run({ text })}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
              >
                {busy ? 'Reading...' : 'Read order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScanOrderCard;
