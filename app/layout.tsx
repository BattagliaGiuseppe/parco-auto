import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

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
      <body className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col">
          <div className="p-6 text-2xl font-bold border-b border-gray-200 dark:border-gray-700">
            🏎️ Parco Auto
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link
              href="/"
              className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              📊 Dashboard
            </Link>
            <Link
              href="/cars"
              className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              🚗 Auto
            </Link>
            <Link
              href="/components"
              className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              ⚙️ Componenti
            </Link>
            <Link
              href="/maintenances"
              className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              🛠️ Manutenzioni
            </Link>
            <Link
              href="/installations"
              className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              🔧 Installazioni
            </Link>
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {/* Qui in futuro possiamo aggiungere il toggle tema */}
            <button
              onClick={() =>
                document.documentElement.classList.toggle("dark")
              }
              className="w-full bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded"
            >
              🌓 Toggle Tema
            </button>
          </div>
        </aside>

        {/* Contenuto principale */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
