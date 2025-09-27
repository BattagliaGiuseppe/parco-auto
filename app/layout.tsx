"use client";

import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { useState } from "react";

export const metadata: Metadata = {
  title: "Parco Auto",
  description: "Gestione auto da corsa, componenti e manutenzioni",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="it" suppressHydrationWarning>
      <body className="h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex">
        {/* Sidebar per desktop */}
        <aside className="hidden md:flex w-64 bg-white dark:bg-gray-800 shadow-lg flex-col">
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

        {/* Sidebar mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="relative flex-1 flex flex-col w-64 bg-white dark:bg-gray-800 shadow-lg">
              <div className="p-6 text-2xl font-bold border-b border-gray-200 dark:border-gray-700">
                🏎️ Parco Auto
              </div>
              <nav className="flex-1 p-4 space-y-2">
                <Link
                  href="/"
                  className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => setSidebarOpen(false)}
                >
                  📊 Dashboard
                </Link>
                <Link
                  href="/cars"
                  className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => setSidebarOpen(false)}
                >
                  🚗 Auto
                </Link>
                <Link
                  href="/components"
                  className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => setSidebarOpen(false)}
                >
                  ⚙️ Componenti
                </Link>
                <Link
                  href="/maintenances"
                  className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => setSidebarOpen(false)}
                >
                  🛠️ Manutenzioni
                </Link>
                <Link
                  href="/installations"
                  className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => setSidebarOpen(false)}
                >
                  🔧 Installazioni
                </Link>
              </nav>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() =>
                    document.documentElement.classList.toggle("dark")
                  }
                  className="w-full bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded"
                >
                  🌓 Toggle Tema
                </button>
              </div>
            </div>
            <div
              className="flex-shrink-0 w-full bg-black bg-opacity-50"
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        )}

        {/* Contenuto principale */}
        <div className="flex-1 flex flex-col">
          {/* Header mobile con pulsante menu */}
          <header className="md:hidden flex items-center justify-between bg-white dark:bg-gray-800 shadow p-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-700 dark:text-gray-200"
            >
              ☰
            </button>
            <h1 className="text-lg font-bold">Parco Auto</h1>
            <button
              onClick={() =>
                document.documentElement.classList.toggle("dark")
              }
              className="text-gray-700 dark:text-gray-200"
            >
              🌓
            </button>
          </header>

          <main className="flex-1 p-6 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
