import Spinner from '../components/ui/Spinner';
import { getAccountCurrency } from '../utils/accountCurrency';
import React, { useEffect, useState } from 'react';
import { useFormErrors } from '../hooks/useFormErrors';
import FieldError from '../components/ui/FieldError';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, CheckCircle, AlertCircle, Clock, XCircle, Upload, ExternalLink, Image as ImageIcon,
  Smartphone, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, PageHeader, EmptyState, SkeletonPage } from '../components/ui';
import { formatCurrency, formatDate } from '../utils/format';
import {
  getSubscriptionPlanLabel, getSubscriptionStatusLabel, getBillingCycleLabel, BILLING_PLANS,
} from '../utils/subscription';
import type { BillingPlanKey } from '../utils/subscription';
import {
  fetchMySubscription, listMyPaymentSubmissions, submitPayment, getScreenshotSignedUrl,
  createCheckoutSession, waitForSubmissionResolution,
  startMpesaPayment, waitForMpesaPayment, fetchMyPhone, MpesaNotConfiguredError,
} from '../services/payments/paymentService';
import { formatKenyanPhone, normalizeKenyanPhone } from '../utils/mpesaPhone';
import { useEntitlements } from '../contexts/EntitlementsContext';
import { TIER_LABELS, TIER_ORDER, TIER_PITCH, TIER_PRICES } from '../services/subscription/entitlements';
import type { SubscriptionInfo, MyPaymentSubmission } from '../services/payments/paymentService';
import { openFlutterwaveCheckout } from '../services/payments/flutterwaveCheckout';

const PAYMENT_METHODS = ['M-Pesa', 'Bank Transfer', 'Other'] as const;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

type CheckoutMethod = 'mpesa' | 'card';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
};

