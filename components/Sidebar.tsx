"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Wrench, BarChart3, CalendarDays, Settings } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/cars", label: "Auto", icon: Car },
    { href: "/components", label: "Componenti", icon: Wrench },
    { href: "/maintenances", label: "Manutenzioni", icon: BarChart3 },
    { href: "/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/settings", label: "Impostazioni", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-black text-yellow-500 flex flex-col shadow-2xl">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center p-6 border-b border-yellow-500">
        <Image
          src="/logo.png"
          alt="Battaglia Racing Car Logo"
          width={120} // più grande (doppio di prima)
          height={120}
          className="object-contain drop-shadow-lg"
        />
        <h2 className="mt-4 text-lg font-bold tracking-wide">
          Battaglia Racing
        </h2>
      </div>

      {/* Menu */}
      <nav className="flex-1 mt-6 space-y-2 px-4">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 p-3 rounded-xl transition ${
                active
                  ? "bg-yellow-500 text-black font-bold"
                  : "hover:bg-gray-900 hover:text-yellow-400"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer racing */}
      <div className="p-4 border-t border-yellow-500 text-xs text-center text-yellow-400">
        © 2025 Battaglia Racing Car
      </div>
    </aside>
  );
}
