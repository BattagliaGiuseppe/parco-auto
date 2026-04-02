"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CarFront,
  Boxes,
  Wrench,
  CalendarDays,
  Settings,
  Menu,
  Package,
  Activity,
  Users,
  LogOut,
  Layers3,
} from "lucide-react";
import { Audiowide } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext, getCurrentTeamSettings } from "@/lib/teamContext";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type NavItem = { href: string; label: string; icon: React.ReactNode; enabled?: boolean };

type SettingsShape = {
  team_name?: string;
  team_subtitle?: string | null;
  enable_events?: boolean;
  enable_maintenances?: boolean;
  enable_notes?: boolean;
  modules?: Record<string, boolean> | null;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState("Parco Auto");
  const [teamSubtitle, setTeamSubtitle] = useState("Control Center");
  const [settings, setSettings] = useState<SettingsShape | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [ctx, appSettings] = await Promise.all([
  getCurrentTeamContext(),
  getCurrentTeamSettings(),
]);

const safeSettings = appSettings ?? {
  team_name: null,
  team_subtitle: null,
};

setTeamName(safeSettings.team_name || ctx.name || "Parco Auto");
setTeamSubtitle(safeSettings.team_subtitle || "Gestione motorsport");
setSettings(appSettings);
      } catch {
        setSettings(null);
      }
    }
    load();
  }, []);

  const modules = settings?.modules || {};

  const links: NavItem[] = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
      { href: "/cars", label: "Auto", icon: <CarFront size={18} /> },
      { href: "/components", label: "Componenti", icon: <Boxes size={18} /> },
      { href: "/maintenances", label: "Manutenzioni", icon: <Wrench size={18} />, enabled: settings?.enable_maintenances !== false },
      { href: "/mounts", label: "Montaggi", icon: <Layers3 size={18} /> },
      { href: "/calendar", label: "Eventi", icon: <CalendarDays size={18} />, enabled: settings?.enable_events !== false },
      { href: "/drivers", label: "Piloti", icon: <Users size={18} />, enabled: modules.drivers !== false },
      { href: "/inventory", label: "Magazzino", icon: <Package size={18} />, enabled: modules.inventory !== false },
      { href: "/telemetry", label: "Telemetria", icon: <Activity size={18} />, enabled: modules.telemetry !== false },
      { href: "/settings", label: "Impostazioni", icon: <Settings size={18} /> },
    ],
    [modules.drivers, modules.inventory, modules.telemetry, settings?.enable_events, settings?.enable_maintenances]
  );

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const visibleLinks = links.filter((item) => item.enabled !== false);

  const itemClass = (href: string) => {
    const active = pathname.startsWith(href);
    return `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
      active ? "bg-yellow-400 text-black shadow-sm" : "text-neutral-300 hover:bg-white/10 hover:text-white"
    }`;
  };

  return (
    <div className={audiowide.className}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-black p-2 text-yellow-500 shadow-lg md:hidden"
        aria-label="Apri menu"
      >
        <Menu />
      </button>

      {open ? <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} /> : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-neutral-950 text-yellow-500 shadow-2xl transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-yellow-500/40 p-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Battaglia Racing Car Logo" width={64} height={64} className="rounded-xl object-contain" priority />
            <div>
              <div className="text-lg font-bold text-white">{teamName}</div>
              <div className="text-xs text-neutral-400">{teamSubtitle}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          {visibleLinks.map((link) => (
            <Link key={link.href} href={link.href} className={itemClass(link.href)} onClick={() => setOpen(false)}>
              {link.icon}
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-yellow-500/40 p-4">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 hover:text-white">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </div>
  );
}
