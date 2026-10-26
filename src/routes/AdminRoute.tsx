import Spinner from '../components/ui/Spinner';
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Status = "checking" | "allowed" | "denied" | "unauthenticated";

export default function AdminRoute({ children }: { children: JSX.Element }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) return setStatus("unauthenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      setStatus(profile?.role === "admin" ? "allowed" : "denied");
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
  return children;
}

