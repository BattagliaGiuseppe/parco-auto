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
  X,
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
    { href: "/maintenances", label: "Manutenzioni", icon: Wrench },
    { href: "/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/settings", label: "Impostazioni", icon: Settings },
  ];

  const itemClass = (href: string) => {
    const active = pathname.startsWith(href);

    return [
      "group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200",
      active
        ? "bg-yellow-400 text-black shadow-md"
        : "text-yellow-100 hover:bg-white/10 hover:text-yellow-300",
    ].join(" ");
  };

  return (
    <div className={audiowide.className}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="lg:hidden fixed top-4 left-4 z-[70] inline-flex items-center justify-center rounded-xl bg-black text-yellow-400 shadow-lg border border-yellow-500/30 w-11 h-11"
        aria-label="Apri menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed top-0 left-0 z-[60] h-screen w-[280px] transform transition-transform duration-300",
          "bg-gradient-to-b from-neutral-950 via-black to-neutral-900 text-yellow-400",
          "border-r border-yellow-500/15 shadow-2xl",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:sticky lg:top-0",
        ].join(" ")}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-yellow-500/15 px-6 py-7">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-2xl bg-white/5 p-3 border border-yellow-500/10">
                <Image
                  src="/logo.png"
                  alt="Battaglia Racing Car Logo"
                  width={110}
                  height={110}
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </div>

              <h2 className="mt-4 text-lg font-bold tracking-wide text-yellow-400">
                Battaglia Racing
              </h2>

              <p className="mt-2 text-xs text-yellow-100/70 leading-relaxed">
                Gestione tecnica parco auto, eventi, componenti e manutenzioni
              </p>
            </div>
          </div>

          <nav className="flex-1 px-4 py-5 space-y-2 overflow-y-auto">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  className={itemClass(href)}
                  onClick={() => setOpen(false)}
                >
                  <div
                    className={[
                      "inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
                      active
                        ? "bg-black/10 text-black"
                        : "bg-white/5 text-yellow-300 group-hover:bg-white/10",
                    ].join(" ")}
                  >
                    <Icon size={19} />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate">{label}</span>
                    <span
                      className={`text-[11px] ${
                        active ? "text-black/70" : "text-yellow-100/50"
                      }`}
                    >
                      {getSectionHint(label)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-yellow-500/15 px-5 py-4">
            <div className="rounded-2xl bg-white/5 border border-yellow-500/10 px-4 py-3 text-center">
              <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-100/50">
                Racing Management
              </div>
              <div className="mt-1 text-xs text-yellow-300 font-semibold">
                Battaglia Racing Car
              </div>
              <div className="mt-1 text-[11px] text-yellow-100/50">
                © 2026
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function getSectionHint(label: string) {
  switch (label) {
    case "Dashboard":
      return "Panoramica generale";
    case "Auto":
      return "Vetture e stato";
    case "Componenti":
      return "Magazzino e montaggi";
    case "Manutenzioni":
      return "Interventi e revisioni";
    case "Calendario":
      return "Eventi e pista";
    case "Impostazioni":
      return "Configurazione app";
    default:
      return "";
  }
}
