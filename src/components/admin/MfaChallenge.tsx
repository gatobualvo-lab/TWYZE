import React, { useEffect, useState } from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import Spinner from '../ui/Spinner';

interface MfaChallengeProps {
  onVerified: () => void;
}

const MfaChallenge: React.FC<MfaChallengeProps> = ({ onVerified }) => {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
      } else {
        const verified = data.totp.find(f => f.status === 'verified');
        setFactorId(verified?.id ?? null);
        if (!verified) setError('No verified authenticator found on this account.');
      }
      setLoading(false);
    })();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;

    setVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      onVerified();
    } catch (err: any) {
      setError(err?.message || 'That code did not work. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Two-factor verification</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">Enter the 6-digit code from your authenticator app to continue to the admin panel.</p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="w-6 h-6" tone="brand" />
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}
            <form onSubmit={handleVerify} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                placeholder="000000"
                disabled={!factorId}
              />
              <button
                type="submit"
                disabled={verifying || code.length !== 6 || !factorId}
                className="min-h-[44px] w-full px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {verifying ? <Spinner className="w-4 h-4" tone="light" /> : <ShieldCheck className="w-4 h-4" />}
                {verifying ? 'Verifying…' : 'Verify'}
              </button>
            </form>
          </>
        )}

        <div className="mt-4 flex justify-center">
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
    </div>
  );
};

export default MfaChallenge;
