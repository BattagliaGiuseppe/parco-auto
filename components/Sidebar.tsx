"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { Audiowide } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import { brandConfig } from "@/lib/brand";
import {
  getCurrentTeamContext,
  getCurrentTeamSettings,
  TEAM_ROLE_LABELS,
  canManageTeamRole,
} from "@/lib/teamContext";
import { getCurrentUserEffectivePermissions } from "@/lib/permissions";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";

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
  const { theme } = useBrandTheme();

  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState(brandConfig.defaultTeamName);
  const [teamSubtitle, setTeamSubtitle] = useState(brandConfig.defaultTeamSubtitle);
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);

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

        setTeamName(
          normalizedSettings?.team_name || ctx.name || theme.platformName || brandConfig.defaultTeamName
        );
        setTeamSubtitle(
          normalizedSettings?.team_subtitle || theme.platformSubtitle || brandConfig.defaultTeamSubtitle
        );
        setSettings(normalizedSettings);
        setTeamRole(ctx.role);

        try {
          const permissions = await getCurrentUserEffectivePermissions();
          if (!active) return;
          setPermissionCodes(permissions);
        } catch (error) {
          console.warn("Permessi non caricati in Sidebar:", error);
          if (!active) return;
          setPermissionCodes([]);
        }
      } catch {
        if (!active) return;
        setSettings(null);
        setTeamName(theme.platformName || brandConfig.defaultTeamName);
        setTeamSubtitle(theme.platformSubtitle || brandConfig.defaultTeamSubtitle);
        setTeamRole(null);
        setPermissionCodes([]);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [theme.platformName, theme.platformSubtitle]);

  const modules = settings?.modules ?? {};
  const has = (permissionCode: string) => permissionCodes.includes(permissionCode);
  const canManageSettings = has("settings.manage") || canManageTeamRole(teamRole);
  const canManageTeam = has("team.manage") || canManageTeamRole(teamRole);

  const links: NavItem[] = useMemo(
    () => [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard size={18} />,
      },
      {
        href: "/cars",
        label: theme.labels.vehicle,
        icon: <CarFront size={18} />,
        enabled: has("cars.view"),
      },
      {
        href: "/components",
        label: theme.labels.component,
        icon: <Boxes size={18} />,
        enabled: has("components.view"),
      },
      {
        href: "/maintenances",
        label: theme.labels.maintenance,
        icon: <Wrench size={18} />,
        enabled:
          settings?.enable_maintenances !== false && has("maintenances.view"),
      },
      {
        href: "/mounts",
        label: "Montaggi",
        icon: <Layers3 size={18} />,
        enabled: modules.mounts !== false && has("mounts.view"),
      },
      {
        href: "/calendar",
        label: theme.labels.event,
        icon: <CalendarDays size={18} />,
        enabled: settings?.enable_events !== false && has("events.view"),
      },
      {
        href: "/drivers",
        label: theme.labels.driver,
        icon: <Users size={18} />,
        enabled: modules.drivers !== false && has("drivers.view"),
      },
      {
        href: "/inventory",
        label: theme.labels.inventory,
        icon: <Package size={18} />,
        enabled: modules.inventory !== false && has("inventory.view"),
      },
      {
        href: "/telemetry",
        label: "Telemetria",
        icon: <Activity size={18} />,
        enabled: modules.telemetry !== false && has("telemetry.view"),
      },
      {
        href: "/settings",
        label: "Impostazioni",
        icon: <Settings size={18} />,
        enabled: canManageSettings,
      },
      {
        href: "/settings/team",
        label: "Team & Accessi",
        icon: <ShieldCheck size={18} />,
        enabled: canManageTeam,
      },
    ],
    [
      canManageSettings,
      canManageTeam,
      modules.drivers,
      modules.inventory,
      modules.mounts,
      modules.telemetry,
      permissionCodes,
      settings?.enable_events,
      settings?.enable_maintenances,
      theme.labels.component,
      theme.labels.driver,
      theme.labels.event,
      theme.labels.inventory,
      theme.labels.maintenance,
      theme.labels.vehicle,
    ]
  );

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const visibleLinks = links.filter((item) => item.enabled !== false);

  const activeItemStyle: CSSProperties = {
    backgroundColor: "var(--brand-accent)",
    color: "var(--brand-on-accent)",
  };

  const roleBadgeStyle: CSSProperties = {
    borderColor: "var(--brand-accent-soft)",
    backgroundColor: "var(--brand-accent-soft)",
    color: "var(--brand-accent)",
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-black p-2 shadow-lg lg:hidden"
        style={{ color: "var(--brand-accent)" }}
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
              <div className="flex items-center gap-3">
                {theme.brandingConfig.showLogoInSidebar ? (
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                    <img
                      src={theme.logoUrl || brandConfig.logoPath}
                      alt={theme.platformName}
                      className="h-11 w-11 object-contain"
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div
                    className="truncate text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "var(--brand-accent)" }}
                  >
                    {theme.vendorName}
                  </div>
                  {theme.brandingConfig.showPlatformName ? (
                    <div className="mt-1 truncate text-sm text-neutral-400">
                      {theme.platformName}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 text-xl font-bold text-white">{teamName}</div>
              <div className="mt-1 text-sm text-neutral-400">{teamSubtitle}</div>
              {teamRole ? (
                <div
                  className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
                  style={roleBadgeStyle}
                >
                  Ruolo: {TEAM_ROLE_LABELS[teamRole as keyof typeof TEAM_ROLE_LABELS] || teamRole}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto">
            <div>
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Core
              </div>

              <nav className="space-y-1">
                {visibleLinks.map((link) => {
                  const active =
                    pathname === link.href ||
                    (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        active
                          ? ""
                          : "text-neutral-300 hover:bg-white/10 hover:text-white"
                      }`}
                      style={active ? activeItemStyle : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {link.icon}
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
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
