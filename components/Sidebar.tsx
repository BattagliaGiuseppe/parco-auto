"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Car,
  Wrench,
  BarChart3,
  CalendarDays,
  Settings,
  Menu,
  X,
  LogOut,
  UserRound,
} from "lucide-react";
import { Audiowide } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import { getTeamSettings, type TeamSettings } from "@/lib/teamSettings";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teamSettings, setTeamSettings] = useState<TeamSettings | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getTeamSettings();
        setTeamSettings(data);
      } catch (error) {
        console.error("Errore caricamento team settings:", error);
      }
    };

    if (pathname !== "/login") {
      loadSettings();
    }
  }, [pathname]);

  if (pathname === "/login") {
    return null;
  }

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/cars", label: "Auto", icon: Car },
    { href: "/components", label: "Componenti", icon: Wrench },
    { href: "/mounts", label: "Montaggi", icon: Wrench },
    { href: "/maintenances", label: "Manutenzioni", icon: Wrench },
    { href: "/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/drivers", label: "Piloti", icon: UserRound },
    { href: "/settings", label: "Impostazioni", icon: Settings },
  ];

  const itemClass = (href: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return [
      "group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200",
      active
        ? "bg-yellow-400 text-black shadow-md"
        : "text-yellow-100 hover:bg-white/10 hover:text-yellow-300",
    ].join(" ");
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Errore logout:", error);
      }

      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  };

  const teamName = teamSettings?.team_name || "Battaglia Racing";
  const logoUrl = teamSettings?.team_logo_url || null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="lg:hidden fixed top-4 left-4 z-[70] inline-flex items-center justify-center rounded-xl bg-black text-yellow-400 shadow-lg border border-yellow-500/30 w-11 h-11"
        aria-label="Apri menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 z-[65] h-screen w-72 bg-black border-r border-yellow-500/10 text-yellow-500 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${audiowide.className}`}
      >
        <div className="h-full flex flex-col p-5">
          <div className="flex flex-col items-center text-center border-b border-yellow-500/20 pb-5 mb-5">
            {logoUrl ? (
              <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-white/5 border border-yellow-500/10">
                <Image
                  src={logoUrl}
                  alt={teamName}
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
            ) : (
              <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-white/5 border border-yellow-500/10">
                <Image
                  src="/logo-sidebar.png"
                  alt="Battaglia Racing Car Logo"
                  fill
                  className="object-contain p-2"
                  priority
                />
              </div>
            )}

            <h2 className="mt-4 text-xl font-bold leading-tight">{teamName}</h2>
            <p className="text-xs text-yellow-300/70 mt-1">
              Racing Control Center
            </p>
          </div>

          <nav className="flex-1 space-y-2">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  className={itemClass(href)}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={20} />
                  <div className="min-w-0">
                    <div className="font-semibold">{label}</div>
                    <div
                      className={`text-[11px] ${
                        active
                          ? "text-black/70"
                          : "text-yellow-100/50 group-hover:text-yellow-200/70"
                      }`}
                    >
                      {getSectionHint(label)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="pt-5 border-t border-yellow-500/20 flex flex-col gap-3">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-yellow-200 px-4 py-3 font-semibold transition"
            >
              <LogOut size={18} />
              {loggingOut ? "Uscita..." : "Logout"}
            </button>

            <div className="text-xs text-yellow-300/60 text-center">
              © 2026 {teamName}
            </div>
          </div>
        </div>
      </aside>
    </>
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
    case "Montaggi":
      return "Storico componenti";
    case "Manutenzioni":
      return "Interventi e revisioni";
    case "Calendario":
      return "Eventi e pista";
    case "Piloti":
      return "Anagrafiche e scadenze";
    case "Impostazioni":
      return "Configurazione app";
    default:
      return "";
  }
}