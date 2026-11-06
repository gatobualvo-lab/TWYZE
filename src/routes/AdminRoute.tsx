import Spinner from '../components/ui/Spinner';
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MfaEnroll from "../components/admin/MfaEnroll";
import MfaChallenge from "../components/admin/MfaChallenge";

type Status = "checking" | "allowed" | "denied" | "unauthenticated" | "mfa_setup" | "mfa_required";

export default function AdminRoute({ children }: { children: JSX.Element }) {
  const [status, setStatus] = useState<Status>("checking");

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setStatus("unauthenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") return setStatus("denied");

    // Admins must have two-factor authentication verified for this session. If the
    // assurance-level check itself fails, fail open rather than lock the sole admin out —
    // row-level security (private.is_admin) is the real security boundary; this is defense
    // in depth on top of it.
    try {
      const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !aal) return setStatus("allowed");
      if (aal.currentLevel === "aal2") return setStatus("allowed");
      if (aal.nextLevel === "aal2") return setStatus("mfa_required");
      return setStatus("mfa_setup");
    } catch {
      return setStatus("allowed");
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      await checkAccess();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="text-center">
          <Spinner className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">Verifying access</h2>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "denied") return <Navigate to="/app" replace />;

  if (status === "mfa_required") {
    return <MfaChallenge onVerified={() => setStatus("allowed")} />;
  }

  if (status === "mfa_setup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <MfaEnroll onEnrolled={() => setStatus("allowed")} />
        </div>
      </div>
    );
  }

  return children;
}

