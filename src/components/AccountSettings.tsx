import Spinner from './ui/Spinner';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, CreditCard, LogOut, Save, AlertCircle, CheckCircle, Briefcase, Lock, Eye, EyeOff, ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import LoadingScreen from './LoadingScreen';
import { PageHeader } from './ui';
import { getSubscriptionPlanLabel, getSubscriptionStatusLabel, getBillingCycleLabel } from '../utils/subscription';
import { BUSINESS_CATEGORIES } from '../constants/businessCategory';
import { ACCOUNT_CURRENCIES, setAccountCurrency } from '../utils/accountCurrency';
import MfaEnroll from './admin/MfaEnroll';
import { sendPasswordChangedEmail } from '../services/email/emailService';

interface UserProfile {
  id: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  business_category?: string | null;
  currency?: string;
  subscription_status?: string;
  trial_end_date?: string;
  current_billing_cycle?: string;
  role?: string;
}

const AccountSettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    businessCategory: '',
    currency: 'KES',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [disablingMfa, setDisablingMfa] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verified = data.totp.find(f => f.status === 'verified');
      setMfaFactorId(verified?.id ?? null);
    } catch (error: any) {
      console.error('Error fetching 2FA status:', error);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!mfaFactorId) return;
    if (!window.confirm('Turn off two-factor authentication? Admin accounts are strongly encouraged to keep it on.')) return;

    setDisablingMfa(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      setMfaFactorId(null);
      toast.success('Two-factor authentication turned off');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to turn off two-factor authentication');
    } finally {
      setDisablingMfa(false);
    }
  };

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
        businessCategory: profileData.business_category || '',
        currency: profileData.currency || 'KES',
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
      // Take the user to the first field that needs fixing.
      window.setTimeout(() => {
        const target = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target?.focus({ preventScroll: true });
      }, 60);
      return;
    }
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone_number: formData.phoneNumber,
          business_category: formData.businessCategory || null,
          currency: formData.currency,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);
      
      if (error) {
        throw error;
      }
      
      setAccountCurrency(formData.currency);
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!passwordForm.currentPassword) newErrors.currentPassword = 'Enter your current password';
    if (passwordForm.newPassword.length < 8) {
      newErrors.newPassword = 'Use at least 8 characters';
    } else if (!/[a-zA-Z]/.test(passwordForm.newPassword) || !/[0-9]/.test(passwordForm.newPassword)) {
      newErrors.newPassword = 'Mix letters and numbers';
    } else if (passwordForm.newPassword === passwordForm.currentPassword) {
      newErrors.newPassword = 'Choose a password different from your current one';
    }
    if (passwordForm.confirmPassword !== passwordForm.newPassword) newErrors.confirmPassword = 'Passwords do not match';
    setPasswordErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setChangingPassword(true);

      // Re-authenticate with the current password first. updateUser() alone doesn't check it —
      // anyone at an unlocked, already-logged-in session could otherwise set a new password
      // without ever knowing the old one, locking the real owner out.
      if (!user?.email) throw new Error('Could not verify your account email');
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword,
      });
      if (reauthError) {
        setPasswordErrors({ currentPassword: 'Current password is incorrect' });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      toast.success('Password updated');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      sendPasswordChangedEmail();
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
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

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={User} title="Account Settings" />

      {/* Profile Information */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                id="field-fullName"
                aria-invalid={errors.fullName ? true : undefined}
                aria-describedby={errors.fullName ? 'field-fullName-error' : undefined}
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className={`pl-10 w-full px-3 py-2 border ${
                  errors.fullName ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Enter your full name"
              />
            </div>
            {errors.fullName && (
              <p id="field-fullName-error" role="alert" className="mt-1 text-sm text-red-600">{errors.fullName}</p>
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
                id="field-phoneNumber"
                aria-invalid={errors.phoneNumber ? true : undefined}
                aria-describedby={errors.phoneNumber ? 'field-phoneNumber-error' : undefined}
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className={`pl-10 w-full px-3 py-2 border ${
                  errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="e.g., 0712345678"
              />
            </div>
            {errors.phoneNumber && (
              <p id="field-phoneNumber-error" role="alert" className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>
            )}
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Type
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={formData.businessCategory}
                onChange={(e) => handleInputChange('businessCategory', e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Not set</option>
                {BUSINESS_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => handleInputChange('currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {ACCOUNT_CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Used for every price and report. Changing it relabels your existing amounts; it does not convert them.</p>
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
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Spinner className="w-4 h-4" tone="light" />
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

      {/* Change Password */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-600" />
          Change Password
        </h3>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={passwordErrors.currentPassword ? true : undefined}
                aria-describedby={passwordErrors.currentPassword ? 'field-currentPassword-error' : undefined}
                value={passwordForm.currentPassword}
                onChange={(e) => { setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value })); setPasswordErrors({}); }}
                className={`pl-10 w-full px-3 py-2 border ${
                  passwordErrors.currentPassword ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Your current password"
              />
            </div>
            {passwordErrors.currentPassword && (
              <p id="field-currentPassword-error" role="alert" className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={passwordErrors.newPassword ? true : undefined}
                aria-describedby={passwordErrors.newPassword ? 'field-newPassword-error' : undefined}
                value={passwordForm.newPassword}
                onChange={(e) => { setPasswordForm(prev => ({ ...prev, newPassword: e.target.value })); setPasswordErrors({}); }}
                className={`pl-10 pr-11 w-full px-3 py-2 border ${
                  passwordErrors.newPassword ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="At least 8 characters, with a letter and a number"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(v => !v)}
                aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                className="min-h-[44px] min-w-[44px] absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordErrors.newPassword && (
              <p id="field-newPassword-error" role="alert" className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={passwordErrors.confirmPassword ? true : undefined}
                aria-describedby={passwordErrors.confirmPassword ? 'field-confirmPassword-error' : undefined}
                value={passwordForm.confirmPassword}
                onChange={(e) => { setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value })); setPasswordErrors({}); }}
                className={`pl-10 w-full px-3 py-2 border ${
                  passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Type it again"
              />
            </div>
            {passwordErrors.confirmPassword && (
              <p id="field-confirmPassword-error" role="alert" className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword}</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
              className="min-h-[44px] px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {changingPassword ? (
                <>
                  <Spinner className="w-4 h-4" tone="light" />
                  Updating…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Update Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Two-Factor Authentication (admins only) */}
      {profile?.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Two-Factor Authentication
          </h3>

          {mfaLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner className="w-6 h-6" tone="brand" />
            </div>
          ) : showMfaSetup ? (
            <MfaEnroll
              onEnrolled={() => { setShowMfaSetup(false); fetchMfaStatus(); }}
              onCancel={() => setShowMfaSetup(false)}
              title="Set up two-factor authentication"
              description="Scan the QR code with an authenticator app, then enter the 6-digit code it shows."
            />
          ) : mfaFactorId ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <ShieldCheck className="w-4 h-4" />
                Enabled — required for admin access to the admin panel.
              </div>
              <button
                type="button"
                onClick={handleDisableMfa}
                disabled={disablingMfa}
                className="min-h-[40px] px-3 inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
              >
                {disablingMfa ? <Spinner className="w-4 h-4" tone="light" /> : <ShieldOff className="w-4 h-4" />}
                Turn off
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="w-4 h-4" />
                Not set up yet — you'll be asked to enable it next time you open the Admin Panel.
              </div>
              <button
                type="button"
                onClick={() => setShowMfaSetup(true)}
                className="min-h-[40px] px-3 inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
              >
                <ShieldCheck className="w-4 h-4" />
                Set up now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Subscription Information */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" />
          Subscription Information
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Current Plan</p>
              <p className="text-lg font-semibold text-gray-900">
                {getSubscriptionPlanLabel(profile?.subscription_status, profile?.current_billing_cycle)}
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
                  {getSubscriptionStatusLabel(profile?.subscription_status)}
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
                {getBillingCycleLabel(profile?.current_billing_cycle)}
              </p>
            </div>
          </div>
          
          <div className="flex justify-center mt-4">
            <button
              type="button"
              className="min-h-[44px] px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              onClick={() => navigate('/payment-management')}
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