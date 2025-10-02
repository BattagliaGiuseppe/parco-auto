"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Wrench, BarChart3, CalendarDays, Settings, Menu } from "lucide-react";

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

  const itemClass = (href: string) =>
    `flex items-center gap-3 p-3 rounded-xl transition ${
      pathname.startsWith(href)
        ? "bg-yellow-500 text-gray-900"
        : "hover:bg-gray-800 text-white"
    }`;

  return (
    <>
      {/* Pulsante hamburger (mobile) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-900 text-white p-2 rounded-lg shadow"
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
        className={`z-50 md:static fixed top-0 left-0 h-full w-64 bg-gray-900 text-white flex flex-col shadow-xl transform transition-transform
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-center p-6 border-b border-gray-800">
          <Image
            src="/logo.png"
            alt="Battaglia Racing Car Logo"
            width={100}
            height={100}
            className="object-contain"
            priority
          />
        </div>

        {/* Menu */}
        <nav className="flex-1 mt-6 space-y-2 px-4">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={itemClass(href)}
              onClick={() => setOpen(false)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
