import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "Parco Auto",
  description: "Gestione auto da corsa, componenti e manutenzioni",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-100 text-neutral-900">
        <AuthGuard>
          <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
            <Sidebar />
            <main className="min-w-0">
              <div className="min-h-screen bg-gradient-to-b from-neutral-100 to-neutral-200/60">
                <div className="mx-auto w-full max-w-[1800px] p-4 md:p-6 lg:p-8">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
