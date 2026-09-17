import React, { useState, useEffect } from 'react';
import { Plus, User, DollarSign, Truck, MapPin, Calendar, CreditCard, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import EnhancedDropdown from './EnhancedDropdown';
import ProductItem from './ProductItem';
import { checkRateLimit, RATE_LIMIT_MESSAGE } from '../utils/security';
import { trackEvent } from '../lib/analytics';
import { printReceipt, shareReceiptWhatsApp, type ReceiptData } from '../services/receipts/receiptService';
import { enqueueSale, isNetworkError } from '../services/offline/offlineSalesQueue';
import { toNum, displayNumber } from '../utils/number';
import { calculateSaleTotals } from '../utils/saleMath';
import { formatCurrency } from '../utils/format';
import { useBusinessRole } from '../services/team/useBusinessRole';
import { PageHeader, Card, Button } from './ui';

interface ProductData {
  id: string;
  product: string;
  vendor: string;
  vendorPaymentStatus: 'Paid' | 'Unpaid';
  buyingPrice: number;
  sellingPrice: number;
  quantity: number;
  taxType: 'none' | 'vat' | 'turnover';
  vatAmount: number;
  turnoverTaxAmount: number;
  profit: number;
  color?: string;
  availableColors?: string[];
  itemType: 'goods' | 'service';
  serviceType?: 'flat' | 'hourly' | 'per_session';
  staffName?: string;
}

const blankProduct = (): ProductData => ({
  id: crypto.randomUUID(),
  product: '',
  vendor: '',
  vendorPaymentStatus: 'Unpaid',
  buyingPrice: 0,
  sellingPrice: 0,
  quantity: 1,
  taxType: 'none',
  vatAmount: 0,
  turnoverTaxAmount: 0,
  profit: 0,
  itemType: 'goods',
});

interface SaleFormData {
  deliveryGuy: string;
  deliveryFee: number;
  deliveryFeePaid: boolean;
  clientDeliveryCharge: number;
  location: string;
  date: string;
  clientName: string;
  customerPhone: string;
  paymentMethod: 'Cash' | 'M-Pesa' | 'Bank' | 'Other';
  deliveryStatus: 'Pending' | 'Delivered';
  deliveryDate: string;
}

const SummaryRow: React.FC<{
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'red';
  emphasis?: boolean;
}> = ({ label, value, tone = 'default', emphasis = false }) => (
  <div className={`flex items-center justify-between py-1.5 ${emphasis ? '' : 'border-b border-blue-100 last:border-b-0'}`}>
    <span className={`text-sm ${emphasis ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</span>
    <span
      className={`tabular-nums ${emphasis ? 'text-lg font-bold' : 'text-sm font-medium'} ${
        tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-gray-900'
      }`}
    >
      {value}
    </span>
  </div>
);

const MultiProductSalesForm: React.FC = () => {
  const { role: businessRole } = useBusinessRole();
  const canSeeCosts = !businessRole.isStaff || !businessRole.hideFinancialDetails;
  const [formData, setFormData] = useState<SaleFormData>({
    deliveryGuy: '',
    deliveryFee: 0,
    deliveryFeePaid: false,
    clientDeliveryCharge: 0,
    location: '',
    date: new Date().toISOString().split('T')[0],
    clientName: '',
    customerPhone: '',
    paymentMethod: 'Bank',
    deliveryStatus: 'Delivered',
    deliveryDate: ''
  });

  const [products, setProducts] = useState<ProductData[]>([blankProduct()]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Collapsed by default — most SMEs (walk-in retail, in-person services)
  // never touch delivery at all, so it shouldn't clutter every sale form.
  const [showDeliveryDetails, setShowDeliveryDetails] = useState(false);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalSellingPrice, setTotalSellingPrice] = useState(0);
  const [totalBuyingPrice, setTotalBuyingPrice] = useState(0);
  const [totalTaxes, setTotalTaxes] = useState(0);

  // Calculate totals whenever products or delivery fee changes
  useEffect(() => {
    calculateTotals();
  }, [products, formData.deliveryFee, formData.clientDeliveryCharge]);

  const calculateTotals = () => {
    const { sellingPriceTotal, buyingPriceTotal, taxesTotal, profit } = calculateSaleTotals(
      products,
      formData.deliveryFee,
      formData.clientDeliveryCharge
    );

    setTotalSellingPrice(sellingPriceTotal);
    setTotalBuyingPrice(buyingPriceTotal);
    setTotalTaxes(taxesTotal);
    setTotalProfit(profit);
  };

  const addProduct = () => {
    setProducts([...products, blankProduct()]);
  };

  const removeProduct = (id: string) => {
    if (products.length <= 1) {
      toast.error('At least one product is required');
      return;
    }
    setProducts(products.filter(product => product.id !== id));
  };

  const updateProduct = (id: string, updatedProduct: ProductData) => {
    setProducts(products.map(product => 
      product.id === id ? updatedProduct : product
    ));
  };

  const handleInputChange = (field: keyof SaleFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field if it exists
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Check if at least one product has a name
    const hasValidProduct = products.some(product => product.product.trim() !== '');
    if (!hasValidProduct) {
      newErrors.product = 'At least one product is required';
    }
        
    // Delivery is optional — plenty of SMEs (walk-in retail, in-person
    // services) never use a delivery person at all, so a sale is never
    // blocked on it regardless of whether the line items are goods.

    if (formData.deliveryFee < 0) {
      newErrors.deliveryFee = 'Delivery fee cannot be negative';
    }

    if (formData.clientDeliveryCharge < 0) {
      newErrors.clientDeliveryCharge = 'Delivery charge cannot be negative';
    }
    
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    
    // Validate each product
    products.forEach((product, index) => {
      if (product.product.trim()) {
        if (product.sellingPrice <= 0) {
          newErrors[`product_${index}_sellingPrice`] = 'Selling price must be greater than 0';
        }

        // Quantity and buying price are goods-specific (a service line item
        // has no stock unit or unit cost) and always required — you can't
        // sell 0 units of a good, and profit can't be computed without a
        // cost. Vendor stays optional: not every SME buys from a formal
        // vendor per sale.
        if (product.itemType !== 'service') {
          if (product.quantity <= 0) {
            newErrors[`product_${index}_quantity`] = 'Quantity must be greater than 0';
          }
          if (canSeeCosts && product.buyingPrice <= 0) {
            newErrors[`product_${index}_buyingPrice`] = 'Buying price must be greater than 0';
          }
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // getUser() round-trips to the server; if that fails while offline,
      // fall back to the locally persisted session (no network needed) so
      // a genuinely logged-in shopkeeper isn't blocked from queuing a sale
      // just because the connectivity check itself needs connectivity.
      let userId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        // fall through to session fallback below
      }
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id ?? null;
      }
      if (!userId) {
        toast.error('You must be logged in to record a sale');
        return;
      }
      const user = { id: userId };

      if (!(await checkRateLimit('sale.create'))) {
        toast.error(RATE_LIMIT_MESSAGE);
        setIsSubmitting(false);
        return;
      }

      // Filter out products without names
      const validProducts = products.filter(product => product.product.trim() !== '');
      
      if (validProducts.length === 0) {
        toast.error('Please add at least one product');
        setIsSubmitting(false);
        return;
      }
      
      // Create the main sale record
      const saleId = crypto.randomUUID();

      // Calculate amount owed to vendors
      const amountOwedToVendors = validProducts.reduce((sum, product) => {
        return sum + (product.vendorPaymentStatus === 'Unpaid' ? product.buyingPrice * product.quantity : 0);
      }, 0);
      
      const saleData = {
        id: saleId,
        user_id: user.id,
        product_name: validProducts.map(p => p.product).join(', '),
        seller: validProducts.map(p => p.vendor).join(', '),
        buying_price: totalBuyingPrice,
        selling_price: totalSellingPrice,
        delivery_guy: formData.deliveryGuy,
        delivery_fee: formData.deliveryFee,
        delivery_fee_paid: formData.deliveryFeePaid,
        delivery_charge: formData.clientDeliveryCharge,
        location: formData.location,
        payment_status: amountOwedToVendors > 0 ? 'Unpaid' : 'Paid',
        date: formData.date,
        sale_date: new Date().toISOString(),
        tax_type: validProducts.length === 1 ? validProducts[0].taxType : 'none',
        vat_amount: validProducts.reduce((sum, p) => sum + p.vatAmount, 0),
        turnover_tax_amount: validProducts.reduce((sum, p) => sum + p.turnoverTaxAmount, 0),
        profit: totalProfit,
        amount_owed_to_vendor: amountOwedToVendors,
        client_name: formData.clientName || null,
        customer_phone: formData.customerPhone || null,
        payment_method: formData.paymentMethod,
        delivery_status: formData.deliveryStatus,
        delivery_date: formData.deliveryDate || null
      };
      
      // Insert all sale items. Each item's id is the same client-generated
      // uuid already used as its React key — supplying it explicitly (rather
      // than relying on the column's default) lets a queued offline sale be
      // replayed with .upsert() safely, even after a partial prior attempt.
      const saleItemsData = validProducts.map(product => ({
        id: product.id,
        sale_id: saleId,
        user_id: user.id,
        product_name: product.product,
        vendor: product.vendor,
        vendor_name: product.vendor,
        vendor_payment_status: product.vendorPaymentStatus,
        vendor_payment: product.vendorPaymentStatus === 'Paid' ? product.buyingPrice * product.quantity : 0,
        buying_price: product.buyingPrice,
        selling_price: product.sellingPrice,
        unit_price: product.sellingPrice,
        quantity: product.quantity,
        subtotal: product.sellingPrice * product.quantity,
        profit: product.profit,
        tax_type: product.taxType,
        vat_amount: product.vatAmount,
        turnover_tax_amount: product.turnoverTaxAmount,
        color: product.color || null,
        item_type: product.itemType,
        service_type: product.serviceType || null,
        staff_name: product.staffName || null,
      }));

      // The decrement targets travel with the queued record if this sale
      // ends up offline, so the replay can apply them later, exactly once
      // each, without needing this component involved. Service items have
      // no inventory to decrement.
      const decrementTargets = validProducts
        .filter(product => product.itemType !== 'service')
        .map(product => ({
          productName: product.product.trim(),
          quantity: product.quantity,
        }));

      let offlineQueued = false;
      const { error: saleError } = await supabase.from('sales').insert(saleData);
      if (saleError) {
        if (!isNetworkError(saleError)) throw saleError;
        enqueueSale({ saleId, saleData, saleItemsData, decrementTargets });
        offlineQueued = true;
      }

      if (!offlineQueued) {
        const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);
        if (itemsError) {
          if (!isNetworkError(itemsError)) throw itemsError;
          // The sales row already landed above — upsert-based replay will
          // re-send it harmlessly and add the still-missing sale_items.
          enqueueSale({ saleId, saleData, saleItemsData, decrementTargets });
          offlineQueued = true;
        }
      }

      if (!offlineQueued) {
        // Auto-decrement inventory for each sold product (goods only —
        // decrementTargets already excludes service items). Uses an atomic
        // server-side RPC (see migration 20260805120000) rather than a
        // client-side read-then-write, which raced under concurrent sales
        // of the same product.
        for (const target of decrementTargets) {
          const { error: decrementError } = await supabase.rpc('decrement_inventory_stock', {
            p_product_name: target.productName,
            p_quantity: target.quantity,
          });
          if (decrementError) {
            console.error('Error decrementing inventory for', target.productName, decrementError);
          }
        }
      }

      trackEvent('sale_recorded', { productCount: validProducts.length, offline: offlineQueued });

      if (offlineQueued) {
        toast.success("Saved offline — will sync when you're back online", { duration: 5000 });
      } else {
        // A low-friction alternative to the old forced receipt popup: the
        // success toast itself carries optional Print/WhatsApp actions,
        // rather than interrupting every sale with a modal the owner didn't
        // ask for. Doing nothing is the default; sharing a receipt is a
        // deliberate click.
        const receiptData: ReceiptData = {
          items: validProducts.map(p => ({ productName: p.product, quantity: p.quantity, sellingPrice: p.sellingPrice })),
          total: totalSellingPrice,
          customerName: formData.clientName || undefined,
          date: formData.date,
        };
        toast.custom((t) => (
          <div className={`bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-3 ${t.visible ? 'animate-fade-in' : 'opacity-0'}`}>
            <span className="text-sm text-gray-800 font-medium">Sale recorded successfully!</span>
            <button
              onClick={() => { printReceipt(receiptData); toast.dismiss(t.id); }}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Print receipt
            </button>
            <button
              onClick={() => { shareReceiptWhatsApp(receiptData); toast.dismiss(t.id); }}
              className="text-xs font-medium text-green-600 hover:text-green-800"
            >
              Share on WhatsApp
            </button>
          </div>
        ), { duration: 6000 });
      }

      // Reset form
      setFormData({
        deliveryGuy: '',
        deliveryFee: 0,
        deliveryFeePaid: false,
        clientDeliveryCharge: 0,
        location: '',
        date: new Date().toISOString().split('T')[0],
        clientName: '',
        customerPhone: '',
        paymentMethod: 'Bank',
        deliveryStatus: 'Delivered',
        deliveryDate: ''
      });
      
      setProducts([blankProduct()]);
      
    } catch (error: any) {
      console.error('Error recording sale:', error);
      toast.error(error.message || 'Failed to record sale');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-6">
      <PageHeader icon={Plus} title="Record New Sale" description="Add a sale with one or multiple products" />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Products Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Products</h3>
            <Button type="button" size="sm" icon={Plus} onClick={addProduct}>
              Add Product
            </Button>
          </div>

          <div className="space-y-4">
            {products.map((product, index) => (
              <ProductItem
                key={product.id}
                product={product}
                index={index}
                onChange={(updatedProduct) => updateProduct(product.id, updatedProduct)}
                onRemove={() => removeProduct(product.id)}
                canRemove={products.length > 1}
                error={errors[`product_${index}_product`]}
                canSeeCosts={canSeeCosts}
              />
            ))}
          </div>

          {errors.product && (
            <p className="text-sm text-red-600 mt-2">{errors.product}</p>
          )}
        </Card>

        {/* Sale Details */}
        <Card>
          <h3 className="font-semibold text-gray-800 mb-4">Sale Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className={`w-full px-3 py-2 border ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                } rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                required
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600">{errors.date}</p>
              )}
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Customer Name
              </label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => handleInputChange('clientName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Jane Doe"
              />
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Phone
              </label>
              <input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 0712 345 678"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CreditCard className="w-4 h-4 inline mr-1" />
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Bank">Bank</option>
                <option value="Other">Other</option>
              </select>
            </div>

          </div>

          {/* Delivery — collapsed by default. Everything here (person, fee,
              fee status, charge to client, status, date) is fully optional;
              a walk-in-retail or in-person-service business never needs to
              open this at all. */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowDeliveryDetails(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showDeliveryDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Truck className="w-4 h-4" />
              {showDeliveryDetails ? 'Hide delivery details' : 'Add delivery details (optional)'}
            </button>

            {showDeliveryDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter delivery location"
                  />
                </div>

                <EnhancedDropdown
                  label="Delivery Person (optional)"
                  value={formData.deliveryGuy}
                  onChange={(value) => handleInputChange('deliveryGuy', value)}
                  type="delivery_guy"
                  placeholder="Select delivery person"
                  icon={<Truck className="w-4 h-4 inline mr-1" />}
                />

                {/* Delivery Fee */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Truck className="w-4 h-4 inline mr-1" />
                    Delivery Fee
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={displayNumber(formData.deliveryFee)}
                    onChange={(e) => handleInputChange('deliveryFee', toNum(e.target.value))}
                    className={`w-full px-3 py-2 border ${
                      errors.deliveryFee ? 'border-red-500' : 'border-gray-300'
                    } rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="0.00"
                  />
                  {errors.deliveryFee && (
                    <p className="mt-1 text-sm text-red-600">{errors.deliveryFee}</p>
                  )}
                </div>

                {/* Delivery Fee Paid */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CreditCard className="w-4 h-4 inline mr-1" />
                    Delivery Fee Status
                  </label>
                  <select
                    value={formData.deliveryFeePaid ? 'true' : 'false'}
                    onChange={(e) => handleInputChange('deliveryFeePaid', e.target.value === 'true')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="false">Not Paid</option>
                    <option value="true">Paid</option>
                  </select>
                </div>

                {/* Delivery Charge billed to client */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Delivery Charge (billed to client)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={displayNumber(formData.clientDeliveryCharge)}
                    onChange={(e) => handleInputChange('clientDeliveryCharge', toNum(e.target.value))}
                    className={`w-full px-3 py-2 border ${
                      errors.clientDeliveryCharge ? 'border-red-500' : 'border-gray-300'
                    } rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-gray-400">Amount the customer pays for delivery. Adds to sale revenue.</p>
                  {errors.clientDeliveryCharge && (
                    <p className="mt-1 text-sm text-red-600">{errors.clientDeliveryCharge}</p>
                  )}
                </div>

                {/* Delivery Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Truck className="w-4 h-4 inline mr-1" />
                    Delivery Status
                  </label>
                  <select
                    value={formData.deliveryStatus}
                    onChange={(e) => handleInputChange('deliveryStatus', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>

                {/* Delivery Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Sale Summary */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-2">Sale Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>
              <SummaryRow label="Total Products" value={String(products.filter(p => p.product.trim() !== '').length)} />
              <SummaryRow label="Total Selling Price" value={formatCurrency(totalSellingPrice)} />
              {canSeeCosts && (
                <SummaryRow label="Total Buying Price" value={formatCurrency(totalBuyingPrice)} />
              )}
            </div>
            <div>
              <SummaryRow label="Total Taxes" value={`-${formatCurrency(totalTaxes)}`} tone="red" />
              <SummaryRow label="Delivery Charge to Client" value={`+${formatCurrency(formData.clientDeliveryCharge)}`} tone="green" />
              <SummaryRow label="Delivery Fee" value={`-${formatCurrency(formData.deliveryFee)}`} tone="red" />
              {canSeeCosts && (
                <SummaryRow
                  label="Total Profit"
                  value={formatCurrency(totalProfit)}
                  tone={totalProfit >= 0 ? 'green' : 'red'}
                  emphasis
                />
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} loading={isSubmitting} icon={Save} className="shadow-md hover:shadow-lg">
            {isSubmitting ? 'Recording...' : 'Record Sale'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MultiProductSalesForm;