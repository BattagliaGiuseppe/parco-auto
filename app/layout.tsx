import "./globals.css";

import type { Metadata } from "next";
import { Suspense } from "react";

import Providers from "./providers";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Parco Auto",
  description: "Piattaforma motorsport modulare e configurabile",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-100 text-neutral-900">
        <Providers>
          <Suspense
            fallback={
              <div className="min-h-screen bg-neutral-100 flex items-center justify-center text-neutral-500">
                Caricamento...
              </div>
            }
          >
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}