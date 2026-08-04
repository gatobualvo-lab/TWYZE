import React, { useRef } from 'react';
import { X, Printer, Share2, Download } from 'lucide-react';

interface ReceiptItem {
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  color?: string;
}

interface ReceiptData {
  saleId: string;
  date: string;
  clientName: string;
  customerPhone: string;
  items: ReceiptItem[];
  deliveryFee: number;
  clientDeliveryCharge: number;
  totalAmount: number;
  paymentMethod: string;
  location: string;
  deliveryGuy: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReceiptData;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, data }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Receipt - ${data.saleId.slice(0, 8)}</title>
      <style>
        body { font-family: 'Courier New', monospace; padding: 20px; max-width: 350px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 12px; }
        .header h1 { font-size: 18px; margin: 0; }
        .header p { font-size: 11px; margin: 4px 0; color: #555; }
        .info { font-size: 12px; margin-bottom: 12px; }
        .info p { margin: 3px 0; }
        .items { border-top: 1px dashed #333; border-bottom: 1px dashed #333; padding: 8px 0; margin: 8px 0; }
        .item { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
        .item-detail { font-size: 11px; color: #666; margin-left: 8px; }
        .totals { font-size: 13px; }
        .totals .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #333; padding-top: 6px; margin-top: 6px; }
        .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #666; border-top: 1px dashed #333; padding-top: 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <h1>TRACKWYZE</h1>
        <p>Track Smart. Profit Wise.</p>
        <p>Receipt #${data.saleId.slice(0, 8).toUpperCase()}</p>
      </div>
      <div class="info">
        <p><strong>Date:</strong> ${new Date(data.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        ${data.clientName ? `<p><strong>Client:</strong> ${data.clientName}</p>` : ''}
        ${data.customerPhone ? `<p><strong>Phone:</strong> ${data.customerPhone}</p>` : ''}
        ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
        <p><strong>Payment:</strong> ${data.paymentMethod}</p>
      </div>
      <div class="items">
        ${data.items.map(item => `
          <div class="item">
            <span>${item.product}${item.color ? ` (${item.color})` : ''}</span>
            <span>KES ${item.subtotal.toLocaleString()}</span>
          </div>
          <div class="item-detail">${item.quantity} x KES ${item.unitPrice.toLocaleString()}</div>
        `).join('')}
      </div>
      <div class="totals">
        <div class="row"><span>Subtotal:</span><span>KES ${data.items.reduce((s, i) => s + i.subtotal, 0).toLocaleString()}</span></div>
        ${data.clientDeliveryCharge > 0 ? `<div class="row"><span>Delivery Charge:</span><span>KES ${data.clientDeliveryCharge.toLocaleString()}</span></div>` : ''}
        <div class="row grand"><span>TOTAL:</span><span>KES ${data.totalAmount.toLocaleString()}</span></div>
      </div>
      <div class="footer">
        <p>Thank you for your business!</p>
        <p>Powered by Trackwyze</p>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleShareWhatsApp = () => {
    const lines = [
      `*RECEIPT - #${data.saleId.slice(0, 8).toUpperCase()}*`,
      `Date: ${new Date(data.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      data.clientName ? `Client: ${data.clientName}` : '',
      '',
      '*Items:*',
      ...data.items.map(item =>
        `${item.product}${item.color ? ` (${item.color})` : ''} - ${item.quantity}x KES ${item.unitPrice.toLocaleString()} = KES ${item.subtotal.toLocaleString()}`
      ),
      '',
      data.clientDeliveryCharge > 0 ? `Delivery: KES ${data.clientDeliveryCharge.toLocaleString()}` : '',
      `*TOTAL: KES ${data.totalAmount.toLocaleString()}*`,
      '',
      `Payment: ${data.paymentMethod}`,
      data.location ? `Location: ${data.location}` : '',
      '',
      '_Thank you for your business!_',
      '_Powered by Trackwyze_'
    ].filter(Boolean).join('\n');

    const phone = data.customerPhone?.replace(/\D/g, '') || '';
    const url = phone
      ? `https://wa.me/${phone.startsWith('0') ? '254' + phone.slice(1) : phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
  };

  const formatCurrency = (amount: number) =>
    `KES ${amount.toLocaleString()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Sale Receipt</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div ref={receiptRef} className="p-6">
          <div className="text-center mb-4 pb-4 border-b-2 border-dashed border-gray-300">
            <h3 className="text-xl font-bold text-gray-800">TRACKWYZE</h3>
            <p className="text-xs text-gray-500">Track Smart. Profit Wise.</p>
            <p className="text-sm text-gray-600 mt-1">Receipt #{data.saleId.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="text-sm space-y-1 mb-4">
            <p><span className="text-gray-500">Date:</span> {new Date(data.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            {data.clientName && <p><span className="text-gray-500">Client:</span> {data.clientName}</p>}
            {data.customerPhone && <p><span className="text-gray-500">Phone:</span> {data.customerPhone}</p>}
            {data.location && <p><span className="text-gray-500">Location:</span> {data.location}</p>}
            <p><span className="text-gray-500">Payment:</span> {data.paymentMethod}</p>
          </div>

          <div className="border-t border-dashed border-gray-300 py-3 space-y-2">
            {data.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-800">{item.product}{item.color ? ` (${item.color})` : ''}</p>
                  <p className="text-xs text-gray-500">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
                </div>
                <p className="font-medium text-gray-800">{formatCurrency(item.subtotal)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3 mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(data.items.reduce((s, i) => s + i.subtotal, 0))}</span>
            </div>
            {data.clientDeliveryCharge > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Charge</span>
                <span>{formatCurrency(data.clientDeliveryCharge)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>TOTAL</span>
              <span>{formatCurrency(data.totalAmount)}</span>
            </div>
          </div>

          <div className="text-center mt-4 pt-4 border-t border-dashed border-gray-300">
            <p className="text-sm text-gray-500">Thank you for your business!</p>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
