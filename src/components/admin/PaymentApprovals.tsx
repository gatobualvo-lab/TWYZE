import React, { useEffect, useState } from 'react';
import { CreditCard, CheckCircle2, XCircle, ExternalLink, User, Clock, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingScreen from '../LoadingScreen';
import { formatCurrency } from '../../utils/format';
import {
  listPaymentSubmissions,
  approvePaymentSubmission,
  rejectPaymentSubmission,
  getPaymentScreenshotSignedUrl,
} from '../../services/admin/adminService';
import type { PaymentSubmission } from '../../services/admin/adminService';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const PaymentApprovals: React.FC = () => {
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<'approve' | 'reject' | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [billingCycle, setBillingCycle] = useState('month2-3');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [statusTab]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setSubmissions(await listPaymentSubmissions(statusTab));
    } catch (error: any) {
      console.error('Error fetching payment submissions:', error);
      toast.error('Failed to load payment submissions');
    } finally {
      setLoading(false);
    }
  };

  const openReview = (submission: PaymentSubmission, mode: 'approve' | 'reject') => {
    setReviewingId(submission.id);
    setReviewMode(mode);
    setExtendDays(30);
    setBillingCycle('month2-3');
    setAdminNotes('');
  };

  const closeReview = () => {
    setReviewingId(null);
    setReviewMode(null);
    setAdminNotes('');
  };

  const currentSubmission = submissions.find(s => s.id === reviewingId) ?? null;

  const handleViewProof = async (path: string) => {
    try {
      const url = await getPaymentScreenshotSignedUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      toast.error('Failed to load proof screenshot');
    }
  };

  const handleApprove = async () => {
    if (!currentSubmission) return;
    setSubmitting(true);
    try {
      await approvePaymentSubmission(currentSubmission, { extendDays, billingCycle, adminNotes: adminNotes || undefined });
      toast.success(`Approved — ${currentSubmission.userEmail || currentSubmission.userName || 'user'} granted ${extendDays} days`);
      closeReview();
      fetchSubmissions();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve submission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!currentSubmission) return;
    if (!adminNotes.trim()) {
      toast.error('Add a reason for the rejection');
      return;
    }
    setSubmitting(true);
    try {
      await rejectPaymentSubmission(currentSubmission, adminNotes.trim());
      toast.success('Submission rejected');
      closeReview();
      fetchSubmissions();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reject submission');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`py-2 px-4 font-medium text-sm capitalize ${
              statusTab === tab ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No {statusTab === 'all' ? '' : statusTab} payment submissions</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method / Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {submissions.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{s.userName || 'Unnamed User'}</div>
                        <div className="text-sm text-gray-500">{s.userEmail || 'No email'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {formatCurrency(s.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <span className="capitalize">{s.paymentMethod}</span>
                      {s.source === 'gateway' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-indigo-100 text-indigo-700">
                          <Zap className="w-2.5 h-2.5" />
                          {s.gateway || 'Gateway'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-gray-100 text-gray-600">
                          Manual
                        </span>
                      )}
                    </div>
                    {s.transactionReference && (
                      <div className="text-xs text-gray-500">Ref: {s.transactionReference}</div>
                    )}
                    {s.screenshotUrl && (
                      <button
                        type="button"
                        onClick={() => handleViewProof(s.screenshotUrl!)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View proof
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(s.submittedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${STATUS_BADGE[s.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {s.status}
                    </span>
                    {s.status !== 'pending' && s.adminNotes && (
                      <p className="text-xs text-gray-400 mt-1 max-w-[16rem]">{s.adminNotes}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {s.status === 'pending' ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openReview(s, 'approve')}
                          className="text-green-700 hover:text-green-900 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => openReview(s, 'reject')}
                          className="text-red-700 hover:text-red-900 flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Reviewed {formatDateTime(s.reviewedAt)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewMode && currentSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {reviewMode === 'approve' ? 'Approve payment' : 'Reject payment'}
              </h3>
              <p className="text-sm text-gray-600">
                {currentSubmission.userEmail || currentSubmission.userName || 'This user'} submitted{' '}
                <span className="font-medium">{formatCurrency(currentSubmission.amount)}</span> via{' '}
                {currentSubmission.paymentMethod}.
              </p>

              {reviewMode === 'approve' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Grant access for (days)</label>
                      <input
                        type="number"
                        min={1}
                        value={extendDays}
                        onChange={e => setExtendDays(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Billing cycle</label>
                      <select
                        value={billingCycle}
                        onChange={e => setBillingCycle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="month2-3">Months 2-3 (KES 500/mo)</option>
                        <option value="month4+">Month 4+ (KES 1000/mo)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                    <textarea
                      value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason for rejection *</label>
                  <textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. Transaction reference could not be verified"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeReview}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={reviewMode === 'approve' ? handleApprove : handleReject}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 ${
                    reviewMode === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting ? 'Saving...' : reviewMode === 'approve' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentApprovals;
