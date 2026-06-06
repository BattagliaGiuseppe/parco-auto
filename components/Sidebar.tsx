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
  ClipboardList,
  TimerReset,
} from "lucide-react";
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
import { MODULE_REGISTRY, getModuleLabel, isModuleEnabled, type ModuleId } from "@/lib/controlCenter";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  enabled?: boolean;
};

type SettingsShape = {
  enable_events?: boolean;
  enable_maintenances?: boolean;
  modules?: Record<string, boolean> | null;
  labels?: Record<string, string> | null;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useBrandTheme();

  const [open, setOpen] = useState(false);
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
              enable_events: appSettings.enable_events ?? undefined,
              enable_maintenances: appSettings.enable_maintenances ?? undefined,
              modules: appSettings.modules ?? null,
              labels: appSettings.labels ?? null,
            }
          : null;

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
        setTeamRole(null);
        setPermissionCodes([]);
      }
    }

    void load();

    const refreshHandler = () => {
      void load();
    };

    window.addEventListener("branding:refresh", refreshHandler);

    return () => {
      active = false;
      window.removeEventListener("branding:refresh", refreshHandler);
    };
  }, []);

  const has = (permissionCode: string) => permissionCodes.includes(permissionCode);
  const canManageSettings = has("settings.manage") || canManageTeamRole(teamRole);
  const canManageTeam = has("team.manage") || canManageTeamRole(teamRole);

  const moduleIcons: Partial<Record<ModuleId, ReactNode>> = {
    cars: <CarFront size={18} />,
    components: <Boxes size={18} />,
    maintenances: <Wrench size={18} />,
    mounts: <Layers3 size={18} />,
    events: <CalendarDays size={18} />,
    drivers: <Users size={18} />,
    inventory: <Package size={18} />,
    telemetry: <Activity size={18} />,
    tasks: <ClipboardList size={18} />,
    attendance: <TimerReset size={18} />,
  };

  const links: NavItem[] = useMemo(() => {
    const moduleLinks: NavItem[] = MODULE_REGISTRY
      .filter((module) => module.visibleInControlCenter && module.route !== "/cars")
      .map((module) => ({
        href: module.route,
        label: getModuleLabel(module.id, theme.labels),
        icon: moduleIcons[module.id] || <LayoutDashboard size={18} />,
        enabled:
          isModuleEnabled(settings, module.id) &&
          (!module.permission || has(module.permission)),
      }));

    return [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
      {
        href: "/cars",
        label: getModuleLabel("cars", theme.labels),
        icon: <CarFront size={18} />,
        enabled: isModuleEnabled(settings, "cars") && has("cars.view"),
      },
      ...moduleLinks,
      { href: "/settings", label: getModuleLabel("settings", theme.labels), icon: <Settings size={18} />, enabled: canManageSettings },
      { href: "/settings/team", label: getModuleLabel("team_access", theme.labels), icon: <ShieldCheck size={18} />, enabled: canManageTeam },
    ];
  }, [canManageSettings, canManageTeam, permissionCodes, settings, teamRole, theme.labels]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const visibleLinks = links.filter((item) => item.enabled !== false);

  const asideStyle: CSSProperties = {
    background:
      "radial-gradient(circle at 8% 6%, rgba(var(--brand-primary-rgb),0.32), transparent 16rem), radial-gradient(circle at 88% 14%, rgba(var(--brand-accent-rgb),0.12), transparent 13rem), linear-gradient(180deg, rgba(8,11,15,0.99), rgba(10,15,21,0.99)), linear-gradient(135deg, rgba(255,255,255,0.05) 0 25%, transparent 25% 50%, rgba(255,255,255,0.025) 50% 75%, transparent 75%) 0 0 / 28px 28px",
    borderRightColor: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    boxShadow: "18px 0 52px rgba(0,0,0,0.34)",
  };

  const mobileButtonStyle: CSSProperties = {
    backgroundColor: "var(--brand-primary)",
    color: "var(--brand-accent)",
  };

  const fixedBrandCardStyle: CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
  };

  const teamCardStyle: CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
  };

  const secondaryBadgeStyle: CSSProperties = {
    backgroundColor: "var(--brand-secondary-soft)",
    borderColor: "var(--brand-secondary-soft)",
    color: "#ffffff",
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 rounded-lg p-2 shadow-lg lg:hidden"
        style={mobileButtonStyle}
        aria-label="Apri menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-[280px] border-r transition-transform lg:sticky lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={asideStyle}
      >
        <div className={`flex h-full flex-col px-4 py-5`}>
          {theme.brandingConfig.showPlatformNameInSidebar ? (
            <div className="mb-4 px-2">
              <div className="rounded-2xl border px-4 py-3" style={fixedBrandCardStyle}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                  <img
                    src={brandConfig.logoPath}
                    alt={brandConfig.appName}
                    className="h-11 w-11 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                    piattaforma
                  </div>
                  <div className="truncate text-sm font-black tracking-tight text-white">
                    {brandConfig.appName}
                  </div>
                </div>
              </div>
              </div>
            </div>
          ) : null}

          <div className="mb-6 px-2">
            <div className="rounded-3xl border px-4 py-4" style={teamCardStyle}>
              <div className="flex items-center gap-3">
                {theme.brandingConfig.showLogoInSidebar ? (
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                    <img
                      src={theme.sidebarLogoUrl || "/logo.png"}
                      alt={theme.teamName}
                      className="h-11 w-11 object-contain"
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div
                    className="truncate text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "var(--brand-accent)" }}
                  >
                    team
                  </div>
                  <div className="mt-1 truncate text-lg font-black tracking-tight text-white">{theme.teamName}</div>
                </div>
              </div>

              {theme.teamSubtitle ? (
                <div className="mt-2 text-sm text-white/70">{theme.teamSubtitle}</div>
              ) : null}

              {teamRole ? (
                <div
                  className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
                  style={secondaryBadgeStyle}
                >
                  Ruolo: {TEAM_ROLE_LABELS[teamRole as keyof typeof TEAM_ROLE_LABELS] || teamRole}
                </div>
              ) : null}
            </div>
          </div>

          <div className="sidebar-scroll flex-1 space-y-6 overflow-y-auto pr-1">
            <div>
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
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
                      className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
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
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.42)]" />
                <div>
                  <div className="text-sm font-extrabold text-white">Tutto operativo</div>
                  <div className="mt-0.5 text-xs text-white/52">Sistema sincronizzato</div>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
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
