import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabaseClient";

export const metadata: Metadata = {
  title: "Parco Auto",
  description: "Gestione parco auto da corsa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <Navbar />
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
