"use client";

import Link from "next/link";
import { useState } from "react";

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-gray-800 shadow-lg flex-col">
        <div className="p-6 text-2xl font-bold border-b border-gray-200 dark:border-gray-700">
          🏎️ Parco Auto
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/" className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            📊 Dashboard
          </Link>
          <Link href="/cars" className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            🚗 Auto
          </Link>
          <Link href="/components" className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            ⚙️ Componenti
          </Link>
          <Link href="/maintenances" className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            🛠️ Manutenzioni
          </Link>
          <Link href="/installations" className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            🔧 Installazioni
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => document.documentElement.classList.toggle("dark")}
            className="w-full bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded"
          >
            🌓 Toggle Tema
          </button>
        </div>
      </aside>

      {/* Header mobile + Sidebar mobile */}
      <div className="md:hidden">
        <header className="flex items-center justify-between bg-white dark:bg-gray-800 shadow p-4">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-700 dark:text-gray-200">
            ☰
          </button>
          <h1 className="text-lg font-bold">Parco Auto</h1>
          <button
            onClick={() => document.documentElement.classList.toggle("dark")}
            className="text-gray-700 dark:text-gray-200"
          >
            🌓
          </button>
        </header>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div className="relative flex-1 flex flex-col w-64 bg-white dark:bg-gray-800 shadow-lg">
              <div className="p-6 text-2xl font-bold border-b border-gray-200 dark:border-gray-700">
                🏎️ Parco Auto
              </div>
              <nav className="flex-1 p-4 space-y-2">
                <Link href="/" onClick={() => setSidebarOpen(false)} className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                  📊 Dashboard
                </Link>
                <Link href="/cars" onClick={() => setSidebarOpen(false)} className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                  🚗 Auto
                </Link>
                <Link href="/components" onClick={() => setSidebarOpen(false)} className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                  ⚙️ Componenti
                </Link>
                <Link href="/maintenances" onClick={() => setSidebarOpen(false)} className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                  🛠️ Manutenzioni
                </Link>
                <Link href="/installations" onClick={() => setSidebarOpen(false)} className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                  🔧 Installazioni
                </Link>
              </nav>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => document.documentElement.classList.toggle("dark")}
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
      </div>
    </>
  );
}
