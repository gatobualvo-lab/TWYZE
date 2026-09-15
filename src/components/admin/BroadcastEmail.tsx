import React, { useEffect, useState } from 'react';
import { Send, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchPlatformStats, listEmailBroadcasts, logEmailBroadcast } from '../../services/admin/adminService';
import type { PlatformStats, EmailBroadcast } from '../../services/admin/adminService';
import { sendBroadcastEmail } from '../../services/email/emailService';
import type { BroadcastAudience } from '../../services/email/emailService';

const AUDIENCE_OPTIONS: { value: BroadcastAudience; name: string; label: (stats: PlatformStats) => string }[] = [
  { value: 'all', name: 'All users', label: s => `All users (${s.totalUsers})` },
  { value: 'active', name: 'Active subscribers', label: s => `Active subscribers (${s.activeUsers})` },
  { value: 'trial', name: 'Trial users', label: s => `Trial users (${s.trialUsers})` },
  { value: 'expired', name: 'Expired users', label: s => `Expired users (${s.expiredUsers})` },
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const BroadcastEmail: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [history, setHistory] = useState<EmailBroadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [armed, setArmed] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchPlatformStats().then(setStats).catch(() => {});
    refreshHistory();
  }, []);

  const refreshHistory = () => {
    setLoadingHistory(true);
    listEmailBroadcasts()
      .then(setHistory)
      .catch(() => toast.error('Failed to load broadcast history'))
      .finally(() => setLoadingHistory(false));
  };

  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  const handleSendClick = () => {
    if (!canSend) return;
    setArmed(true);
  };

  const handleConfirmSend = async () => {
    setSending(true);
    try {
      const { recipientCount } = await sendBroadcastEmail({ subject: subject.trim(), body: body.trim(), audience });
      await logEmailBroadcast({ subject: subject.trim(), body: body.trim(), audience, recipientCount });
      toast.success(recipientCount > 0 ? `Sent to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}` : 'No matching recipients — nothing was sent');
      setSubject('');
      setBody('');
      setArmed(false);
      refreshHistory();
    } catch (error: any) {
      console.error('Error sending broadcast email:', error);
      toast.error(error?.message || 'Failed to send broadcast email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Broadcast Email</h2>
        <p className="text-slate-600">Send an announcement or update to every user in a segment.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={e => { setSubject(e.target.value); setArmed(false); }}
            placeholder="What's new in TrackWyze"
            maxLength={200}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={e => { setBody(e.target.value); setArmed(false); }}
            rows={6}
            maxLength={5000}
            placeholder="Write your update here. Blank lines separate paragraphs."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Audience</label>
          <select
            value={audience}
            onChange={e => { setAudience(e.target.value as BroadcastAudience); setArmed(false); }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {AUDIENCE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{stats ? opt.label(stats) : opt.value}</option>
            ))}
          </select>
        </div>

        {!armed ? (
          <button
            onClick={handleSendClick}
            disabled={!canSend}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            Send Broadcast
          </button>
        ) : (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 mb-1">
                This will email every user in "{AUDIENCE_OPTIONS.find(o => o.value === audience)?.name}" right now. This can't be undone.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleConfirmSend}
                  disabled={sending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-red-300 transition-colors"
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {sending ? 'Sending…' : 'Confirm & Send'}
                </button>
                <button
                  onClick={() => setArmed(false)}
                  disabled={sending}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Recent Broadcasts</h3>
        {loadingHistory ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No broadcasts sent yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(b => (
              <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900">{b.subject}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(b.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {b.audience} · {b.recipientCount} recipient{b.recipientCount === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BroadcastEmail;
