import Spinner from './ui/Spinner';
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { checkRateLimit, RATE_LIMIT_MESSAGE, checkLeakedPassword, LEAKED_PASSWORD_MESSAGE } from '../utils/security';
import { sendWelcomeEmail } from '../services/email/emailService';
import { trackEvent } from '../lib/analytics';
import { BUSINESS_CATEGORIES, REFERRAL_SOURCES } from '../constants/businessCategory';
import { ACCOUNT_CURRENCIES, DEFAULT_CURRENCY } from '../utils/accountCurrency';
import Logo from './brand/Logo';

type Mode = 'login' | 'signup';

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  businessCategory: string;
  referralSource: string;
  currency: string;
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
    businessCategory: '',
    referralSource: '',
    currency: DEFAULT_CURRENCY,
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
    if (!formData.businessCategory) return 'Please select your business type';
    if (!formData.referralSource) return 'Please tell us how you heard about Trackwyze';
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
            business_category: formData.businessCategory,
            currency: formData.currency,
            referral_source: formData.referralSource,
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
        setFormData({ name: '', email: '', password: '', confirmPassword: '', businessCategory: '', referralSource: '', currency: DEFAULT_CURRENCY });
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
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — desktop only. A quiet, moving picture of what the app does. */}
      <aside className="relative hidden lg:flex flex-col justify-between mesh-brand text-white p-12 xl:p-16 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-50" />
        <div aria-hidden="true" className="absolute -right-24 top-1/3 w-96 h-96 rounded-full bg-accent-400/20 blur-3xl" />

        <div className="relative">
          <Logo onDark markClassName="w-12 h-12" wordmarkClassName="text-3xl" showTagline />
        </div>

        <div className="relative max-w-lg">
          <p className="text-xs uppercase tracking-[0.22em] text-white/55 font-semibold mb-4">Built for small business owners</p>
          <h2 className="font-display text-5xl xl:text-6xl font-extrabold leading-[1.02] tracking-tight text-white">
            Know exactly what you <span className="text-gradient">made today.</span>
          </h2>
          <p className="mt-5 text-lg text-white/70 max-w-md">
            Sales, stock, expenses and customers in one calm place. Works even when the internet doesn't.
          </p>
        </div>

        {/* Floating "product" cards — decorative */}
        <div aria-hidden="true" className="relative h-52">
          <div className="absolute left-0 top-2 w-60 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 shadow-xl animate-reveal-up" style={{ animationDelay: '350ms' }}>
            <p className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">Today's sales</p>
            <p className="font-display text-3xl font-extrabold mt-1 tabular-nums">KES 48,500</p>
            <p className="text-xs text-emerald-300 font-semibold mt-1">▲ 12% vs yesterday</p>
          </div>
          <div className="absolute left-48 top-24 w-56 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 shadow-xl animate-reveal-up" style={{ animationDelay: '550ms' }}>
            <p className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">Profit this week</p>
            <svg viewBox="0 0 200 56" className="mt-2 w-full h-12">
              <defs>
                <linearGradient id="authSpark" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#34d399" stopOpacity="0.5" />
                  <stop offset="1" stopColor="#34d399" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 44 C20 40 30 22 52 28 S90 50 112 30 S160 8 200 14 V56 H0 Z" fill="url(#authSpark)" />
              <path d="M0 44 C20 40 30 22 52 28 S90 50 112 30 S160 8 200 14" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" pathLength="1" strokeDasharray="1" className="animate-[draw-line_2.4s_ease-out_both]" />
            </svg>
          </div>
          <div className="absolute right-0 top-0 hidden xl:flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-2 shadow-lg animate-reveal-up" style={{ animationDelay: '750ms' }}>
            <span className="w-2 h-2 rounded-full bg-accent-400" />
            <span className="text-xs font-semibold text-white/85">Office chair: 3 left</span>
          </div>
        </div>
      </aside>

      <div className="flex items-center justify-center p-4 sm:p-8 min-h-screen">
      <div className="w-full max-w-md bg-white/85 backdrop-blur-xl rounded-3xl shadow-xl border border-white/70 ring-1 ring-gray-200/70 p-7 sm:p-9 animate-reveal-up">
        <div className="mb-4">
          <Link to="/landing" className="flex items-center text-blue-600 hover:text-blue-800 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-5 lg:hidden">
            <Logo markClassName="w-12 h-12" wordmarkClassName="text-3xl" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-gray-900 mb-1 tracking-tight">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="text-gray-500 mb-6">{isLogin ? 'Log in to see how your business is doing.' : 'Start tracking sales, stock and profit in minutes.'}</p>

          <div className="relative grid grid-cols-2 bg-gray-100 rounded-xl p-1">
            <span
              aria-hidden="true"
              className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-md transition-transform duration-300 ease-spring ${isLogin ? 'translate-x-0' : 'translate-x-full'}`}
            />
            <button
              type="button"
              onClick={() => switchMode('login')}
              aria-pressed={isLogin}
              className={`relative z-10 py-2 px-4 rounded-lg font-semibold transition-colors duration-200 text-sm ${isLogin ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              aria-pressed={!isLogin}
              className={`relative z-10 py-2 px-4 rounded-lg font-semibold transition-colors duration-200 text-sm ${!isLogin ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
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

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What kind of business is it?
              </label>
              <select
                value={formData.businessCategory}
                onChange={e => handleInputChange('businessCategory', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                disabled={isSubmitting}
              >
                <option value="" disabled>Select your business type</option>
                {BUSINESS_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Which currency do you work in?
              </label>
              <select
                value={formData.currency}
                onChange={e => handleInputChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                disabled={isSubmitting}
              >
                {ACCOUNT_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Prices, sales and reports will all use this. You can change it later in Account Settings.</p>
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How did you hear about Trackwyze?
              </label>
              <select
                value={formData.referralSource}
                onChange={e => handleInputChange('referralSource', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                disabled={isSubmitting}
              >
                <option value="" disabled>Select an option</option>
                {REFERRAL_SOURCES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div role="status" className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="sheen-host w-full bg-gradient-to-b from-blue-500 to-blue-700 hover:shadow-glow disabled:from-blue-300 disabled:to-blue-300 disabled:shadow-none text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-inset transition-all duration-200 ease-smooth active:scale-[0.98] flex items-center justify-center gap-2 min-h-[50px]"
          >
            {isSubmitting ? (
              <>
                <Spinner className="w-4 h-4" tone="light" />
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
      </div>
      <Toaster
        position="bottom-center"
        containerStyle={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      />
    </div>
  );
};

export default EnhancedAuthScreen;