const PaymentManagement: React.FC = () => {
  const navigate = useNavigate();
  const { entitlements } = useEntitlements();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [submissions, setSubmissions] = useState<MyPaymentSubmission[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('M-Pesa');
  const [transactionReference, setTransactionReference] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { errors, fail, field, formRef } = useFormErrors<'amount' | 'transactionReference'>();

  const [selectedPlan, setSelectedPlan] = useState<BillingPlanKey>('starter');
  const [checkoutMethod, setCheckoutMethod] = useState<CheckoutMethod | null>(null);
  const [verifying, setVerifying] = useState(false);

  // M-Pesa STK push: type the number, get the PIN prompt on the phone, wait for the result.
  const [mpesaStage, setMpesaStage] = useState<'closed' | 'form' | 'sending' | 'waiting'>('closed');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaPhoneError, setMpesaPhoneError] = useState('');
  const [mpesaResult, setMpesaResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadData = async () => {
    try {
      const [sub, subs] = await Promise.all([fetchMySubscription(), listMyPaymentSubmissions()]);
      setSubscription(sub);
      setSubmissions(subs);
    } catch (error: any) {
      console.error('Error loading payment management data:', error);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    fetchMyPhone().then(phone => setMpesaPhone(current => current || phone)).catch(() => { /* typed in by hand instead */ });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_SCREENSHOT_BYTES) {
      toast.error('Screenshot must be under 5MB');
      e.target.value = '';
      return;
    }
    setScreenshotFile(file);
  };

  const handlePayNow = async (method: CheckoutMethod) => {
    setCheckoutMethod(method);
    try {
      const session = await createCheckoutSession(selectedPlan, method);
      await openFlutterwaveCheckout({
        publicKey: session.publicKey,
        txRef: session.txRef,
        amount: session.amount,
        currency: session.currency,
        paymentOptions: session.paymentOptions,
        customer: session.customer,
        title: 'TrackWyze Subscription',
        description: `${BILLING_PLANS[selectedPlan].label} — ${formatCurrency(session.amount)}`,
        onComplete: async (response) => {
          setCheckoutMethod(null);
          if (response.status !== 'successful' && response.status !== 'completed') {
            toast.error('Payment was not completed');
            return;
          }
          setVerifying(true);
          const resolved = await waitForSubmissionResolution(session.txRef);
          setVerifying(false);
          if (!resolved) {
            toast('Still verifying with the payment provider — check back in a minute.', { icon: '⏳' });
          } else if (resolved.status === 'approved') {
            toast.success('Payment confirmed — your subscription is active!');
          } else {
            toast.error(resolved.adminNotes || 'Payment could not be verified');
          }
          await loadData();
        },
        onClose: () => {
          setCheckoutMethod(null);
        },
      });
    } catch (error: any) {
      console.error('Error starting checkout:', error);
      toast.error(error.message || 'Failed to start checkout');
      setCheckoutMethod(null);
    }
  };

  const openMpesa = () => {
    setMpesaResult(null);
    setMpesaPhoneError('');
    setMpesaStage('form');
  };

  const handleMpesaSend = async () => {
    const normalized = normalizeKenyanPhone(mpesaPhone);
    if (!normalized) {
      setMpesaPhoneError('Enter a valid M-Pesa number, for example 0712 345 678.');
      return;
    }
    setMpesaPhoneError('');
    setMpesaResult(null);
    setMpesaStage('sending');
    try {
      const session = await startMpesaPayment(selectedPlan, normalized);
      setMpesaPhone(formatKenyanPhone(normalized));
      setMpesaStage('waiting');
      const resolved = await waitForMpesaPayment(session.txRef);
      setMpesaStage('form');
      if (!resolved) {
        setMpesaResult({ ok: false, message: 'We have not heard back from M-Pesa yet. If you entered your PIN, check this page again in a minute; your subscription will activate on its own.' });
      } else if (resolved.status === 'approved') {
        setMpesaResult({ ok: true, message: 'Payment received. Your subscription is active.' });
        toast.success('Payment confirmed: your subscription is active!');
      } else {
        setMpesaResult({ ok: false, message: (resolved.adminNotes || 'The payment was not completed.').replace(/^M-Pesa: /, '') });
      }
      await loadData();
    } catch (error: any) {
      if (error instanceof MpesaNotConfiguredError) {
        // Not switched on yet: use the existing M-Pesa checkout instead.
        setMpesaStage('closed');
        await handlePayNow('mpesa');
        return;
      }
      setMpesaStage('form');
      setMpesaResult({ ok: false, message: error.message || 'Could not send the M-Pesa request.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountValue = Number(amount);
    const problems: { amount?: string; transactionReference?: string } = {};
    if (!amountValue || amountValue <= 0) problems.amount = 'Enter the amount you paid';
    if (!transactionReference.trim()) problems.transactionReference = 'Enter the transaction reference (for example the M-Pesa code)';
    if (Object.keys(problems).length > 0) {
      toast.error('Please fix the highlighted fields');
      return fail(problems);
    }

    try {
      setSubmitting(true);
      await submitPayment({
        amount: amountValue,
        paymentMethod,
        transactionReference: transactionReference.trim(),
        screenshotFile,
      });
      toast.success('Payment submitted for review');
      setAmount('');
      setTransactionReference('');
      setScreenshotFile(null);
      const fileInput = document.getElementById('screenshot-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      await loadData();
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      toast.error(error.message || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewProof = async (path: string) => {
    try {
      const url = await getScreenshotSignedUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      toast.error('Failed to load proof screenshot');
    }
  };

  if (loading) {
    return <SkeletonPage />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Manage Subscription"
        description="Review your plan, submit a payment, and track past submissions."
        actions={
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Account
          </button>
        }
      />

      {/* Subscription Summary */}
      <Card>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" />
          Current Subscription
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Current Plan</p>
            <p className="text-lg font-semibold text-gray-900">
              {getSubscriptionPlanLabel(subscription?.status, subscription?.billingCycle)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Status</p>
            <div className="flex items-center gap-2">
              {subscription?.status === 'active' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : subscription?.status === 'trial' ? (
                <CheckCircle className="w-4 h-4 text-blue-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <p className="text-lg font-semibold text-gray-900">
                {getSubscriptionStatusLabel(subscription?.status)}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              {subscription?.status === 'trial' ? 'Trial Ends' : 'Expires'}
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {subscription?.status === 'trial'
                ? formatDate(subscription?.trialEndDate, { year: 'numeric', month: 'long', day: 'numeric' }) || 'N/A'
                : formatDate(subscription?.subscriptionExpiry, { year: 'numeric', month: 'long', day: 'numeric' }) || 'N/A'}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700">Billing Cycle</p>
          <p className="text-base text-gray-900">{getBillingCycleLabel(subscription?.billingCycle)}</p>
        </div>
      </Card>

      {/* Plans and Pay Now */}
      <Card>
        <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          Choose your plan
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Your first month is free with every feature. After that you can stay on Free, or pay monthly for Starter or Business. Your plan switches on automatically once payment is confirmed.
        </p>

        {entitlements.source === 'free-month' && (
          <p className="mb-4 rounded-lg bg-accent-50 border border-accent-200 px-3 py-2 text-sm text-accent-900">
            You are in your free month ({entitlements.freeMonthDaysLeft} day{entitlements.freeMonthDaysLeft === 1 ? '' : 's'} left), so everything is included. Choose a plan to keep these features after that.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {TIER_ORDER.map(tierKey => {
            const paid = tierKey !== 'free';
            const isCurrent = entitlements.source !== 'free-month' && entitlements.tier === tierKey;
            const selected = paid && selectedPlan === tierKey;
            const body = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display font-bold text-gray-900">{TIER_LABELS[tierKey]}</p>
                  {isCurrent && <span className="rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-[11px] font-semibold">Your plan</span>}
                </div>
                <p className="mt-1 text-2xl font-extrabold text-gray-900">
                  {paid ? formatCurrency(TIER_PRICES[tierKey]) : 'KES 0'}
                  <span className="text-sm font-medium text-gray-500">{paid ? ' / month' : ' always'}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{TIER_PITCH[tierKey].tagline}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                  {TIER_PITCH[tierKey].highlights.map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            );
            return paid ? (
              <button
                key={tierKey}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedPlan(tierKey as BillingPlanKey)}
                className={`text-left p-4 rounded-xl border-2 transition-colors ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                {body}
              </button>
            ) : (
              <div key={tierKey} className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
                {body}
              </div>
            );
          })}
        </div>

        <p className="text-sm font-medium text-gray-700 mb-2">
          Pay for {BILLING_PLANS[selectedPlan].label}: {formatCurrency(BILLING_PLANS[selectedPlan].amount)} for 30 days
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={openMpesa}
            disabled={checkoutMethod !== null || verifying || mpesaStage === 'sending' || mpesaStage === 'waiting'}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
          >
            {checkoutMethod === 'mpesa' ? (
              <Spinner className="w-4 h-4" tone="light" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
            Pay with M-Pesa
          </button>
          <button
            type="button"
            onClick={() => handlePayNow('card')}
            disabled={checkoutMethod !== null || verifying}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {checkoutMethod === 'card' ? (
              <Spinner className="w-4 h-4" tone="light" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Pay with Card
          </button>
        </div>

        {mpesaStage !== 'closed' && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4" aria-live="polite">
            <p className="font-semibold text-green-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4" aria-hidden="true" />
              Pay {formatCurrency(BILLING_PLANS[selectedPlan].amount)} with M-Pesa
            </p>

            {mpesaStage === 'waiting' ? (
              <div className="mt-3 flex items-start gap-3 text-sm text-green-900">
                <Spinner className="w-5 h-5 mt-0.5" tone="brand" />
                <div>
                  <p className="font-medium">Check your phone ({mpesaPhone})</p>
                  <p className="text-green-800">Enter your M-Pesa PIN to pay. This page updates by itself as soon as the payment is confirmed. Please do not close it.</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-green-800 mt-1">We will send a payment request to your phone. Enter your M-Pesa PIN to approve it.</p>
                <label htmlFor="mpesa-phone" className="block text-sm font-medium text-gray-700 mt-3 mb-1">M-Pesa phone number</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="mpesa-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={mpesaPhone}
                    onChange={(e) => { setMpesaPhone(e.target.value); setMpesaPhoneError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMpesaSend(); } }}
                    placeholder="0712 345 678"
                    aria-invalid={mpesaPhoneError ? true : undefined}
                    aria-describedby={mpesaPhoneError ? 'mpesa-phone-error' : undefined}
                    disabled={mpesaStage === 'sending'}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleMpesaSend}
                    disabled={mpesaStage === 'sending'}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {mpesaStage === 'sending' && <Spinner className="w-4 h-4" tone="light" />}
                    {mpesaStage === 'sending' ? 'Sending…' : mpesaResult && !mpesaResult.ok ? 'Try again' : 'Send request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMpesaStage('closed')}
                    disabled={mpesaStage === 'sending'}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
                {mpesaPhoneError && <p id="mpesa-phone-error" role="alert" className="text-sm text-red-600 mt-1">{mpesaPhoneError}</p>}
              </>
            )}

            {mpesaResult && (
              <p role={mpesaResult.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-medium ${mpesaResult.ok ? 'text-green-800' : 'text-red-700'}`}>
                {mpesaResult.message}
              </p>
            )}
          </div>
        )}

        {verifying && (
          <div className="mt-4 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
            <Spinner className="w-4 h-4" tone="brand" />
            Confirming your payment with the provider…
          </div>
        )}
      </Card>

      {/* Submit Payment (manual fallback) */}
      <Card>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-600" />
          Or, Submit Proof of a Manual Payment
        </h3>
        <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({getAccountCurrency()}) *</label>
              <input {...field('amount')}
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <FieldError name="amount" message={errors.amount} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference *</label>
            <input {...field('transactionReference')}
              type="text"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="e.g. M-Pesa confirmation code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <FieldError name="transactionReference" message={errors.transactionReference} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot Proof (optional)</label>
            <input
              id="screenshot-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">JPG or PNG, up to 5MB</p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Spinner className="w-4 h-4" tone="light" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Submit Payment
                </>
              )}
            </button>
          </div>
        </form>
      </Card>

      {/* Submission History */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Your Submissions
        </h3>

        {!submissions || submissions.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payment submissions yet"
            description="Once you submit a payment above, it will appear here with its review status."
          />
        ) : (
          <div className="space-y-2">
            {submissions.map((s) => {
              const StatusIcon = STATUS_ICON[s.status] ?? Clock;
              return (
                <Card key={s.id} padding="sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{formatCurrency(s.amount)}</span>
                        <span className="text-sm text-gray-500 capitalize">via {s.paymentMethod}</span>
                      </div>
                      {s.transactionReference && (
                        <p className="text-xs text-gray-500 mt-0.5">Ref: {s.transactionReference}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Submitted {formatDate(s.submittedAt, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'N/A'}
                      </p>
                      {s.status === 'rejected' && s.adminNotes && (
                        <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-md px-2 py-1 inline-block">
                          {s.adminNotes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {s.screenshotPath && (
                        <button
                          type="button"
                          onClick={() => handleViewProof(s.screenshotPath!)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          View proof
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      <span className={`px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full capitalize ${STATUS_BADGE[s.status] ?? 'bg-gray-100 text-gray-800'}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {s.status}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentManagement;
