import React, { useEffect, useState } from 'react';
import { Lightbulb, Bug, MessageSquare, LifeBuoy, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader, EmptyState, SkeletonList } from '../ui';
import { submitFeedback, fetchMyFeedback } from '../../services/feedback/featureFeedbackService';
import type { FeedbackCategory, FeedbackEntry, FeedbackStatus } from '../../services/feedback/featureFeedbackService';
import { formatDate } from '../../utils/format';

// The picker only offers these three — "problem" reports come from the Guide's own "Report a
// problem" form, not from here, but they land in the same table and so can show up below in
// "Your past suggestions" too.
const CATEGORIES: { value: FeedbackCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'feature', label: 'Feature idea', icon: Lightbulb },
  { value: 'bug', label: 'Something broken', icon: Bug },
  { value: 'general', label: 'General feedback', icon: MessageSquare },
];

const HISTORY_ICON: Record<FeedbackCategory, React.ComponentType<{ className?: string }>> = {
  feature: Lightbulb,
  bug: Bug,
  general: MessageSquare,
  problem: LifeBuoy,
};

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'bg-gray-100 text-gray-600',
  reviewing: 'bg-blue-100 text-blue-700',
  planned: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Received',
  reviewing: 'Being reviewed',
  planned: 'Planned',
  done: 'Done',
  declined: "Won't do",
};

const MAX_LEN = 1000;

const FeatureFeedback: React.FC = () => {
  const [category, setCategory] = useState<FeedbackCategory>('feature');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setEntries(await fetchMyFeedback());
    } catch (error) {
      console.error('Error loading feedback history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Write a message first');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({ category, message, page: typeof window !== 'undefined' ? window.location.pathname : undefined });
      toast.success('Thanks! Your feedback has been sent to the team.');
      setMessage('');
      setCategory('feature');
      load();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(error.message || 'Could not send your feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={Lightbulb} title="Suggest a Feature" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What's this about?</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    category === value
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 mb-1">
              Tell us what you'd like to see, or what went wrong
            </label>
            <textarea
              id="feedback-message"
              value={message}
              maxLength={MAX_LEN}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="e.g. It would help to filter sales by customer…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-xs text-gray-400 text-right">{message.length}/{MAX_LEN}</p>
          </div>

          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {submitting ? 'Sending…' : 'Send feedback'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Your past suggestions</h3>
        {loading ? (
          <SkeletonList rows={3} />
        ) : entries.length === 0 ? (
          <EmptyState icon={Lightbulb} title="Nothing sent yet" description="Anything you suggest will show up here." />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const Icon = HISTORY_ICON[entry.category];
              return (
                <div key={entry.id} className="flex items-start gap-3 p-3.5 rounded-lg border border-gray-100 bg-gray-50">
                  <Icon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{entry.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(entry.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[entry.status]}`}>
                    {STATUS_LABEL[entry.status]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeatureFeedback;
