"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Wrench, BarChart3, CalendarDays, Settings } from "lucide-react";
import { useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/cars", label: "Auto", icon: Car },
    { href: "/components", label: "Componenti", icon: Wrench },
    { href: "/maintenances", label: "Manutenzioni", icon: BarChart3 },
    { href: "/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/settings", label: "Impostazioni", icon: Settings },
  ];

  return (
    <>
      {/* Bottone hamburger su mobile */}
      <button
        className="md:hidden p-4 text-gray-800"
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white flex flex-col shadow-xl transform transition-transform ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-center p-6 border-b border-gray-800">
          <Image
            src="/logo.png"
            alt="Battaglia Racing Car Logo"
            width={160} // doppio rispetto a prima
            height={160}
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
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "hover:bg-gray-800"
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
