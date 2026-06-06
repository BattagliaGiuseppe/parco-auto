import "./globals.css";
import type { Metadata, Viewport } from "next";
import Providers from "./providers";
import AppShell from "@/components/AppShell";
import { brandConfig } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: brandConfig.appName,
    template: `%s · ${brandConfig.appName}`,
  },
  description: brandConfig.appDescription,
  applicationName: brandConfig.appName,
  icons: {
    icon: brandConfig.faviconPath,
    shortcut: brandConfig.faviconPath,
    apple: brandConfig.faviconPath,
  },
};

export const viewport: Viewport = {
  themeColor: brandConfig.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
