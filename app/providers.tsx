"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SessionContextProvider, useSession } from "@supabase/auth-helpers-react";
import { useEffect } from "react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Providers({ children }: { children: React.ReactNode }) {
  const session = useSession();

  useEffect(() => {
    console.log("📢 Session aggiornata:", session);
  }, [session]);

  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  );
}
