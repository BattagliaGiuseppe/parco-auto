"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <nav className="flex justify-between items-center p-4 shadow-md bg-gray-100 dark:bg-gray-800">
      <div className="flex gap-4">
        <Link href="/">🏠 Home</Link>
        <Link href="/cars">🚗 Auto</Link>
        <Link href="/components">⚙️ Componenti</Link>
        <Link href="/maintenances">🛠️ Manutenzioni</Link>
      </div>
      <div className="flex gap-4">
        <ThemeToggle />
        <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded">
          Logout
        </button>
      </div>
    </nav>
  );
}
