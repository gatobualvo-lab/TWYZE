import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { checkLeakedPassword, LEAKED_PASSWORD_MESSAGE } from '../utils/security';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Supabase parses the recovery hash and emits PASSWORD_RECOVERY when detectSessionInUrl is enabled.
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) {
        setHasRecoverySession(true);
      }
      if (mounted) setCheckingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      const msg = 'Password must be at least 8 characters';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const isLeaked = await checkLeakedPassword(password);
      if (isLeaked) {
        setError(LEAKED_PASSWORD_MESSAGE);
        toast.error(LEAKED_PASSWORD_MESSAGE);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        toast.error(updateError.message);
        return;
      }

      setSuccess('Password updated successfully. Redirecting to login...');
      toast.success('Password updated successfully');
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update password. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Set a new password</h1>
          <p className="text-sm text-gray-600">
            Choose a strong password you haven&apos;t used before.
          </p>
        </div>

        {!hasRecoverySession ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Request new link
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="pl-10 pr-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="At least 8 characters"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Re-enter your new password"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-600">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                'Update password'
              )}
            </button>
          </form>
        )}
      </div>
      <Toaster
        position="bottom-center"
        containerStyle={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      />
    </div>
  );
};

export default ResetPasswordPage;
