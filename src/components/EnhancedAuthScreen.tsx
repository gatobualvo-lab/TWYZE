import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { checkRateLimit, RATE_LIMIT_MESSAGE, checkLeakedPassword, LEAKED_PASSWORD_MESSAGE } from '../utils/security';
import { sendWelcomeEmail } from '../services/email/emailService';
import { trackEvent } from '../lib/analytics';

type Mode = 'login' | 'signup';

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EnhancedAuthScreen: React.FC = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === 'login';

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const validateSignUp = (): string | null => {
    if (!formData.name.trim()) return 'Full name is required';
    if (!EMAIL_REGEX.test(formData.email.trim())) return 'Please enter a valid email address';
    if (formData.password.length < 8) return 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const validateLogin = (): string | null => {
    if (!EMAIL_REGEX.test(formData.email.trim())) return 'Please enter a valid email address';
    if (!formData.password) return 'Password is required';
    return null;
  };

  const handleSignUp = async () => {
    const validationError = validateSignUp();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (!(await checkRateLimit('auth.signup'))) {
        setError(RATE_LIMIT_MESSAGE);
        toast.error(RATE_LIMIT_MESSAGE);
        return;
      }

      const isLeaked = await checkLeakedPassword(formData.password);
      if (isLeaked) {
        setError(LEAKED_PASSWORD_MESSAGE);
        toast.error(LEAKED_PASSWORD_MESSAGE);
        return;
      }

      const email = formData.email.trim().toLowerCase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: formData.name.trim(),
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase().includes('already')
          ? 'This email is already registered. Please log in instead.'
          : signUpError.message;
        setError(msg);
        toast.error(msg);
        return;
      }

      // If session is null, email confirmation is required.
      if (!data.session) {
        const msg = 'Account created successfully. Please check your email to confirm your account.';
        setSuccess(msg);
        toast.success('Account created. Check your email to confirm.');
        setFormData({ name: '', email: '', password: '', confirmPassword: '' });
        setMode('login');
        return;
      }

      // Email confirmation disabled - user is logged in immediately.
      toast.success('Welcome to Trackwyze!');
      sendWelcomeEmail();
      trackEvent('user_signed_up');
      navigate('/app', { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Registration failed. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    const validationError = validateLogin();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (!(await checkRateLimit('auth.login'))) {
        setError(RATE_LIMIT_MESSAGE);
        toast.error(RATE_LIMIT_MESSAGE);
        return;
      }
      const email = formData.email.trim().toLowerCase();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: formData.password,
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase().includes('invalid')
          ? 'Invalid email or password. Please try again.'
          : signInError.message.toLowerCase().includes('confirm')
            ? 'Please confirm your email before logging in.'
            : signInError.message;
        setError(msg);
        toast.error(msg);
        return;
      }

      if (!data.session) {
        const msg = 'Login failed. Please try again.';
        setError(msg);
        toast.error(msg);
        return;
      }

      // Check role for admin redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', data.user.id)
        .maybeSingle();

      toast.success(`Welcome back${profile?.full_name ? `, ${profile.full_name}` : ''}!`);
      navigate(profile?.role === 'admin' ? '/admin' : '/app', { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLogin) handleLogin();
    else handleSignUp();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-4">
          <Link to="/landing" className="flex items-center text-blue-600 hover:text-blue-800 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <img
            src="/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png"
            alt="Trackwyze Logo"
            className="w-16 h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Trackwyze</h1>
          <p className="text-blue-600 font-medium mb-4">Track Smart. Profit Wise.</p>

          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors text-sm ${
                isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors text-sm ${
                !isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  autoComplete="name"
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={e => handleInputChange('email', e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              {isLogin && (
                <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-800">
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={formData.password}
                onChange={e => handleInputChange('password', e.target.value)}
                className="pl-10 pr-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'}
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

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={e => handleInputChange('confirmPassword', e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Re-enter your password"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

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
                {isLogin ? 'Logging in...' : 'Creating account...'}
              </>
            ) : (
              isLogin ? 'Login' : 'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {isLogin ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Login
              </button>
            </>
          )}
        </div>

      </div>
      <Toaster />
    </div>
  );
};

export default EnhancedAuthScreen;
