import React, { useEffect } from 'react';
import { Package, DollarSign, Calculator, Trash2, Users, Clock, Briefcase, ShoppingBag } from 'lucide-react';
import ProductSelector from './ProductSelector';
import EnhancedDropdown from './EnhancedDropdown';
import { User, CreditCard } from 'lucide-react';
import { toNum, displayNumber } from '../utils/number';
import { calculateLineItemTotals } from '../utils/saleMath';
import { formatCurrency } from '../utils/format';

const SERVICE_RATE_LABEL: Record<'flat' | 'hourly' | 'per_session', string> = {
  flat: 'Flat Fee',
  hourly: 'Hourly Rate',
  per_session: 'Fee per Session',
};

const SERVICE_QUANTITY_LABEL: Record<'flat' | 'hourly' | 'per_session', string> = {
  flat: 'Quantity',
  hourly: 'Hours',
  per_session: 'Number of Sessions',
};

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
    itemType: 'goods' | 'service';
    serviceType?: 'flat' | 'hourly' | 'per_session';
    staffName?: string;
  };
  index: number;
  onChange: (product: any) => void;
  onRemove: () => void;
  canRemove: boolean;
  error?: string;
  /** When false, buying price and any cost/profit figures derived from it are hidden from this user. */
  canSeeCosts?: boolean;
}

