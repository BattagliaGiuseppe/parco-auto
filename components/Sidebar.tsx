"use client";

import { useEffect, useState } from "react";
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
import { getTeamSettings, type TeamSettings } from "@/lib/teamSettings";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [teamSettings, setTeamSettings] = useState<TeamSettings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getTeamSettings();
        setTeamSettings(data);
      } catch (error) {
        console.error("Errore caricamento team settings:", error);
      }
    };

    loadSettings();
  }, []);

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

  const teamName = teamSettings?.team_name || "Battaglia Racing";
  const teamLogoUrl = teamSettings?.team_logo_url || null;

  return (
    <>
      {/* Pulsante hamburger mobile */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="md:hidden fixed top-4 left-4 z-50 bg-black text-yellow-500 p-2 rounded-lg shadow-lg"
        aria-label="Apri menu"
      >
        <Menu size={22} />
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
        className={`fixed md:static top-0 left-0 h-screen w-72 bg-black text-yellow-500 p-5 z-50 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 flex flex-col ${audiowide.className}`}
      >
        {/* Logo / header team */}
        <div className="flex flex-col items-center text-center border-b border-yellow-500/20 pb-5 mb-5">
          {teamLogoUrl ? (
            <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-white/5 border border-yellow-500/10">
              <Image
                src={teamLogoUrl}
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
          <p className="text-xs text-yellow-300/70 mt-1">Racing Control Center</p>
        </div>

        {/* Menu */}
        <nav className="flex-1 space-y-2">
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

        {/* Footer */}
        <div className="pt-5 border-t border-yellow-500/20 text-xs text-yellow-300/60 text-center">
          © 2026 {teamName}
        </div>
      </aside>
    </>
  );
}