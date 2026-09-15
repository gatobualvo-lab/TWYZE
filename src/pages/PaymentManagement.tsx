import React, { useEffect, useState } from 'react';
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
} from '../services/payments/paymentService';
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
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [submissions, setSubmissions] = useState<MyPaymentSubmission[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('M-Pesa');
  const [transactionReference, setTransactionReference] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<BillingPlanKey>('month2-3');
  const [checkoutMethod, setCheckoutMethod] = useState<CheckoutMethod | null>(null);
  const [verifying, setVerifying] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountValue = Number(amount);
    if (!amountValue || amountValue <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!transactionReference.trim()) {
      toast.error('Enter the transaction reference (e.g. M-Pesa code)');
      return;
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

      {/* Pay Now */}
      <Card>
        <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          Pay Now
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Pay instantly with M-Pesa or a card — your subscription activates automatically once payment is confirmed.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {(Object.values(BILLING_PLANS)).map(plan => (
            <button
              key={plan.key}
              type="button"
              onClick={() => setSelectedPlan(plan.key)}
              className={`text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                selectedPlan === plan.key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-gray-900">{plan.label}</p>
              <p className="text-sm text-gray-600">{formatCurrency(plan.amount)} / month</p>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handlePayNow('mpesa')}
            disabled={checkoutMethod !== null || verifying}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
          >
            {checkoutMethod === 'mpesa' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Pay with Card
          </button>
        </div>

        {verifying && (
          <div className="mt-4 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
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
            <input
              type="text"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="e.g. M-Pesa confirmation code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