const ProductItem: React.FC<ProductItemProps> = ({
  product,
  index,
  onChange,
  onRemove,
  canRemove,
  error,
  canSeeCosts = true
}) => {
  // Recalculate tax and profit when relevant fields change
  useEffect(() => {
    calculateTaxAndProfit();
  }, [product.buyingPrice, product.sellingPrice, product.quantity, product.taxType]);

  const calculateTaxAndProfit = () => {
    const { vatAmount, turnoverTaxAmount, profit } = calculateLineItemTotals(product);

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

  const isService = product.itemType === 'service';

  const handleItemTypeChange = (itemType: 'goods' | 'service') => {
    if (itemType === 'service') {
      // Vendor/buying-price/inventory don't apply to a service — clear them
      // rather than leaving a stale value that would otherwise get
      // submitted (and wrongly attributed to a vendor) alongside the item.
      onChange({ ...product, itemType, vendor: '', buyingPrice: 0, vendorPaymentStatus: 'Unpaid', color: '' });
    } else {
      onChange({ ...product, itemType, serviceType: undefined, staffName: undefined });
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 transition-colors duration-150">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-semibold text-gray-800">Product {index + 1}</h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-150 active:scale-90"
            title="Remove product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Goods / Service toggle */}
      <div className="mb-3 inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
        <button
          type="button"
          onClick={() => handleItemTypeChange('goods')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors duration-150 ${
            !isService ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Goods
        </button>
        <button
          type="button"
          onClick={() => handleItemTypeChange('service')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors duration-150 ${
            isService ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" /> Service
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product / Service Name */}
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

        {/* Color — goods-only (a physical product variant) */}
        {!isService && (
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
                      className={`px-3 py-1.5 rounded-full border text-sm transition-all duration-150 active:scale-95 ${
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Or type a custom color"
              />
            </div>
          ) : (
            <input
              type="text"
              value={product.color || ''}
              onChange={(e) => handleInputChange('color', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Black, White, Red"
            />
          )}
        </div>
        )}

        {/* Buying Price — goods-only (a service has no unit cost) */}
        {!isService && canSeeCosts && (
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
              required={product.product.trim() !== ''}
            />
          </div>
        )}

        {/* Service Type — how the rate below was quoted */}
        {isService && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              Rate Type
            </label>
            <select
              value={product.serviceType || 'flat'}
              onChange={(e) => handleInputChange('serviceType', e.target.value as 'flat' | 'hourly' | 'per_session')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="flat">Flat Fee</option>
              <option value="hourly">Hourly</option>
              <option value="per_session">Per Session</option>
            </select>
          </div>
        )}

        {/* Selling Price / Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <DollarSign className="w-4 h-4 inline mr-1" />
            {isService ? SERVICE_RATE_LABEL[product.serviceType || 'flat'] : 'Selling Price (per unit)'} *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={displayNumber(product.sellingPrice)}
            onChange={(e) => handleInputChange('sellingPrice', toNum(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.00"
            required={product.product.trim() !== ''}
          />
        </div>

        {/* Quantity / Hours / Sessions — for a flat-fee service this stays
            a plain count (defaulting to 1); for hourly/per_session it's the
            multiplier against the rate above, using the exact same
            selling_price * quantity math as goods. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Package className="w-4 h-4 inline mr-1" />
            {isService ? SERVICE_QUANTITY_LABEL[product.serviceType || 'flat'] : 'Quantity'} *
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="none">No Tax</option>
            <option value="vat">VAT (16%)</option>
            <option value="turnover">Turnover Tax (1.5%)</option>
          </select>
        </div>

        {/* Staff / Provider — service-only, deliberately separate from the
            sale-level Delivery Guy field (a hybrid sale can have both). */}
        {isService && (
          <div className="md:col-span-2">
            <EnhancedDropdown
              label="Staff/Provider"
              value={product.staffName || ''}
              onChange={(value) => handleInputChange('staffName', value)}
              type="staff"
              placeholder="Who performed this service?"
              icon={<Users className="w-4 h-4 inline mr-1" />}
            />
          </div>
        )}

        {/* Vendor — goods-only */}
        {!isService && (
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
        )}

        {/* Vendor Payment Status — goods-only */}
        {!isService && (
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <CreditCard className="w-4 h-4 inline mr-1" />
            Vendor Payment Status *
          </label>
          <select
            value={product.vendorPaymentStatus}
            onChange={(e) => handleInputChange('vendorPaymentStatus', e.target.value as 'Paid' | 'Unpaid')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="Unpaid">Unpaid</option>
            <option value="Paid">Paid</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            {product.vendorPaymentStatus === 'Unpaid'
              ? canSeeCosts
                ? `If unpaid, you owe the vendor ${formatCurrency(toNum(product.buyingPrice) * toNum(product.quantity))}`
                : 'An amount will be owed to the vendor for this item'
              : 'No amount owed to vendor'}
          </p>
        </div>
        )}

        {/* Product Summary */}
        <div className="md:col-span-2 bg-blue-50 border border-blue-100 p-3.5 rounded-lg">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-sm">
            <div>
              <span className="text-gray-600">Subtotal:</span>
              <span className="float-right font-medium tabular-nums">
                {formatCurrency(toNum(product.sellingPrice) * toNum(product.quantity))}
              </span>
            </div>

            {!isService && canSeeCosts && (
              <div>
                <span className="text-gray-600">Cost:</span>
                <span className="float-right font-medium tabular-nums">
                  {formatCurrency(toNum(product.buyingPrice) * toNum(product.quantity))}
                </span>
              </div>
            )}

            {product.taxType === 'vat' && (
              <div>
                <span className="text-gray-600">VAT (16%):</span>
                <span className="float-right font-medium text-red-600 tabular-nums">
                  {formatCurrency(product.vatAmount)}
                </span>
              </div>
            )}

            {product.taxType === 'turnover' && (
              <div>
                <span className="text-gray-600">Turnover Tax (1.5%):</span>
                <span className="float-right font-medium text-red-600 tabular-nums">
                  {formatCurrency(product.turnoverTaxAmount)}
                </span>
              </div>
            )}

            {canSeeCosts && (
              <div className="col-span-2 border-t border-blue-100 pt-1.5 mt-0.5">
                <span className="text-gray-700 font-medium">Item Profit:</span>
                <span className={`float-right font-bold tabular-nums ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(product.profit)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductItem;