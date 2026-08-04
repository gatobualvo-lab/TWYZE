import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function useRequireSession(redirectTo = "/login") {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(redirectTo, { replace: true });
      }
      setReady(true);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!sess) {
        navigate(redirectTo, { replace: true });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate, redirectTo]);

  return ready;
}
