"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { SessionContextProvider } from "react-use-supabase";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => supabase);

  return (
    <SessionContextProvider client={client}>
      {children}
    </SessionContextProvider>
  );
}
