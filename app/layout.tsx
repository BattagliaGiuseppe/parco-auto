import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Parco Auto",
  description: "Gestione parco auto da corsa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="flex">
        {/* Sidebar fissa a sinistra */}
        <Sidebar />

        {/* Contenuto a destra */}
        <div className="flex-1 flex flex-col h-screen">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-800 text-black dark:text-white">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
