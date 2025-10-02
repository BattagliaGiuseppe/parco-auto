import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

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
      <body className="h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
