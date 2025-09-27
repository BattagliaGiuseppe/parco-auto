"use client";

import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import { createBrowserClient } from "@supabase/ssr";
import { SessionContextProvider } from "@supabase/auth-helpers-react";

export const metadata: Metadata = {
  title: "Parco Auto",
  description: "Gestione auto da corsa, componenti e manutenzioni",
};

// Inizializza Supabase client
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex">
        <SessionContextProvider supabaseClient={supabase}>
          <Sidebar />
          <main className="flex-1 p-6 overflow-y-auto">{children}</main>
        </SessionContextProvider>
      </body>
    </html>
  );
}
