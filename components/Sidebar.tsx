"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  X,
} from "lucide-react";
import { Audiowide } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import {
  getCurrentTeamContext,
  getCurrentTeamSettings,
  type TeamSettings,
} from "@/lib/teamContext";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  enabled?: boolean;
};

type SettingsShape = {
  team_name?: string;
  team_subtitle?: string;
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
    let active = true;

    async function load() {
      try {
        const [ctx, appSettings] = await Promise.all([
          getCurrentTeamContext(),
          getCurrentTeamSettings(),
        ]);

        if (!active) return;

        const normalizedSettings: SettingsShape | null = appSettings
          ? {
              team_name: appSettings.team_name ?? undefined,
              team_subtitle: appSettings.team_subtitle ?? undefined,
              enable_events: appSettings.enable_events ?? undefined,
              enable_maintenances: appSettings.enable_maintenances ?? undefined,
              enable_notes: appSettings.enable_notes ?? undefined,
              modules: appSettings.modules ?? null,
            }
          : null;

        setTeamName(normalizedSettings?.team_name || ctx.name || "Parco Auto");
        setTeamSubtitle(
          normalizedSettings?.team_subtitle || "Gestione motorsport"
        );
        setSettings(normalizedSettings);
      } catch {
        if (!active) return;
        setSettings(null);
        setTeamName("Parco Auto");
        setTeamSubtitle("Gestione motorsport");
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const modules = settings?.modules ?? {};

  const links: NavItem[] = useMemo(
    () => [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard size={18} />,
      },
      {
        href: "/cars",
        label: "Auto",
        icon: <CarFront size={18} />,
      },
      {
        href: "/components",
        label: "Componenti",
        icon: <Boxes size={18} />,
      },
      {
        href: "/maintenances",
        label: "Manutenzioni",
        icon: <Wrench size={18} />,
        enabled: settings?.enable_maintenances !== false,
      },
      {
        href: "/mounts",
        label: "Montaggi",
        icon: <Layers3 size={18} />,
      },
      {
        href: "/calendar",
        label: "Eventi",
        icon: <CalendarDays size={18} />,
        enabled: settings?.enable_events !== false,
      },
      {
        href: "/drivers",
        label: "Piloti",
        icon: <Users size={18} />,
        enabled: modules.drivers !== false,
      },
      {
        href: "/inventory",
        label: "Magazzino",
        icon: <Package size={18} />,
        enabled: modules.inventory !== false,
      },
      {
        href: "/telemetry",
        label: "Telemetria",
        icon: <Activity size={18} />,
        enabled: modules.telemetry !== false,
      },
      {
        href: "/settings",
        label: "Impostazioni",
        icon: <Settings size={18} />,
      },
    ],
    [
      modules.drivers,
      modules.inventory,
      modules.telemetry,
      settings?.enable_events,
      settings?.enable_maintenances,
    ]
  );

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const visibleLinks = links.filter((item) => item.enabled !== false);

  const itemClass = (href: string) => {
    const active =
      pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

    return `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
      active
        ? "bg-yellow-400 text-black shadow-sm"
        : "text-neutral-300 hover:bg-white/10 hover:text-white"
    }`;
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-black p-2 text-yellow-500 shadow-lg lg:hidden"
        aria-label="Apri menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-[280px] border-r border-neutral-800 bg-neutral-950 transition-transform lg:sticky lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={`flex h-full flex-col px-4 py-5 ${audiowide.className}`}>
          <div className="mb-6 px-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-400/80">
                Battaglia Racing Car
              </div>
              <div className="mt-2 text-xl font-bold text-white">{teamName}</div>
              <div className="mt-1 text-sm text-neutral-400">{teamSubtitle}</div>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto">
            <div>
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Core
              </div>

              <nav className="space-y-1">
                {visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={itemClass(link.href)}
                    onClick={() => setOpen(false)}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}