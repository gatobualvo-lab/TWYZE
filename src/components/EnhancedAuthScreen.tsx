import Spinner from './ui/Spinner';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle, Check, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { checkRateLimit, RATE_LIMIT_MESSAGE, checkLeakedPassword, LEAKED_PASSWORD_MESSAGE } from '../utils/security';
import { sendWelcomeEmail } from '../services/email/emailService';
import { trackEvent } from '../lib/analytics';
import { BUSINESS_CATEGORIES, REFERRAL_SOURCES } from '../constants/businessCategory';
import { ACCOUNT_CURRENCIES, DEFAULT_CURRENCY } from '../utils/accountCurrency';
import Logo from './brand/Logo';
import { usePageMeta } from '../utils/pageMeta';
import { AGE_GROUPS, isAllowedAgeGroup, UNDER_AGE_MESSAGE } from '../utils/ageGroup';
import { TERMS_VERSION } from '../constants/legal';
import CheckEmailPanel from './auth/CheckEmailPanel';

type Mode = 'login' | 'signup';

interface FormData {
  name: string;
  email: string;
  password: string;
  businessCategory: string;
  referralSource: string;
  currency: string;
  /** The age group ticked on the form (under 18 cannot sign up). */
  ageGroup: string;
  /** Agreed to the Terms of Service and Privacy Policy (required to sign up). */
  acceptedTerms: boolean;
  /** The "email me" tick box. Off until the person ticks it. */
  emailOptIn: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** Signup is two short steps instead of one long form: first the account, then the business. */
type SignupStep = 1 | 2;

const EnhancedAuthScreen: React.FC = () => {
  usePageMeta({
    title: 'Log in or Create a Free Account | Trackwyze',
    description: 'Log in to Trackwyze, or create your account and get your first month free. Track sales, stock, expenses and profit for your business.',
    path: '/login',
  });
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    businessCategory: '',
    referralSource: '',
    currency: DEFAULT_CURRENCY,
    ageGroup: '',
    acceptedTerms: false,
    emailOptIn: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<SignupStep>(1);
  /** Set once the account exists but the email still has to be confirmed. */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const signupStartedTracked = useRef(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const isLogin = mode === 'login';

  // Moving between steps puts keyboard and screen-reader focus on the new step's heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const validateAccountStep = (): string | null => {
    if (!formData.name.trim()) return 'Full name is required';
    if (!EMAIL_REGEX.test(formData.email.trim())) return 'Please enter a valid email address';
    if (formData.password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    return null;
  };

  const validateSignUp = (): string | null => {
    const accountError = validateAccountStep();
    if (accountError) return accountError;
    if (!formData.businessCategory) return 'Please select your business type';
    if (!formData.referralSource) return 'Please tell us how you heard about Trackwyze';
    if (!formData.ageGroup) return 'Please tick your age group';
    if (!isAllowedAgeGroup(formData.ageGroup)) return UNDER_AGE_MESSAGE;
    if (!formData.acceptedTerms) return 'Please agree to the Terms of Service and Privacy Policy';
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
      trackEvent(validationError === UNDER_AGE_MESSAGE ? 'signup_blocked_under_age' : 'signup_validation_failed', { step: 2, reason: validationError });
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    trackEvent('signup_submitted');
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
            age_group: formData.ageGroup,
            terms_accepted: formData.acceptedTerms,
            terms_version: TERMS_VERSION,
            email_opt_in: formData.emailOptIn,
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

      // With email confirmation on, Supabase answers "success" for an address that already has an account,
      // without creating one or sending anything (so as not to reveal it). It shows as a user with no identities.
      if (!data.session && Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        const msg = 'This email is already registered. Please log in instead.';
        setError(msg);
        toast.error(msg);
        return;
      }

      // If session is null, email confirmation is required: tell the person what to do next.
      if (!data.session) {
        trackEvent('user_signed_up', { needs_confirmation: true });
        trackEvent('signup_check_email_shown');
        setFormData(prev => ({ ...prev, password: '' }));
        setPendingEmail(email);
        return;
      }

      // Email confirmation disabled - user is logged in immediately.
      toast.success('Welcome to Trackwyze!');
      if (formData.emailOptIn) sendWelcomeEmail(); // only to people who ticked the box
      trackEvent('user_signed_up', { needs_confirmation: false });
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

  const resendConfirmation = async () => {
    if (!pendingEmail) return;
    trackEvent('signup_email_resent');
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (resendError) {
      throw new Error(/rate|seconds|too many/i.test(resendError.message) ? 'Please wait a little before asking for another email.' : 'Could not send the email. Please try again shortly.');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLogin) {
      handleLogin();
    } else if (step === 1) {
      const accountError = validateAccountStep();
      if (accountError) {
        trackEvent('signup_validation_failed', { step: 1, reason: accountError });
        setError(accountError);
        return;
      }
      setError('');
      trackEvent('signup_step_completed', { step: 1 });
      setStep(2);
    } else {
      handleSignUp();
    }
  };

  const switchMode = (next: Mode) => {
    setStep(1);
    setPendingEmail(null);
    if (next === 'signup' && !signupStartedTracked.current) {
      signupStartedTracked.current = true;
      trackEvent('signup_started');
    }
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

        {pendingEmail ? (
          <CheckEmailPanel
            email={pendingEmail}
            onResend={resendConfirmation}
            onChangeEmail={() => { setPendingEmail(null); setMode('signup'); setStep(1); }}
            onLogin={() => switchMode('login')}
          />
        ) : (
        <>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5 lg:hidden">
            <Logo markClassName="w-12 h-12" wordmarkClassName="text-3xl" />
          </div>
          <h1 ref={stepHeadingRef} tabIndex={-1} className="font-display text-3xl font-extrabold text-gray-900 mb-1 tracking-tight outline-none">
            {isLogin ? 'Welcome back' : step === 1 ? 'Create your account' : 'About your business'}
          </h1>
          <p className="text-gray-500 mb-4">
            {isLogin ? 'Log in to see how your business is doing.' : step === 1 ? 'Start tracking sales, stock and profit in minutes.' : 'Almost done. This helps us set up the app for you.'}
          </p>
          {!isLogin && step === 1 && (
            <p className="mb-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-emerald-700">
              <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden="true" /> First month free</span>
              <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden="true" /> No credit card</span>
              <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Cancel anytime</span>
            </p>
          )}

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

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <div className="mb-1">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                <span>Step {step} of 2</span>
                <span>{step === 1 ? 'Your account' : 'Your business'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2" role="progressbar" aria-label="Signup progress" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step}>
                <span className="h-1.5 rounded-full bg-blue-600" />
                <span className={`h-1.5 rounded-full transition-colors duration-300 ${step === 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              </div>
            </div>
          )}

          {(isLogin || step === 1) && (
            <>
              {!isLogin && (
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      value={formData.name}
                      onChange={e => handleInputChange('name', e.target.value)}
                      className="pl-10 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your full name"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <input
                    id="auth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                    className="pl-10 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700">Password</label>
                  {isLogin && (
                    <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-800">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={formData.password}
                    onChange={e => handleInputChange('password', e.target.value)}
                    className="pl-10 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-11"
                    placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                {!isLogin && (
                  <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${formData.password.length >= MIN_PASSWORD_LENGTH ? 'text-emerald-700' : 'text-gray-500'}`}>
                    <Check className={`w-3.5 h-3.5 ${formData.password.length >= MIN_PASSWORD_LENGTH ? '' : 'opacity-30'}`} aria-hidden="true" />
                    At least {MIN_PASSWORD_LENGTH} characters
                  </p>
                )}
              </div>
            </>
          )}

          {!isLogin && step === 2 && (
            <>
              <div>
                <label htmlFor="signup-business" className="block text-sm font-medium text-gray-700 mb-1.5">What kind of business is it?</label>
                <select
                  id="signup-business"
                  value={formData.businessCategory}
                  onChange={e => handleInputChange('businessCategory', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  disabled={isSubmitting}
                >
                  <option value="" disabled>Select your business type</option>
                  {BUSINESS_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="signup-currency" className="block text-sm font-medium text-gray-700 mb-1.5">Which currency do you work in?</label>
                <select
                  id="signup-currency"
                  value={formData.currency}
                  onChange={e => handleInputChange('currency', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  disabled={isSubmitting}
                >
                  {ACCOUNT_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="signup-referral" className="block text-sm font-medium text-gray-700 mb-1.5">How did you hear about Trackwyze?</label>
                <select
                  id="signup-referral"
                  value={formData.referralSource}
                  onChange={e => handleInputChange('referralSource', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  disabled={isSubmitting}
                >
                  <option value="" disabled>Select an option</option>
                  {REFERRAL_SOURCES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <fieldset disabled={isSubmitting}>
                <legend className="block text-sm font-medium text-gray-700 mb-1.5">Your age</legend>
                <div className="grid grid-cols-3 gap-2">
                  {AGE_GROUPS.map(group => (
                    <label
                      key={group.value}
                      className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${
                        formData.ageGroup === group.value ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="age-group"
                        value={group.value}
                        checked={formData.ageGroup === group.value}
                        onChange={() => handleInputChange('ageGroup', group.value)}
                        className="sr-only"
                      />
                      {group.label}
                    </label>
                  ))}
                </div>
                {formData.ageGroup === 'under_18' && (
                  <p role="alert" className="mt-2 text-sm text-red-600">{UNDER_AGE_MESSAGE}</p>
                )}
              </fieldset>

              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={formData.emailOptIn}
                  onChange={e => setFormData(prev => ({ ...prev, emailOptIn: e.target.checked }))}
                  disabled={isSubmitting}
                  className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Email me reminders, business reports and tips.
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Optional. You can unsubscribe at any time, and payment receipts are always sent.
                  </span>
                </span>
              </label>
            </>
          )}

          {!isLogin && step === 2 && (
            <label className="flex items-start gap-3 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.acceptedTerms}
                onChange={e => { setError(''); setFormData(prev => ({ ...prev, acceptedTerms: e.target.checked })); }}
                disabled={isSubmitting}
                className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300"
              />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">Terms of Service</a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">Privacy Policy</a>.
              </span>
            </label>
          )}

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div role="status" className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          <div className="flex gap-3">
            {!isLogin && step === 2 && (
              <button
                type="button"
                onClick={() => { setError(''); setStep(1); }}
                disabled={isSubmitting}
                className="min-h-[50px] rounded-xl border border-gray-300 px-5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="sheen-host flex-1 bg-gradient-to-b from-blue-500 to-blue-700 hover:shadow-glow disabled:from-blue-300 disabled:to-blue-300 disabled:shadow-none text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-inset transition-all duration-200 ease-smooth active:scale-[0.98] flex items-center justify-center gap-2 min-h-[50px]"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="w-4 h-4" tone="light" />
                  {isLogin ? 'Logging in...' : 'Creating account...'}
                </>
              ) : isLogin ? (
                'Login'
              ) : step === 1 ? (
                'Continue'
              ) : (
                'Create account'
              )}
            </button>
          </div>

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
        </>
        )}

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
