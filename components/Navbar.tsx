"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center p-4 shadow-md bg-gray-100 dark:bg-gray-800">
      <div className="flex gap-4">
        <Link href="/">🏠 Home</Link>
        <Link href="/cars">🚗 Auto</Link>
        <Link href="/components">⚙️ Componenti</Link>
        <Link href="/maintenances">🛠️ Manutenzioni</Link>
      </div>
      <ThemeToggle />
    </nav>
  );
}
