"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Wrench, BarChart3, CalendarDays, Settings, Boxes } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/cars", label: "Auto", icon: Car },
    { href: "/components", label: "Componenti", icon: Wrench },
    { href: "/maintenances", label: "Manutenzioni", icon: BarChart3 },
    { href: "/mounts", label: "Montaggi", icon: Boxes }, // 👈 nuova voce
    { href: "/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/settings", label: "Impostazioni", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center justify-center p-6 border-b border-gray-800">
        <Image
          src="/logo.png"
          alt="Battaglia Racing Car Logo"
          width={80}
          height={80}
          className="object-contain"
        />
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
                active ? "bg-blue-600 text-white" : "hover:bg-gray-800"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
