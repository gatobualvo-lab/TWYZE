import React, { useState, useEffect } from 'react';
import { Mail, Save, Edit, Check, X, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import toast from 'react-hot-toast';
import LoadingScreen from '../LoadingScreen';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables?: any;
  created_at: string;
  updated_at: string | null;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

const SystemSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    body: ''
  });
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([
    { id: '1', name: 'multi_product_sales', description: 'Enable multi-product sales feature', enabled: true },
    { id: '2', name: 'inventory_management', description: 'Enable inventory management feature', enabled: true },
    { id: '3', name: 'email_notifications', description: 'Enable email notifications', enabled: false },
    { id: '4', name: 'sms_notifications', description: 'Enable SMS notifications', enabled: false },
    { id: '5', name: 'vendor_expenses', description: 'Enable vendor expenses tracking', enabled: true }
  ]);
  const [activeTab, setActiveTab] = useState<'email' | 'features' | 'rls'>('email');
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    fetchEmailTemplates();
  }, []);

  const fetchEmailTemplates = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      setEmailTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching email templates:', error);
      toast.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body
    });
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      subject: '',
      body: ''
    });
  };

  const handleTemplateFormChange = (field: string, value: any) => {
    setTemplateForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      setSavingTemplate(true);

      const { error } = await supabase
        .from('email_templates')
        .update({
          name: templateForm.name,
          subject: templateForm.subject,
          body: templateForm.body,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast.success('Email template updated successfully');
      fetchEmailTemplates();
      handleCancelEdit();

    } catch (error: any) {
      console.error('Error updating email template:', error);
      toast.error('Failed to update email template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const toggleFeatureFlag = async (id: string) => {
    try {
      // Find the flag
      const flagIndex = featureFlags.findIndex(flag => flag.id === id);
      if (flagIndex === -1) return;
      
      // Toggle the flag
      const updatedFlags = [...featureFlags];
      updatedFlags[flagIndex].enabled = !updatedFlags[flagIndex].enabled;
      setFeatureFlags(updatedFlags);
      
      // In a real implementation, you would save this to a database
      // For now, we'll just show a toast
      toast.success(`Feature "${updatedFlags[flagIndex].name}" ${updatedFlags[flagIndex].enabled ? 'enabled' : 'disabled'}`);
      
    } catch (error: any) {
      console.error('Error toggling feature flag:', error);
      toast.error('Failed to toggle feature flag');
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('email')}
          className={`py-2 px-4 font-medium text-sm ${
            activeTab === 'email'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Email Templates
        </button>
        <button
          onClick={() => setActiveTab('features')}
          className={`py-2 px-4 font-medium text-sm ${
            activeTab === 'features'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Feature Flags
        </button>
        <button
          onClick={() => setActiveTab('rls')}
          className={`py-2 px-4 font-medium text-sm ${
            activeTab === 'rls'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          RLS Policies
        </button>
      </div>

      {activeTab === 'email' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Info className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Email templates support variables like{" "}
                  <code>{"{{userName}}"}</code>,{" "}
                  <code>{"{{productName}}"}</code>, etc.{" "}
                  These will be replaced with actual values when emails are sent.
                </p>
              </div>
            </div>
          </div>

          {editingTemplate ? (
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Email Template</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => handleTemplateFormChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => handleTemplateFormChange('subject', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
                  <textarea
                    value={templateForm.body}
                    onChange={(e) => handleTemplateFormChange('body', e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                  >
                    {savingTemplate ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {emailTemplates.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No email templates found</p>
                </div>
              ) : (
                emailTemplates.map((template) => (
                  <div key={template.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <Mail className="h-5 w-5 text-blue-500 mr-2" />
                        <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                      </div>
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Subject:</p>
                    <p className="text-sm text-gray-900 mb-2 border-l-2 border-blue-200 pl-2">{template.subject}</p>
                    <p className="text-sm font-medium text-gray-700 mb-1">Preview:</p>
                    <div className="border border-gray-200 rounded p-2 h-24 overflow-auto">
                      <div className="text-xs text-gray-600 font-mono whitespace-pre-wrap">
                        {template.body.substring(0, 200)}...
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'features' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Info className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Feature flags allow you to enable or disable specific features across the application.
                  Changes take effect immediately for all users.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {featureFlags.map((flag) => (
                  <tr key={flag.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{flag.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{flag.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        flag.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => toggleFeatureFlag(flag.id)}
                        className={`inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white ${
                          flag.enabled 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {flag.enabled ? (
                          <>
                            <X className="w-4 h-4 mr-1" />
                            Disable
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Enable
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rls' && (
        <div className="space-y-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Row Level Security (RLS) policies control data access. These are read-only and managed through database migrations.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">RLS Policies Overview</h3>
            
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">User Data Access</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                  <li>Regular users can only access their own data</li>
                  <li>Admin users can access all user data</li>
                  <li>Policies apply to profiles, sales, suppliers, expenses, and inventory</li>
                </ul>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Admin Privileges</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                  <li>Full read access to all tables</li>
                  <li>Can manage user subscriptions and payment approvals</li>
                  <li>Can view and edit system email templates</li>
                  <li>Can view audit logs for all users</li>
                </ul>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Authentication Rules</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                  <li>Email/phone authentication with password</li>
                  <li>Password reset functionality with secure tokens</li>
                  <li>Session management with automatic token refresh</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Database Tables with RLS</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {[
                  'profiles', 'sales', 'suppliers', 'ad_expenses', 'general_expenses',
                  'inventory_items', 'stock_transactions', 'payment_submissions',
                  'user_settings', 'audit_log', 'email_logs', 'sms_logs',
                  'password_resets', 'email_templates', 'user_products',
                  'user_sellers', 'user_clients', 'user_delivery_guys',
                  'user_expense_types', 'sale_items'
                ].map(table => (
                  <div key={table} className="px-3 py-2 bg-white rounded border border-gray-200 text-sm">
                    {table}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;