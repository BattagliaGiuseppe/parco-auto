"use client";

import { useState, useEffect } from "react";
import { Session, SessionContextProvider } from "@supabase/auth-helpers-react";
import { supabase } from "@/lib/supabaseClient";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Recupera la sessione salvata
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      console.log("📢 Session iniziale:", data.session);
    });

    // Ascolta cambiamenti (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      console.log("📢 Session aggiornata:", session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={session}>
      {children}
    </SessionContextProvider>
  );
}
