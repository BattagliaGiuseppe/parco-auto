import "./globals.css";
import { Audiowide } from "next/font/google";
import Sidebar from "@/components/Sidebar"; // importa la sidebar

const audiowide = Audiowide({
  subsets: ["latin"],
  weight: "400",
});

export const metadata = {
  title: "Parco Auto",
  description: "Gestione auto da corsa, componenti e manutenzioni",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={`${audiowide.className} flex h-screen`}>
        {/* Sidebar fissa a sinistra */}
        <Sidebar />

        {/* Contenuto principale */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
