import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: {
    default: "Parco Auto",
    template: "%s | Parco Auto",
  },
  description: "Gestione auto da corsa, componenti e manutenzioni",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 pt-20 md:pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
