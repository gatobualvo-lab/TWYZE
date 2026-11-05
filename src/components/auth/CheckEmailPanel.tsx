import { useEffect, useRef, useState } from 'react';
import { Mail, ExternalLink } from 'lucide-react';
import Spinner from '../ui/Spinner';

/** Seconds to wait before another email can be requested (also protects the email quota). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** The web inbox for the common providers, so the person can open it in one tap. */
export function inboxLinkFor(email: string): { label: string; url: string } | null {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (domain === 'gmail.com' || domain === 'googlemail.com') return { label: 'Open Gmail', url: 'https://mail.google.com/' };
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) return { label: 'Open Outlook', url: 'https://outlook.live.com/mail/' };
  if (['yahoo.com', 'ymail.com'].includes(domain)) return { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/' };
  if (domain === 'icloud.com' || domain === 'me.com') return { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' };
  return null;
}

interface CheckEmailPanelProps {
  email: string;
  /** Sends the confirmation email again. Should throw with a readable message if it cannot. */
  onResend: () => Promise<void>;
  /** Back to the form, to fix a mistyped address. */
  onChangeEmail: () => void;
  onLogin: () => void;
}

/**
 * Shown after signup when the email has to be confirmed first. It says plainly what to do next, and gives
 * the person a way out if the email never arrives (resend, a mistyped address).
 */
export default function CheckEmailPanel({ email, onResend, onChangeEmail, onLogin }: CheckEmailPanelProps) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inbox = inboxLinkFor(email);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = async () => {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setMessage(null);
    try {
      await onResend();
      setMessage({ kind: 'ok', text: 'Sent again. It can take a minute to arrive.' });
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not send the email. Please try again shortly.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Mail className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-extrabold tracking-tight text-gray-900 outline-none">
        Check your email
      </h1>
      <p className="mt-2 text-gray-600">
        We sent a link to <span className="font-semibold break-all text-gray-900">{email}</span>. Open it to finish creating your account.
      </p>

      {inbox && (
        <a
          href={inbox.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 px-4 font-bold text-white shadow-md"
        >
          {inbox.label} <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      )}

      <p className="mt-5 text-sm text-gray-500">Can't see it? Check your spam or promotions folder.</p>

      <div className="mt-3">
        <button
          type="button"
          onClick={resend}
          disabled={resending || secondsLeft > 0}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {resending && <Spinner className="h-4 w-4" tone="brand" />}
          {secondsLeft > 0 ? `Send it again in ${secondsLeft}s` : 'Send it again'}
        </button>
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${message.kind === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {message.text}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2 text-sm">
        <button type="button" onClick={onChangeEmail} className="font-medium text-blue-600 hover:text-blue-800">
          Wrong address? Use a different email
        </button>
        <button type="button" onClick={onLogin} className="font-medium text-blue-600 hover:text-blue-800">
          Already confirmed? Log in
        </button>
      </div>
    </div>
  );
}
