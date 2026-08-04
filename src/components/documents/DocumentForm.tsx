'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { Plus, Trash2, Send, Save } from 'lucide-react';

interface DocumentItem {
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  total: number;
}

interface DocumentData {
  id?: string;
  document_type: 'quotation' | 'invoice' | 'receipt';
  document_number?: string;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'accepted' | 'rejected';
  date?: string;
  due_date?: string;
  expiry_date?: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  subtotal?: number;
  tax_amount?: number;
  delivery_charge?: number;
  discount_amount?: number;
  total?: number;
  amount_paid?: number;
  balance_due?: number;
  payment_method?: string;
  notes?: string;
  terms?: string;
  template?: string;
  related_document_id?: string;
  related_sale_id?: string;
}

interface DocumentFormProps {
  documentType: 'quotation' | 'invoice' | 'receipt';
  existingDocument?: DocumentData;
  existingDocumentId?: string;
  onSave: () => void;
  onCancel: () => void;
}

const safeNum = (v: any) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

export default function DocumentForm({
  documentType,
  existingDocument,
  existingDocumentId,
  onSave,
  onCancel,
}: DocumentFormProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<DocumentItem[]>(
    existingDocument ? [] : [{ product_name: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 0, total: 0 }]
  );

  // Form state
  const [customerName, setCustomerName] = useState(existingDocument?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(existingDocument?.customer_phone || '');
  const [customerEmail, setCustomerEmail] = useState(existingDocument?.customer_email || '');
  const [customerAddress, setCustomerAddress] = useState(existingDocument?.customer_address || '');

  const [documentDate, setDocumentDate] = useState(
    existingDocument?.date || new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(existingDocument?.due_date || '');
  const [expiryDate, setExpiryDate] = useState(existingDocument?.expiry_date || '');

  const [deliveryCharge, setDeliveryCharge] = useState(existingDocument?.delivery_charge || 0);
  const [discountAmount, setDiscountAmount] = useState(existingDocument?.discount_amount || 0);
  const [paymentMethod, setPaymentMethod] = useState(existingDocument?.payment_method || '');
  const [notes, setNotes] = useState(existingDocument?.notes || '');
  const [terms, setTerms] = useState(existingDocument?.terms || '');

  useEffect(() => {
    if (existingDocumentId && !existingDocument) {
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: doc } = await supabase
          .from('documents')
          .select('*')
          .eq('id', existingDocumentId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (doc) {
          setCustomerName(doc.customer_name || '');
          setCustomerPhone(doc.customer_phone || '');
          setCustomerEmail(doc.customer_email || '');
          setCustomerAddress(doc.customer_address || '');
          setDocumentDate(doc.date || new Date().toISOString().split('T')[0]);
          setDueDate(doc.due_date || '');
          setExpiryDate(doc.expiry_date || '');
          setDeliveryCharge(safeNum(doc.delivery_charge));
          setDiscountAmount(safeNum(doc.discount_amount));
          setPaymentMethod(doc.payment_method || '');
          setNotes(doc.notes || '');
          setTerms(doc.terms || '');
        }
        const { data: docItems } = await supabase
          .from('document_items')
          .select('*')
          .eq('document_id', existingDocumentId)
          .order('sort_order');
        if (docItems && docItems.length > 0) {
          setItems(docItems.map(i => ({
            product_name: i.product_name || '',
            description: i.description || '',
            quantity: safeNum(i.quantity),
            unit_price: safeNum(i.unit_price),
            discount_percent: safeNum(i.discount_percent),
            tax_percent: safeNum(i.tax_percent),
            total: safeNum(i.total),
          })));
        }
      })();
    }
  }, [existingDocumentId]);

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const unitPrice = safeNum(item.unit_price);
      const quantity = safeNum(item.quantity);
      const discountPercent = safeNum(item.discount_percent);
      const taxPercent = safeNum(item.tax_percent);

      const lineSubtotal = unitPrice * quantity;
      const discountAmount = lineSubtotal * (discountPercent / 100);
      const taxableAmount = lineSubtotal - discountAmount;
      const taxAmount = taxableAmount * (taxPercent / 100);

      subtotal += lineSubtotal;
      totalTax += taxAmount;
    });

    const total = subtotal - safeNum(discountAmount) + safeNum(deliveryCharge) + totalTax;

    return {
      subtotal,
      totalTax,
      total,
    };
  };

  const totals = calculateTotals();

  const updateItem = (index: number, field: keyof DocumentItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        product_name: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_percent: 0,
        total: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const generateDocumentNumber = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('generate_document_number', {
        p_document_type: documentType,
        p_user_id: userId,
      });

      if (error) {
        console.error('RPC generate_document_number error:', error);
        return null;
      }

      return data as string;
    } catch (error) {
      console.error('Error generating document number:', error);
      return null;
    }
  };

  const handleSave = async (status: 'draft' | 'sent') => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    if (items.length === 0 || items.every((item) => !item.product_name)) {
      toast.error('Please add at least one item');
      return;
    }

    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('User not authenticated');
        setIsLoading(false);
        return;
      }

      let documentNumber = existingDocument?.document_number;
      if (!documentNumber) {
        documentNumber = await generateDocumentNumber(user.id);
        if (!documentNumber) {
          const typeLabel = documentType === 'quotation' ? 'quotation' : documentType === 'invoice' ? 'invoice' : 'receipt';
          toast.error(`Could not assign a ${typeLabel} number. The document was not saved.`);
          setIsLoading(false);
          return;
        }
      }

      const documentData: any = {
        user_id: user.id,
        document_type: documentType,
        document_number: documentNumber,
        status,
        date: documentDate,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_address: customerAddress,
        subtotal: totals.subtotal,
        tax_amount: totals.totalTax,
        delivery_charge: safeNum(deliveryCharge),
        discount_amount: safeNum(discountAmount),
        total: totals.total,
        amount_paid: existingDocument?.amount_paid || 0,
        balance_due: totals.total - (existingDocument?.amount_paid || 0),
        payment_method: paymentMethod,
        notes,
        terms,
      };

      if (documentType === 'invoice' || documentType === 'quotation') {
        documentData.due_date = dueDate;
      }
      if (documentType === 'quotation') {
        documentData.expiry_date = expiryDate;
      }

      let documentId = existingDocument?.id;

      if (existingDocument?.id) {
        // Update existing document
        const { error } = await supabase
          .from('documents')
          .update(documentData)
          .eq('id', existingDocument.id);

        if (error) throw error;

        // Delete old items
        await supabase.from('document_items').delete().eq('document_id', existingDocument.id);
      } else {
        // Insert new document
        const { data: newDoc, error } = await supabase
          .from('documents')
          .insert([documentData])
          .select()
          .single();

        if (error) throw error;
        documentId = newDoc.id;
      }

      // Insert line items
      const itemsToInsert = items
        .filter((item) => item.product_name.trim())
        .map((item, index) => {
          const unitPrice = safeNum(item.unit_price);
          const quantity = safeNum(item.quantity);
          const discountPercent = safeNum(item.discount_percent);
          const taxPercent = safeNum(item.tax_percent);

          const lineSubtotal = unitPrice * quantity;
          const discountAmount = lineSubtotal * (discountPercent / 100);
          const taxableAmount = lineSubtotal - discountAmount;
          const taxAmount = taxableAmount * (taxPercent / 100);
          const total = lineSubtotal - discountAmount + taxAmount;

          return {
            document_id: documentId,
            user_id: user.id,
            product_name: item.product_name,
            description: item.description,
            quantity,
            unit_price: unitPrice,
            discount_percent: discountPercent,
            tax_percent: taxPercent,
            total,
            sort_order: index,
          };
        });

      if (itemsToInsert.length > 0) {
        const { error } = await supabase.from('document_items').insert(itemsToInsert);

        if (error) throw error;
      }

      toast.success(
        `Document ${status === 'draft' ? 'saved as draft' : 'sent'} successfully!`
      );
      onSave();
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Your document could not be saved. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const bgClass = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardClass = isDark ? 'bg-gray-800' : 'bg-white';
  const inputClass = isDark
    ? 'bg-gray-700 border-gray-600 text-white'
    : 'bg-white border-gray-300 text-gray-900';
  const labelClass = isDark ? 'text-gray-200' : 'text-gray-700';
  const textClass = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`min-h-screen ${bgClass} p-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} capitalize`}>
            {existingDocument ? 'Edit' : 'Create'} {documentType}
          </h1>
        </div>

        {/* Main Form */}
        <div className={`${cardClass} rounded-lg shadow-md p-8 mb-6`}>
          {/* Customer Section */}
          <div className="mb-8">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Customer Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="+254..."
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                  Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                  Address
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Customer address"
                />
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Line Items
              </h2>
              <button
                onClick={addItem}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <Plus size={18} />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                <thead>
                  <tr className={isDark ? 'border-b border-gray-700' : 'border-b border-gray-300'}>
                    <th className="text-left py-2 px-2">Product Name</th>
                    <th className="text-left py-2 px-2">Description</th>
                    <th className="text-right py-2 px-2">Qty</th>
                    <th className="text-right py-2 px-2">Unit Price</th>
                    <th className="text-right py-2 px-2">Discount %</th>
                    <th className="text-right py-2 px-2">Tax %</th>
                    <th className="text-right py-2 px-2">Total</th>
                    <th className="text-center py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const unitPrice = safeNum(item.unit_price);
                    const quantity = safeNum(item.quantity);
                    const discountPercent = safeNum(item.discount_percent);
                    const taxPercent = safeNum(item.tax_percent);

                    const lineSubtotal = unitPrice * quantity;
                    const discountAmount = lineSubtotal * (discountPercent / 100);
                    const taxableAmount = lineSubtotal - discountAmount;
                    const taxAmount = taxableAmount * (taxPercent / 100);
                    const total = lineSubtotal - discountAmount + taxAmount;

                    return (
                      <tr
                        key={index}
                        className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                      >
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={item.product_name}
                            onChange={(e) =>
                              updateItem(index, 'product_name', e.target.value)
                            }
                            className={`w-full px-2 py-1 border rounded ${inputClass} text-sm focus:outline-none focus:ring-1 focus:ring-blue-500`}
                            placeholder="Product name"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              updateItem(index, 'description', e.target.value)
                            }
                            className={`w-full px-2 py-1 border rounded ${inputClass} text-sm focus:outline-none focus:ring-1 focus:ring-blue-500`}
                            placeholder="Description"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, 'quantity', safeNum(e.target.value))
                            }
                            className={`w-16 px-2 py-1 border rounded ${inputClass} text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500`}
                            min="1"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateItem(index, 'unit_price', safeNum(e.target.value))
                            }
                            className={`w-24 px-2 py-1 border rounded ${inputClass} text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500`}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            value={item.discount_percent}
                            onChange={(e) =>
                              updateItem(index, 'discount_percent', safeNum(e.target.value))
                            }
                            className={`w-20 px-2 py-1 border rounded ${inputClass} text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500`}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            value={item.tax_percent}
                            onChange={(e) =>
                              updateItem(index, 'tax_percent', safeNum(e.target.value))
                            }
                            className={`w-20 px-2 py-1 border rounded ${inputClass} text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500`}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        </td>
                        <td className="py-3 px-2 text-right font-medium">
                          KES {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
                Summary
              </h2>
              <div className={`space-y-3 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className="flex justify-between">
                  <span className={labelClass}>Subtotal:</span>
                  <span className="font-medium">
                    KES {totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={labelClass}>Tax:</span>
                  <span className="font-medium">
                    KES {totals.totalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <label className={`block text-sm font-medium ${labelClass}`}>
                    Delivery Charge:
                  </label>
                  <input
                    type="number"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(safeNum(e.target.value))}
                    className={`w-32 px-2 py-1 border rounded ${inputClass} text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="flex justify-between">
                  <label className={`block text-sm font-medium ${labelClass}`}>
                    Discount:
                  </label>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(safeNum(e.target.value))}
                    className={`w-32 px-2 py-1 border rounded ${inputClass} text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className={`pt-3 border-t ${isDark ? 'border-gray-600' : 'border-gray-300'} flex justify-between`}>
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-lg">
                    KES {totals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates and Payment */}
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
                Additional Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                    Document Date
                  </label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                {(documentType === 'invoice' || documentType === 'quotation') && (
                  <div>
                    <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                      {documentType === 'invoice' ? 'Due Date' : 'Due Date'}
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                )}

                {documentType === 'quotation' && (
                  <div>
                    <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">Select payment method</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="check">Check</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                rows={4}
                placeholder="Additional notes..."
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${labelClass} mb-2`}>
                Terms & Conditions
              </label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                rows={4}
                placeholder="Terms and conditions..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                isDark
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave('draft')}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {isLoading ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              onClick={() => handleSave('sent')}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
              {isLoading ? 'Saving...' : 'Save & Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
