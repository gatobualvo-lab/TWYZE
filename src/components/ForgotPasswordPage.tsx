import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast, { Toaster } from 'react-hot-toast';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!EMAIL_REGEX.test(email.trim())) {
      const msg = 'Please enter a valid email address';
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        toast.error(resetError.message);
        return;
      }

      const msg = 'Password reset link sent. Please check your email.';
      setSuccess(msg);
      toast.success(msg);
      setEmail('');
    } catch (err: any) {
      const msg = err?.message || 'Failed to send reset link. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-4">
          <Link to="/login" className="flex items-center text-blue-600 hover:text-blue-800 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Login
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Forgot password?</h1>
          <p className="text-sm text-gray-600">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setError('');
                  setSuccess('');
                }}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
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
                Sending link...
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Remembered it?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Login
          </Link>
        </div>
      </div>
      <Toaster
        position="bottom-center"
        containerStyle={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      />
    </div>
  );
};

export default ForgotPasswordPage;
