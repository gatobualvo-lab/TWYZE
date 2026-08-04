import React, { useState, useEffect } from 'react';
import { Plus, User, DollarSign, Truck, MapPin, Calendar, CreditCard, Save, Package, Search } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import EnhancedDropdown from './EnhancedDropdown';
import ClientDropdown from './ClientDropdown';
import ProductItem from './ProductItem';
import ReceiptModal from './ReceiptModal';
import { checkRateLimit, RATE_LIMIT_MESSAGE } from '../utils/security';
import { toNum, displayNumber } from '../utils/number';

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
}

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

const MultiProductSalesForm: React.FC = () => {
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

  const [products, setProducts] = useState<ProductData[]>([{
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
    profit: 0
  }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalSellingPrice, setTotalSellingPrice] = useState(0);
  const [totalBuyingPrice, setTotalBuyingPrice] = useState(0);
  const [totalTaxes, setTotalTaxes] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Calculate totals whenever products or delivery fee changes
  useEffect(() => {
    calculateTotals();
  }, [products, formData.deliveryFee, formData.clientDeliveryCharge]);

  const calculateTotals = () => {
    const sellingPriceTotal = products.reduce((sum, product) =>
      sum + toNum(product.sellingPrice) * toNum(product.quantity), 0);

    const buyingPriceTotal = products.reduce((sum, product) =>
      sum + toNum(product.buyingPrice) * toNum(product.quantity), 0);

    const taxesTotal = products.reduce((sum, product) =>
      sum + toNum(product.vatAmount) + toNum(product.turnoverTaxAmount), 0);

    setTotalSellingPrice(sellingPriceTotal);
    setTotalBuyingPrice(buyingPriceTotal);
    setTotalTaxes(taxesTotal);

    const calculatedProfit =
      sellingPriceTotal + toNum(formData.clientDeliveryCharge) - buyingPriceTotal - toNum(formData.deliveryFee) - taxesTotal;
    setTotalProfit(calculatedProfit);
  };

  const addProduct = () => {
    setProducts([...products, {
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
      profit: 0
    }]);
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
        
    if (!formData.deliveryGuy.trim()) {
      newErrors.deliveryGuy = 'Delivery person is required';
    }
    
    if (formData.deliveryFee < 0) {
      newErrors.deliveryFee = 'Delivery fee cannot be negative';
    }

    if (formData.clientDeliveryCharge < 0) {
      newErrors.clientDeliveryCharge = 'Delivery charge cannot be negative';
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    
    // Validate each product
    products.forEach((product, index) => {
      if (product.product.trim()) {
        if (product.buyingPrice <= 0) {
          newErrors[`product_${index}_buyingPrice`] = 'Buying price must be greater than 0';
        }
        
        if (product.sellingPrice <= 0) {
          newErrors[`product_${index}_sellingPrice`] = 'Selling price must be greater than 0';
        }
        
        if (product.quantity <= 0) {
          newErrors[`product_${index}_quantity`] = 'Quantity must be greater than 0';
        }
        
        // Check if vendor is selected
        if (!product.vendor.trim()) {
          newErrors[`product_${index}_vendor`] = 'Vendor is required';
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to record a sale');
        return;
      }

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
      
      const { error: saleError } = await supabase
        .from('sales')
        .insert(saleData);
      
      if (saleError) {
        throw saleError;
      }
      
      // Insert all sale items
      const saleItemsData = validProducts.map(product => ({
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
      }));
      
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItemsData);

      if (itemsError) {
        throw itemsError;
      }

      // Auto-decrement inventory for each sold product
      for (const product of validProducts) {
        const { data: invItems } = await supabase
          .from('inventory_items')
          .select('id, current_stock')
          .eq('user_id', user.id)
          .ilike('product_name', product.product.trim())
          .limit(1);

        if (invItems && invItems.length > 0) {
          const newStock = Math.max(0, invItems[0].current_stock - product.quantity);
          await supabase
            .from('inventory_items')
            .update({ current_stock: newStock })
            .eq('id', invItems[0].id);
        }
      }

      // Prepare receipt data
      setReceiptData({
        saleId,
        date: formData.date,
        clientName: formData.clientName,
        customerPhone: formData.customerPhone,
        items: validProducts.map(p => ({
          product: p.product,
          quantity: p.quantity,
          unitPrice: p.sellingPrice,
          subtotal: p.sellingPrice * p.quantity,
          color: p.color || undefined,
        })),
        deliveryFee: formData.deliveryFee,
        clientDeliveryCharge: formData.clientDeliveryCharge,
        totalAmount: totalSellingPrice + formData.clientDeliveryCharge,
        paymentMethod: formData.paymentMethod,
        location: formData.location,
        deliveryGuy: formData.deliveryGuy,
      });
      setShowReceipt(true);

      toast.success('Sale recorded successfully!');
      
      // Reset form
      setFormData({
        deliveryGuy: '',
        deliveryFee: 0,
        deliveryFeePaid: false,
        location: '',
        date: new Date().toISOString().split('T')[0],
        clientName: '',
        customerPhone: '',
        paymentMethod: 'Cash',
        deliveryStatus: 'Pending',
        deliveryDate: ''
      });
      
      setProducts([{
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
        profit: 0
      }]);
      
    } catch (error: any) {
      console.error('Error recording sale:', error);
      toast.error(error.message || 'Failed to record sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: unknown) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(toNum(amount));
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-blue-100">
          <Plus className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Record New Sale</h2>
          <p className="text-gray-600">Add a sale with one or multiple products</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Products Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-800">Products</h3>
            <button
              type="button"
              onClick={addProduct}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
          
          {products.map((product, index) => (
            <ProductItem
              key={product.id}
              product={product}
              index={index}
              onChange={(updatedProduct) => updateProduct(product.id, updatedProduct)}
              onRemove={() => removeProduct(product.id)}
              canRemove={products.length > 1}
              error={errors[`product_${index}_product`]}
            />
          ))}
          
          {errors.product && (
            <p className="text-sm text-red-600 mt-1">{errors.product}</p>
          )}
        </div>

        {/* Sale Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Delivery Guy */}
          <EnhancedDropdown
            label="Delivery Person"
            value={formData.deliveryGuy}
            onChange={(value) => handleInputChange('deliveryGuy', value)}
            type="delivery_guy"
            placeholder="Select delivery person"
            required
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
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-gray-500">Amount the customer pays for delivery. Adds to sale revenue.</p>
            {errors.clientDeliveryCharge && (
              <p className="mt-1 text-sm text-red-600">{errors.clientDeliveryCharge}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className={`w-full px-3 py-2 border ${
                errors.location ? 'border-red-500' : 'border-gray-300'
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              placeholder="Enter delivery location"
              required
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location}</p>
            )}
          </div>

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
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Cash">Cash</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="Bank">Bank</option>
              <option value="Other">Other</option>
            </select>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Sale Summary */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Sale Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Products:</span>
                <span className="font-medium">{products.filter(p => p.product.trim() !== '').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Selling Price:</span>
                <span className="font-medium">{formatCurrency(totalSellingPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Buying Price:</span>
                <span className="font-medium">{formatCurrency(totalBuyingPrice)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Taxes:</span>
                <span className="font-medium text-red-600">-{formatCurrency(totalTaxes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Charge to Client:</span>
                <span className="font-medium text-green-600">+{formatCurrency(formData.clientDeliveryCharge)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee:</span>
                <span className="font-medium text-red-600">-{formatCurrency(formData.deliveryFee)}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
                <span className="text-gray-800 font-semibold">Total Profit:</span>
                <span className={`font-bold text-lg ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Recording...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Record Sale
              </>
            )}
          </button>
        </div>
      </form>

      {showReceipt && receiptData && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          data={receiptData}
        />
      )}
    </div>
  );
};

export default MultiProductSalesForm;