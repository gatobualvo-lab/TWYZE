import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailX, AlertCircle } from 'lucide-react';
import Logo from './brand/Logo';
import Spinner from './ui/Spinner';
import { checkEmailSubscription, setEmailSubscription } from '../services/email/unsubscribeService';

type Stage = 'checking' | 'subscribed' | 'unsubscribed' | 'invalid' | 'error';

/**
 * Where an email's "Unsubscribe" link lands. Opening the page changes nothing (some mail systems open
 * every link in a message to scan it); a button does the unsubscribing.
 */
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const userId = params.get('u') ?? '';
  const token = params.get('t') ?? '';
  const [stage, setStage] = useState<Stage>('checking');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !token) {
      setStage('invalid');
      setMessage('This unsubscribe link is incomplete. Please use the link in the latest email.');
      return;
    }
    checkEmailSubscription(userId, token).then(result => {
      if (cancelled) return;
      if (result.kind === 'ok') setStage(result.subscribed ? 'subscribed' : 'unsubscribed');
      else { setStage(result.kind === 'invalid' ? 'invalid' : 'error'); setMessage(result.message); }
    });
    return () => { cancelled = true; };
  }, [userId, token]);

  const change = async (action: 'unsubscribe' | 'resubscribe') => {
    setBusy(true);
    const result = await setEmailSubscription(userId, token, action);
    setBusy(false);
    if (result.kind === 'ok') {
      setMessage('');
      setStage(result.subscribed ? 'subscribed' : 'unsubscribed');
    } else {
      setMessage(result.message);
      setStage(result.kind === 'invalid' ? 'invalid' : 'error');
    }
  };

  const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 min-h-[44px]';
  const secondary = 'inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[44px]';

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-gray-200 text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>

        <div aria-live="polite">
          {stage === 'checking' && (
            <div className="flex items-center justify-center gap-3 py-6 text-gray-600">
              <Spinner className="w-5 h-5" tone="brand" /> Checking your link…
            </div>
          )}

          {stage === 'subscribed' && (
            <>
              <MailX className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />
              <h1 className="font-display text-xl font-bold text-gray-900">Unsubscribe from TrackWyze emails?</h1>
              <p className="mt-2 text-sm text-gray-600">
                You will stop getting reminders, business reports, alerts and announcements. Payment receipts and notices about your account are still sent.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button type="button" onClick={() => change('unsubscribe')} disabled={busy} className={primary}>
                  {busy && <Spinner className="w-4 h-4" tone="light" />} Unsubscribe
                </button>
                <Link to="/" className={secondary}>Keep my emails</Link>
              </div>
            </>
          )}

          {stage === 'unsubscribed' && (
            <>
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" aria-hidden="true" />
              <h1 className="font-display text-xl font-bold text-gray-900">You are unsubscribed</h1>
              <p className="mt-2 text-sm text-gray-600">
                We will not send you reminders, reports or announcements. You will still get payment receipts and account notices.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button type="button" onClick={() => change('resubscribe')} disabled={busy} className={secondary}>
                  {busy ? 'One moment…' : 'I changed my mind: resubscribe'}
                </button>
                <Link to="/" className={primary}>Open TrackWyze</Link>
              </div>
            </>
          )}

          {(stage === 'invalid' || stage === 'error') && (
            <>
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" aria-hidden="true" />
              <h1 className="font-display text-xl font-bold text-gray-900">{stage === 'invalid' ? 'This link is not valid' : 'Something went wrong'}</h1>
              <p role="alert" className="mt-2 text-sm text-gray-600">{message}</p>
              <p className="mt-3 text-sm text-gray-600">
                You can also turn emails off any time in TrackWyze: Notification Center, then Settings.
              </p>
              <div className="mt-6 flex justify-center">
                <Link to="/" className={primary}>Open TrackWyze</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
