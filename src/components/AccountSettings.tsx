import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, CreditCard, LogOut, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import LoadingScreen from './LoadingScreen';

interface UserProfile {
  id: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  subscription_status?: string;
  trial_end_date?: string;
  current_billing_cycle?: string;
  role?: string;
}

const AccountSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw userError;
      }
      
      if (!userData.user) {
        throw new Error('No user found');
      }
      
      setUser(userData.user);
      
      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single();
      
      if (profileError) {
        throw profileError;
      }
      
      setProfile(profileData);
      setFormData({
        fullName: profileData.full_name || '',
        phoneNumber: profileData.phone_number || '',
      });
      
    } catch (error: any) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load account data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
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

  const validateProfileForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^(\+254|0)[17]\d{8}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid Kenyan phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProfileForm()) {
      return;
    }
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone_number: formData.phoneNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);
      
      if (error) {
        throw error;
      }
      
      toast.success('Profile updated successfully');
      
      // Refresh profile data
      fetchUserData();
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSubscriptionLabel = (status?: string, cycle?: string) => {
    if (!status) return 'Unknown';
    
    switch (status) {
      case 'trial':
        return 'Free Trial';
      case 'active':
        return cycle === 'month2-3' ? 'Early Bird Plan (KES 500/month)' : 'Regular Plan (KES 1000/month)';
      case 'pending_approval':
        return 'Pending Approval';
      case 'inactive':
        return 'Inactive';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-blue-100">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800" style={{ color: '#374151' }}>
              Account Settings
            </h2>
            <p className="text-gray-600">Manage your personal information and preferences</p>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
          <User className="w-5 h-5 text-blue-600" />
          Profile Information
        </h3>
        
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className={`pl-10 w-full px-3 py-2 border ${
                  errors.fullName ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Enter your full name"
              />
            </div>
            {errors.fullName && (
              <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className={`pl-10 w-full px-3 py-2 border ${
                  errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="e.g., 0712345678"
              />
            </div>
            {errors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>
            )}
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Subscription Information */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ color: '#374151' }}>
          <CreditCard className="w-5 h-5 text-blue-600" />
          Subscription Information
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Current Plan</p>
              <p className="text-lg font-semibold text-gray-900">
                {getSubscriptionLabel(profile?.subscription_status, profile?.current_billing_cycle)}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <div className="flex items-center gap-2">
                {profile?.subscription_status === 'active' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : profile?.subscription_status === 'trial' ? (
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <p className="text-lg font-semibold text-gray-900">
                  {profile?.subscription_status === 'active' ? 'Active' : 
                   profile?.subscription_status === 'trial' ? 'Trial' : 
                   profile?.subscription_status === 'pending_approval' ? 'Pending Approval' :
                   profile?.subscription_status === 'inactive' ? 'Inactive' :
                   profile?.subscription_status === 'expired' ? 'Expired' : 'Unknown'}
                </p>
              </div>
            </div>
            
            {profile?.subscription_status === 'trial' && (
              <div>
                <p className="text-sm font-medium text-gray-700">Trial Ends</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDate(profile?.trial_end_date)}
                </p>
              </div>
            )}
            
            <div>
              <p className="text-sm font-medium text-gray-700">Billing Cycle</p>
              <p className="text-lg font-semibold text-gray-900">
                {profile?.current_billing_cycle === 'trial' ? 'Free Trial' :
                 profile?.current_billing_cycle === 'month2-3' ? 'Months 2-3 (KES 500/month)' :
                 profile?.current_billing_cycle === 'month4+' ? 'Month 4+ (KES 1000/month)' : 'Unknown'}
              </p>
            </div>
          </div>
          
          <div className="flex justify-center mt-4">
            <button
              type="button"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              onClick={() => window.location.href = '/payment-management'}
            >
              <CreditCard className="w-4 h-4" />
              Manage Subscription
            </button>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleLogout}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>
    </div>
  );
};

export default AccountSettings;