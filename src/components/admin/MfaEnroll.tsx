import React, { useEffect, useState } from 'react';
import { ShieldCheck, Copy, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabase';
import Spinner from '../ui/Spinner';

interface MfaEnrollProps {
  onEnrolled: () => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
}

/**
 * TOTP enrollment. Before creating a new factor it clears out any unverified factor left over
 * from an abandoned previous attempt — Supabase rejects a second `enroll()` call with the same
 * friendly name while an unverified one already exists, which otherwise strands the admin on a
 * confusing error with no visible cause.
 */
const MfaEnroll: React.FC<MfaEnrollProps> = ({ onEnrolled, onCancel, title, description }) => {
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startEnrollment();
  }, []);

  const startEnrollment = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const stale = (factorsData?.all ?? []).filter(f => f.factor_type === 'totp' && f.status === 'unverified');
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${Date.now()}`,
      });
      if (enrollError) throw enrollError;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: any) {
      console.error('MFA enrollment error:', err);
      setError(err?.message || 'Could not start two-factor setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;

    setVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      toast.success('Two-factor authentication enabled');
      onEnrolled();
    } catch (err: any) {
      setError(err?.message || 'That code did not work. Check the time on your device and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success('Secret copied');
    } catch {
      toast.error('Could not copy — select and copy it manually');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-8 h-8" tone="brand" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-6 h-6 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">{title ?? 'Set up two-factor authentication'}</h2>
      </div>
      <p className="text-sm text-gray-600 mb-5">
        {description ?? 'Admin accounts require an authenticator app (Google Authenticator, Authy, 1Password, etc.) in addition to your password.'}
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {qrCode && (
        <div className="flex flex-col items-center gap-3 mb-5">
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <img
              src={qrCode.startsWith('data:') ? qrCode : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`}
              alt="Scan this QR code with your authenticator app"
              width={180}
              height={180}
            />
          </div>
          <div className="w-full">
            <p className="text-xs text-gray-500 mb-1">Can't scan? Enter this code manually:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 overflow-x-auto">{secret}</code>
              <button
                type="button"
                onClick={copySecret}
                aria-label="Copy secret"
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Enter the 6-digit code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
            placeholder="000000"
          />
        </div>
        <button
          type="submit"
          disabled={verifying || code.length !== 6 || !factorId}
          className="min-h-[44px] w-full px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {verifying ? <Spinner className="w-4 h-4" tone="light" /> : <ShieldCheck className="w-4 h-4" />}
          {verifying ? 'Verifying…' : 'Enable two-factor authentication'}
        </button>
      </form>

      <div className="mt-4 flex justify-center gap-4">
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
};

export default MfaEnroll;
