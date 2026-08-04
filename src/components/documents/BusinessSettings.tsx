import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import toast from 'react-hot-toast';
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  CreditCard,
  FileText,
  Palette,
  Loader,
} from 'lucide-react';

interface BusinessSettings {
  id: string;
  user_id: string;
  business_name: string;
  phone: string;
  email: string;
  website: string;
  physical_address: string;
  postal_address: string;
  city: string;
  country: string;
  kra_pin: string;
  vat_number: string;
  logo_url: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  default_currency: string;
  payment_instructions: string;
  bank_details: string;
  invoice_footer: string;
  quotation_footer: string;
  receipt_footer: string;
  invoice_prefix: string;
  quotation_prefix: string;
  receipt_prefix: string;
  invoice_next_number: number;
  quotation_next_number: number;
  receipt_next_number: number;
  default_template: string;
  created_at: string;
  updated_at: string;
}

const TEMPLATES = [
  { id: 'classic', label: 'Classic', description: 'Traditional business style' },
  { id: 'minimal', label: 'Minimal', description: 'Clean and simple' },
  { id: 'professional', label: 'Professional', description: 'Modern corporate design' },
  { id: 'corporate', label: 'Corporate', description: 'Premium business layout' },
];

export default function BusinessSettings() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Partial<BusinessSettings>>({
    business_name: '',
    phone: '',
    email: '',
    website: '',
    physical_address: '',
    postal_address: '',
    city: '',
    country: 'Kenya',
    kra_pin: '',
    vat_number: '',
    default_currency: 'KES',
    payment_instructions: '',
    bank_details: '',
    invoice_footer: 'Thank you for your business!',
    quotation_footer: 'This quotation is valid for 30 days.',
    receipt_footer: 'Thank you for your payment!',
    invoice_prefix: 'INV-',
    quotation_prefix: 'QT-',
    receipt_prefix: 'RCPT-',
    invoice_next_number: 1,
    quotation_next_number: 1,
    receipt_next_number: 1,
    default_template: 'professional',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Not authenticated');
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // Fetch business settings
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        toast.error('Failed to load settings');
        console.error(error);
      } else if (data) {
        setSettings(data);
      } else {
        // Auto-create default settings for new users
        const { data: newSettings, error: insertError } = await supabase
          .from('business_settings')
          .insert({ user_id: user.id })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('Error creating default settings:', insertError);
        } else if (newSettings) {
          setSettings(newSettings);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('An error occurred while loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    field: keyof BusinessSettings,
    value: string | number
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      if (!userId) {
        toast.error('User not authenticated');
        return;
      }

      setSaving(true);

      const dataToSave = {
        user_id: userId,
        ...settings,
      };

      const { error } = await supabase
        .from('business_settings')
        .upsert(dataToSave, { onConflict: 'user_id' });

      if (error) {
        toast.error('Failed to save settings');
        console.error(error);
      } else {
        toast.success('Settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('An error occurred while saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin text-blue-500" />
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  const sectionClasses = `${
    isDark
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-200'
  } rounded-lg border p-6`;

  const labelClasses = `block text-sm font-medium ${
    isDark ? 'text-gray-300' : 'text-gray-700'
  } mb-1`;

  const inputClasses = `w-full px-3 py-2 rounded-lg border ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:outline-none focus:ring-2 focus:ring-blue-500`;

  const textareaClasses = `w-full px-3 py-2 rounded-lg border ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} py-8 px-4`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Business Settings
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Configure your business information used across all documents
          </p>
        </div>

        {/* Business Profile Section */}
        <div className={`${sectionClasses} mb-6`}>
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className={`text-xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Business Profile
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Your basic business information
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Business Name</label>
              <input
                type="text"
                className={inputClasses}
                placeholder="Your Business Name"
                value={settings.business_name || ''}
                onChange={(e) =>
                  handleInputChange('business_name', e.target.value)
                }
              />
            </div>
            <div>
              <label className={labelClasses}>Phone</label>
              <input
                type="tel"
                className={inputClasses}
                placeholder="+254 7XX XXX XXX"
                value={settings.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClasses}>Email</label>
              <input
                type="email"
                className={inputClasses}
                placeholder="info@business.com"
                value={settings.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClasses}>Website</label>
              <input
                type="url"
                className={inputClasses}
                placeholder="www.business.com"
                value={settings.website || ''}
                onChange={(e) => handleInputChange('website', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClasses}>City</label>
              <input
                type="text"
                className={inputClasses}
                placeholder="Nairobi"
                value={settings.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClasses}>Country</label>
              <input
                type="text"
                className={inputClasses}
                placeholder="Kenya"
                value={settings.country || ''}
                onChange={(e) => handleInputChange('country', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>Physical Address</label>
              <input
                type="text"
                className={inputClasses}
                placeholder="Street address and building details"
                value={settings.physical_address || ''}
                onChange={(e) =>
                  handleInputChange('physical_address', e.target.value)
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>Postal Address</label>
              <input
                type="text"
                className={inputClasses}
                placeholder="P.O. Box or postal code"
                value={settings.postal_address || ''}
                onChange={(e) =>
                  handleInputChange('postal_address', e.target.value)
                }
              />
            </div>
          </div>
        </div>

        {/* Tax Information Section */}
        <div className={`${sectionClasses} mb-6`}>
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="w-6 h-6 text-green-500" />
            <div>
              <h2 className={`text-xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Tax Information
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Tax numbers for compliance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>KRA PIN</label>
              <input
                type="text"
                className={inputClasses}
                placeholder="A000000000XXX"
                value={settings.kra_pin || ''}
                onChange={(e) => handleInputChange('kra_pin', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClasses}>VAT Number</label>
              <input
                type="text"
                className={inputClasses}
                placeholder="VAT number"
                value={settings.vat_number || ''}
                onChange={(e) =>
                  handleInputChange('vat_number', e.target.value)
                }
              />
            </div>
          </div>
        </div>

        {/* Document Numbering Section */}
        <div className={`${sectionClasses} mb-6`}>
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-purple-500" />
            <div>
              <h2 className={`text-xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Document Numbering
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Prefixes and next numbers for automatic numbering
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoices */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Invoices
              </h3>
              <div className="space-y-3">
                <div>
                  <label className={labelClasses}>Prefix</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="INV-"
                    value={settings.invoice_prefix || ''}
                    onChange={(e) =>
                      handleInputChange('invoice_prefix', e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClasses}>Next Number</label>
                  <input
                    type="number"
                    className={inputClasses}
                    placeholder="1"
                    min="1"
                    value={settings.invoice_next_number || 1}
                    onChange={(e) =>
                      handleInputChange(
                        'invoice_next_number',
                        parseInt(e.target.value) || 1
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {/* Quotations */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Quotations
              </h3>
              <div className="space-y-3">
                <div>
                  <label className={labelClasses}>Prefix</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="QT-"
                    value={settings.quotation_prefix || ''}
                    onChange={(e) =>
                      handleInputChange('quotation_prefix', e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClasses}>Next Number</label>
                  <input
                    type="number"
                    className={inputClasses}
                    placeholder="1"
                    min="1"
                    value={settings.quotation_next_number || 1}
                    onChange={(e) =>
                      handleInputChange(
                        'quotation_next_number',
                        parseInt(e.target.value) || 1
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {/* Receipts */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Receipts
              </h3>
              <div className="space-y-3">
                <div>
                  <label className={labelClasses}>Prefix</label>
                  <input
                    type="text"
                    className={inputClasses}
                    placeholder="RCPT-"
                    value={settings.receipt_prefix || ''}
                    onChange={(e) =>
                      handleInputChange('receipt_prefix', e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClasses}>Next Number</label>
                  <input
                    type="number"
                    className={inputClasses}
                    placeholder="1"
                    min="1"
                    value={settings.receipt_next_number || 1}
                    onChange={(e) =>
                      handleInputChange(
                        'receipt_next_number',
                        parseInt(e.target.value) || 1
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Default Footer Messages Section */}
        <div className={`${sectionClasses} mb-6`}>
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-orange-500" />
            <div>
              <h2 className={`text-xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Default Footer Messages
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Footers displayed on different document types
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClasses}>Invoice Footer</label>
              <textarea
                className={textareaClasses}
                placeholder="Thank you for your business!"
                rows={2}
                value={settings.invoice_footer || ''}
                onChange={(e) =>
                  handleInputChange('invoice_footer', e.target.value)
                }
              />
            </div>
            <div>
              <label className={labelClasses}>Quotation Footer</label>
              <textarea
                className={textareaClasses}
                placeholder="This quotation is valid for 30 days."
                rows={2}
                value={settings.quotation_footer || ''}
                onChange={(e) =>
                  handleInputChange('quotation_footer', e.target.value)
                }
              />
            </div>
            <div>
              <label className={labelClasses}>Receipt Footer</label>
              <textarea
                className={textareaClasses}
                placeholder="Thank you for your payment!"
                rows={2}
                value={settings.receipt_footer || ''}
                onChange={(e) =>
                  handleInputChange('receipt_footer', e.target.value)
                }
              />
            </div>
          </div>
        </div>

        {/* Payment Information Section */}
        <div className={`${sectionClasses} mb-6`}>
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="w-6 h-6 text-red-500" />
            <div>
              <h2 className={`text-xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Payment Information
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Payment details shown on invoices and receipts
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClasses}>Payment Instructions</label>
              <textarea
                className={textareaClasses}
                placeholder="Payment terms and instructions"
                rows={3}
                value={settings.payment_instructions || ''}
                onChange={(e) =>
                  handleInputChange('payment_instructions', e.target.value)
                }
              />
            </div>
            <div>
              <label className={labelClasses}>Bank Details</label>
              <textarea
                className={textareaClasses}
                placeholder="Bank account information"
                rows={3}
                value={settings.bank_details || ''}
                onChange={(e) =>
                  handleInputChange('bank_details', e.target.value)
                }
              />
            </div>
          </div>
        </div>

        {/* Template Selection Section */}
        <div className={`${sectionClasses} mb-6`}>
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-pink-500" />
            <div>
              <h2 className={`text-xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Default Template
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Choose your preferred document design
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() =>
                  handleInputChange('default_template', template.id)
                }
                className={`p-4 rounded-lg border-2 transition-all ${
                  settings.default_template === template.id
                    ? isDark
                      ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                      : 'border-blue-500 bg-blue-50'
                    : isDark
                      ? 'border-gray-600 hover:border-gray-500'
                      : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div
                  className={`text-left font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {template.label}
                </div>
                <div
                  className={`text-sm mt-1 ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && <Loader className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
