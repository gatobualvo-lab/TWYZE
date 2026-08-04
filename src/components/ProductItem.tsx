import React, { useEffect } from 'react';
import { Package, DollarSign, Calculator, Trash2 } from 'lucide-react';
import ProductSelector from './ProductSelector';
import EnhancedDropdown from './EnhancedDropdown';
import { User, CreditCard } from 'lucide-react';
import { toNum, displayNumber } from '../utils/number';

interface ProductItemProps {
  product: {
    id: string;
    product: string;
    buyingPrice: number;
    sellingPrice: number;
    quantity: number;
    taxType: 'none' | 'vat' | 'turnover';
    vatAmount: number;
    turnoverTaxAmount: number;
    vendor: string;
    vendorPaymentStatus: 'Paid' | 'Unpaid';
    profit: number;
    color?: string;
    availableColors?: string[];
  };
  index: number;
  onChange: (product: any) => void;
  onRemove: () => void;
  canRemove: boolean;
  error?: string;
}

const ProductItem: React.FC<ProductItemProps> = ({
  product,
  index,
  onChange,
  onRemove,
  canRemove,
  error
}) => {
  // Recalculate tax and profit when relevant fields change
  useEffect(() => {
    calculateTaxAndProfit();
  }, [product.buyingPrice, product.sellingPrice, product.quantity, product.taxType]);

  const calculateTaxAndProfit = () => {
    const qty = toNum(product.quantity);
    const totalBuyingPrice = toNum(product.buyingPrice) * qty;
    const totalSellingPrice = toNum(product.sellingPrice) * qty;

    let vatAmount = 0;
    let turnoverTaxAmount = 0;

    if (product.taxType === 'vat') {
      vatAmount = totalSellingPrice * 0.16;
    } else if (product.taxType === 'turnover') {
      turnoverTaxAmount = totalSellingPrice * 0.015;
    }

    const profit = totalSellingPrice - totalBuyingPrice - vatAmount - turnoverTaxAmount;

    onChange({
      ...product,
      vatAmount,
      turnoverTaxAmount,
      profit,
    });
  };

  const handleInputChange = (field: string, value: any) => {
    onChange({ ...product, [field]: value });
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
    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-md font-medium text-gray-800">Product {index + 1}</h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Remove product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product Name */}
        <div className="md:col-span-2">
          <ProductSelector
            value={product.product}
            onChange={(value) => handleInputChange('product', value)}
            onProductSelect={(selected) => {
              const colors = selected.colors ?? [];
              onChange({
                ...product,
                product: selected.name,
                buyingPrice: selected.buying_price || product.buyingPrice,
                sellingPrice: selected.price || product.sellingPrice,
                availableColors: colors,
                color: colors.includes(product.color ?? '') ? product.color : '',
              });
            }}
            required
            error={error}
          />
        </div>

        {/* Color */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Color (optional)
          </label>
          {product.availableColors && product.availableColors.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {product.availableColors.map(color => {
                  const isSelected = product.color === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleInputChange('color', isSelected ? '' : color)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={product.color || ''}
                onChange={(e) => handleInputChange('color', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Or type a custom color"
              />
            </div>
          ) : (
            <input
              type="text"
              value={product.color || ''}
              onChange={(e) => handleInputChange('color', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Black, White, Red"
            />
          )}
        </div>

        {/* Buying Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Buying Price (per unit) *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={displayNumber(product.buyingPrice)}
            onChange={(e) => handleInputChange('buyingPrice', toNum(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.00"
            required={product.product.trim() !== ''}
          />
        </div>

        {/* Selling Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Selling Price (per unit) *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={displayNumber(product.sellingPrice)}
            onChange={(e) => handleInputChange('sellingPrice', toNum(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.00"
            required={product.product.trim() !== ''}
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Package className="w-4 h-4 inline mr-1" />
            Quantity *
          </label>
          <input
            type="number"
            min="1"
            value={displayNumber(product.quantity)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                handleInputChange('quantity', 0);
              } else {
                const n = parseInt(raw, 10);
                handleInputChange('quantity', Number.isFinite(n) ? n : 0);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="1"
            required={product.product.trim() !== ''}
          />
        </div>

        {/* Tax Type */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Calculator className="w-4 h-4 inline mr-1" /> 
            Tax Type
          </label>
          <select
            value={product.taxType}
            onChange={(e) => handleInputChange('taxType', e.target.value as 'none' | 'vat' | 'turnover')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="none">No Tax</option>
            <option value="vat">VAT (16%)</option>
            <option value="turnover">Turnover Tax (1.5%)</option>
          </select>
        </div>

        {/* Vendor */}
        <div className="md:col-span-2">
          <EnhancedDropdown
            label="Vendor"
            value={product.vendor}
            onChange={(value) => handleInputChange('vendor', value)}
            type="supplier"
            placeholder="Select vendor"
            required
            icon={<User className="w-4 h-4 inline mr-1" />}
          />
        </div>

        {/* Vendor Payment Status */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <CreditCard className="w-4 h-4 inline mr-1" />
            Vendor Payment Status *
          </label>
          <select
            value={product.vendorPaymentStatus}
            onChange={(e) => handleInputChange('vendorPaymentStatus', e.target.value as 'Paid' | 'Unpaid')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="Unpaid">Unpaid</option>
            <option value="Paid">Paid</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {product.vendorPaymentStatus === 'Unpaid' 
              ? `If unpaid, you owe the vendor ${formatCurrency(toNum(product.buyingPrice) * toNum(product.quantity))}`
              : 'No amount owed to vendor'}
          </p>
        </div>

        {/* Product Summary */}
        <div className="md:col-span-2 bg-blue-50 p-3 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Subtotal:</span>
              <span className="float-right font-medium">
                {formatCurrency(toNum(product.sellingPrice) * toNum(product.quantity))}
              </span>
            </div>
            
            <div>
              <span className="text-gray-600">Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency(toNum(product.buyingPrice) * toNum(product.quantity))}
              </span>
            </div>
            
            {product.taxType === 'vat' && (
              <div>
                <span className="text-gray-600">VAT (16%):</span>
                <span className="float-right font-medium text-red-600">
                  {formatCurrency(product.vatAmount)}
                </span>
              </div>
            )}
            
            {product.taxType === 'turnover' && (
              <div>
                <span className="text-gray-600">Turnover Tax (1.5%):</span>
                <span className="float-right font-medium text-red-600">
                  {formatCurrency(product.turnoverTaxAmount)}
                </span>
              </div>
            )}
            
            <div className="col-span-2 border-t pt-1 mt-1">
              <span className="text-gray-700 font-medium">Item Profit:</span>
              <span className={`float-right font-bold ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(product.profit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductItem;