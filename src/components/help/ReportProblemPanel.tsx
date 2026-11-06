import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../ui/Spinner';
import { submitSupportRequest } from '../../services/support/supportRequestService';
import { SUPPORT_WHATSAPP_URL } from '../../services/helpAssistant/supportLink';
import { trackEvent } from '../../lib/analytics';

interface ReportProblemPanelProps {
  /** Prefilled from whatever the person last asked the Guide, if anything. */
  initialMessage: string;
  /** The page the report is filed from, for the team's context. */
  page: string;
  /** Returns to the chat view. */
  onBack: () => void;
}

/**
 * The Guide's "Report a problem" form: describe it, it's saved and emailed to the team, and
 * WhatsApp stays offered alongside it the whole way through. Owns its own submit/sent lifecycle
 * so the parent only needs to know whether this panel is showing at all.
 */
const ReportProblemPanel: React.FC<ReportProblemPanelProps> = ({ initialMessage, page, onBack }) => {
  const [message, setMessage] = useState(initialMessage);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await submitSupportRequest({ message: trimmed, page });
      trackEvent('support_request_submitted', { page });
      setSent(true);
      setMessage('');
    } catch {
      toast.error("Couldn't send your report. Please try WhatsApp instead.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
          <p className="font-semibold mb-1">Thanks — we've got it.</p>
          <p>We'll get back to you by email. If it's urgent, you can also reach us on WhatsApp.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp us too
            </a>
            <button type="button" onClick={onBack} className="text-xs font-semibold text-gray-600 hover:text-gray-800 underline">
              Back to chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="report-message" className="block text-sm font-semibold text-gray-800 mb-1">Report a problem</label>
          <p className="text-xs text-gray-500 mb-2">Tell us what's wrong. We'll reply by email, usually within a day.</p>
          <textarea
            id="report-message"
            rows={5}
            autoFocus
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What happened? What did you expect instead?"
            className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? <Spinner className="w-4 h-4" tone="light" /> : <Send className="w-4 h-4" aria-hidden="true" />}
          {submitting ? 'Sending…' : 'Send report'}
        </button>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700">
            Back to chat
          </button>
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800"
          >
            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> Or WhatsApp us
          </a>
        </div>
      </form>
    </div>
  );
};

export default ReportProblemPanel;
