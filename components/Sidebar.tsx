"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Car,
  Wrench,
  BarChart3,
  CalendarDays,
  Settings,
  Menu,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

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

  const itemClass = (href: string) => {
    const active = pathname.startsWith(href);
    return `flex items-center gap-3 p-3 rounded-xl transition ${
      active
        ? "bg-yellow-500 text-black font-bold"
        : "hover:bg-gray-900 hover:text-yellow-400"
    }`;
  };

  return (
    <div className={audiowide.className}>
      {/* Pulsante hamburger (solo mobile) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="md:hidden fixed top-4 left-4 z-50 bg-black text-yellow-500 p-2 rounded-lg shadow-lg"
        aria-label="Apri menu"
      >
        <Menu />
      </button>

      {/* Overlay mobile */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`z-50 md:static fixed top-0 left-0 h-full w-64 bg-black text-yellow-500 flex flex-col shadow-2xl transform transition-transform
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex flex-col items-center justify-center p-6 border-b border-yellow-500">
          <Image
            src="/logo.png"
            alt="Battaglia Racing Car Logo"
            width={120}
            height={120}
            className="object-contain drop-shadow-lg"
            priority
          />
          <h2 className="mt-4 text-lg font-bold tracking-wide">
            Battaglia Racing
          </h2>
        </div>

        {/* Menu */}
        <nav className="flex-1 mt-6 space-y-2 px-4">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={itemClass(href)}
              onClick={() => setOpen(false)} // chiudi sidebar al click (mobile)
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer racing */}
        <div className="p-4 border-t border-yellow-500 text-xs text-center text-yellow-400">
          © 2025 Battaglia Racing Car
        </div>
      </aside>
    </div>
  );
}
