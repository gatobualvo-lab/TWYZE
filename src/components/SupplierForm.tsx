import React, { useState, useEffect } from 'react';
import { Plus, Calculator, User, DollarSign, Truck, Calendar, Save, Package, ArrowRight, Info, Wallet, Receipt } from 'lucide-react';
import { supabase } from '../utils/supabase';
import EnhancedDropdown from './EnhancedDropdown';
import ClientDropdown from './ClientDropdown';
import toast from 'react-hot-toast';
import { toNum, displayNumber } from '../utils/number';

type PaymentStatus = 'Paid' | 'Partial' | 'Pending';

interface SupplierFormData {
  client: string;
  product: string;
  delivery_guy: string;
  buying_price: number;
  selling_price: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  date: string;
  tax_type: 'none' | 'vat' | 'turnover';
}

const blankForm = (): SupplierFormData => ({
  client: '',
  product: '',
  delivery_guy: '',
  buying_price: 0,
  selling_price: 0,
  amount_paid: 0,
  payment_status: 'Pending',
  date: new Date().toISOString().split('T')[0],
  tax_type: 'none',
});

const SupplierForm: React.FC = () => {
  const [formData, setFormData] = useState<SupplierFormData>(blankForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [grossProfit, setGrossProfit] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [balanceDue, setBalanceDue] = useState(0);

  useEffect(() => {
    const selling = toNum(formData.selling_price);
    const buying = toNum(formData.buying_price);
    const paid = toNum(formData.amount_paid);
    const gross = selling - buying;
    let tax = 0;
    if (formData.tax_type === 'vat') tax = selling * 0.16;
    else if (formData.tax_type === 'turnover') tax = selling * 0.015;

    setGrossProfit(gross);
    setTaxAmount(tax);
    setNetProfit(gross - tax);
    setBalanceDue(Math.max(0, selling - paid));
  }, [formData.buying_price, formData.selling_price, formData.tax_type, formData.amount_paid]);

  // Auto-derive payment status from amount paid vs selling price
  useEffect(() => {
    if (formData.selling_price <= 0) return;
    let next: PaymentStatus = 'Pending';
    if (formData.amount_paid >= formData.selling_price) next = 'Paid';
    else if (formData.amount_paid > 0) next = 'Partial';
    if (next !== formData.payment_status) {
      setFormData((prev) => ({ ...prev, payment_status: next }));
    }
  }, [formData.amount_paid, formData.selling_price]);

  const handleInputChange = <K extends keyof SupplierFormData>(field: K, value: SupplierFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStatusChange = (status: PaymentStatus) => {
    setFormData((prev) => {
      let amount_paid = prev.amount_paid;
      if (status === 'Paid') amount_paid = prev.selling_price;
      else if (status === 'Pending') amount_paid = 0;
      return { ...prev, payment_status: status, amount_paid };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client || !formData.product || formData.selling_price <= 0) {
      toast.error('Please fill in client, product, and selling price');
      return;
    }
    if (formData.amount_paid < 0 || formData.amount_paid > formData.selling_price) {
      toast.error('Amount paid must be between 0 and the selling price');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to record supplier sales');
        return;
      }

      const supplierData = {
        id: crypto.randomUUID(),
        user_id: user.id,
        // Legacy/back-compat columns kept populated so older queries still work
        name: formData.client,
        amount: formData.selling_price,
        client: formData.client,
        product: formData.product,
        delivery_guy: formData.delivery_guy,
        buying_price: formData.buying_price,
        selling_price: formData.selling_price,
        amount_paid: formData.amount_paid,
        balance_due: balanceDue,
        payment_status: formData.payment_status,
        date: formData.date,
        tax_type: formData.tax_type,
        profit: netProfit,
        vat_amount: formData.tax_type === 'vat' ? taxAmount : null,
        turnover_tax_amount: formData.tax_type === 'turnover' ? taxAmount : null,
      };

      const { error } = await supabase.from('suppliers').insert(supplierData);
      if (error) throw error;

      toast.success('Supplier sale recorded successfully!');
      setFormData(blankForm());
    } catch (error: any) {
      console.error('Error recording supplier sale:', error);
      toast.error(error.message || 'Failed to record supplier sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatKES = (n: unknown) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(toNum(n));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-200 p-6">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-lg bg-emerald-600 text-white shadow-sm">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">Supplier Sales (You &rarr; Client)</h2>
              <p className="text-gray-600 mt-1">
                Record products you supply to clients and track payments and balances.
              </p>
            </div>
          </div>

          {/* Flow indicator */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-sm font-semibold shadow-sm">
              <User className="w-4 h-4" />
              You (Supplier)
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-600" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-emerald-200 text-emerald-700 text-sm font-semibold">
              <Package className="w-4 h-4" />
              Client (Buyer)
            </div>
          </div>

          {/* Helper note */}
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Use this section for <span className="font-semibold">repeat clients you supply regularly</span>.
              For ordinary one-time sales, use <span className="font-semibold">Add Sale</span>.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ClientDropdown
              label="Client Name"
              value={formData.client}
              onChange={(value) => handleInputChange('client', value)}
              placeholder="Select repeat client"
              required
              icon={<User className="w-4 h-4 inline mr-1" />}
            />

            <EnhancedDropdown
              label="Product"
              value={formData.product}
              onChange={(value) => handleInputChange('product', value)}
              type="product"
              placeholder="Select product supplied"
              required
              icon={<Package className="w-4 h-4 inline mr-1" />}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Cost Price (KES) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={displayNumber(formData.buying_price)}
                onChange={(e) => handleInputChange('buying_price', toNum(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="What it cost you"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Your cost to acquire/produce the product.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Selling Price to Client (KES) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={displayNumber(formData.selling_price)}
                onChange={(e) => handleInputChange('selling_price', toNum(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="What the client owes you"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Total price billed to the client.</p>
            </div>

            <EnhancedDropdown
              label="Delivery Person"
              value={formData.delivery_guy}
              onChange={(value) => handleInputChange('delivery_guy', value)}
              type="delivery_guy"
              placeholder="Select delivery person"
              icon={<Truck className="w-4 h-4 inline mr-1" />}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Transaction Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Tax Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tax Type</label>
            <div className="flex flex-wrap gap-4">
              {([
                { value: 'none', label: 'No Tax' },
                { value: 'vat', label: 'VAT (16%)' },
                { value: 'turnover', label: 'Turnover Tax (1.5%)' },
              ] as const).map((opt) => (
                <label key={opt.value} className="flex items-center">
                  <input
                    type="radio"
                    name="tax_type"
                    value={opt.value}
                    checked={formData.tax_type === opt.value}
                    onChange={() => handleInputChange('tax_type', opt.value)}
                    className="mr-2 accent-emerald-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Payment Tracking */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-800">Payment Tracking</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Paid', 'Partial', 'Pending'] as PaymentStatus[]).map((status) => {
                    const active = formData.payment_status === status;
                    const tone =
                      status === 'Paid'
                        ? active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                        : status === 'Partial'
                        ? active
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                        : active
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100';
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusChange(status)}
                        className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${tone}`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Paid (KES)</label>
                <input
                  type="number"
                  min="0"
                  max={formData.selling_price || undefined}
                  step="0.01"
                  value={displayNumber(formData.amount_paid)}
                  onChange={(e) => handleInputChange('amount_paid', toNum(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Balance Due (KES)</label>
                <div
                  className={`w-full px-3 py-2 border rounded-lg font-semibold ${
                    balanceDue > 0
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {formatKES(balanceDue)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-calculated from selling price.</p>
              </div>
            </div>
          </div>

          {/* Profit Calculation */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-800">Profit Calculation</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total Selling Price</p>
                <p className="font-semibold text-gray-900">{formatKES(formData.selling_price)}</p>
              </div>
              <div>
                <p className="text-gray-600">Gross Profit</p>
                <p className={`font-semibold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatKES(grossProfit)}
                </p>
              </div>
              {taxAmount > 0 && (
                <div>
                  <p className="text-gray-600">Tax</p>
                  <p className="font-semibold text-red-600">-{formatKES(taxAmount)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-600">Net Profit</p>
                <p className={`font-bold text-lg ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatKES(netProfit)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <Plus className="w-4 h-4" />
                  Record Supplier Sale
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierForm;
