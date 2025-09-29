"use client";

import Image from "next/image";
import Link from "next/link";
import { Car, Wrench, BarChart3, CalendarDays, Settings, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function Sidebar() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login"; // 👈 opzionale: rimanda al login
  };

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center justify-center p-6 border-b border-gray-800">
        <Image
          src="/logo.png" // logo in /public
          alt="Battaglia Racing Car Logo"
          width={80}
          height={80}
          className="object-contain"
        />
      </div>

      {/* Menu */}
      <nav className="flex-1 mt-6 space-y-2 px-4">
        <Link href="/cars" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Car size={20} />
          <span>Auto</span>
        </Link>
        <Link href="/components" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Wrench size={20} />
          <span>Componenti</span>
        </Link>
        <Link href="/maintenances" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <BarChart3 size={20} />
          <span>Manutenzioni</span>
        </Link>
        <Link href="/calendar" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <CalendarDays size={20} />
          <span>Calendario</span>
        </Link>
        <Link href="/settings" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Settings size={20} />
          <span>Impostazioni</span>
        </Link>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-gray-800 transition text-left"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
