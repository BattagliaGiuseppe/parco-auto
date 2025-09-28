"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "🏠 Dashboard" },
    { href: "/cars", label: "🚗 Auto" },
    { href: "/components", label: "⚙️ Componenti" },
    { href: "/maintenances", label: "🛠️ Manutenzioni" },
  ];

  return (
    <aside className="w-64 h-screen bg-gray-100 dark:bg-gray-900 p-4 flex flex-col">
      <h1 className="text-xl font-bold mb-6">Parco Auto</h1>
      <nav className="flex flex-col gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
              pathname === link.href ? "bg-gray-300 dark:bg-gray-700 font-bold" : ""
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
