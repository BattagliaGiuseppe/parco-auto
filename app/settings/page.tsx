"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Save,
  Settings,
  Blocks,
  LayoutPanelTop,
  ShieldCheck,
  Wrench,
  PlusCircle,
  Trash2,
  Info,
  Image as ImageIcon,
  MonitorSmartphone,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { uploadTeamFile } from "@/lib/storage";
import { dispatchBrandingRefresh } from "@/lib/brandingTheme";
import { brandConfig } from "@/lib/brand";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import { usePermissionAccess } from "@/lib/permissions";

type BrandingConfig = {
  showLogoInHeader: boolean;
  showLogoInSidebar: boolean;
  showLogoInPrint: boolean;
  showPlatformNameInHeader: boolean;
  showPlatformNameInSidebar: boolean;
  compactHeader: boolean;
  printLetterheadMode: string;
};

type BrandingPayload = {
  sidebar_logo_url: string;
  header_logo_url: string;
  print_logo_url: string;
  language: string;
  branding_config: BrandingConfig;
};

type AppSettingsRow = {
  id: string;
  team_id: string;
  team_name: string;
  team_subtitle: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  vehicle_type: string;
  default_warning_hours: number;
  default_revision_hours: number;
  default_expiry_alert_days: number;
  modules: Record<string, boolean> | null;
  dashboard_layout: any;
  labels?: Record<string, string> | null;
  branding?: BrandingPayload;
};

type ComponentDefinition = {
  id: string;
  code: string;
  label: string;
  category: string;
  is_required: boolean;
  tracks_hours: boolean;
  has_expiry: boolean;
  default_expiry_years: number | null;
  order_index: number;
};

type ChecklistGroup = {
  id: string;
  name: string;
  order_index: number;
  items: ChecklistItem[];
};

type ChecklistItem = {
  id: string;
  label: string;
  input_type: string;
  is_required: boolean;
  order_index: number;
};

type SetupField = {
  id: string;
  field_key: string;
  label: string;
  group_name: string;
  field_type: string;
  unit: string | null;
  position: string;
  order_index: number;
  is_required: boolean;
};

type DashboardWidget = {
  id: string;
  role_scope: string;
  widget_code: string;
  label: string;
  is_enabled: boolean;
  size: string;
  order_index: number;
};

const DEFAULT_MODULES = {
  drivers: true,
  performance: true,
  inventory: true,
  telemetry: true,
  documents: true,
  mounts: true,
};

const DEFAULT_LABELS = {
  vehicle: "Auto",
  driver: "Pilota",
  event: "Evento",
  turn: "Turno",
  component: "Componente",
  maintenance: "Manutenzione",
  inventory: "Magazzino",
};

const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  showLogoInHeader: true,
  showLogoInSidebar: true,
  showLogoInPrint: true,
  showPlatformNameInHeader: true,
  showPlatformNameInSidebar: true,
  compactHeader: false,
  printLetterheadMode: "logo_title_subtitle",
};

function SectionTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const tabs = [
    ["branding", "Branding"],
    ["general", "Generale"],
    ["components", "Componenti standard"],
    ["checklists", "Check-up"],
    ["setup", "Setup"],
    ["dashboard", "Dashboard"],
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            value === key
              ? "bg-[var(--brand-accent)] text-[var(--brand-on-accent)]"
              : "bg-neutral-200 text-[var(--text-secondary)] hover:bg-neutral-300"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-semibold text-[var(--text-secondary)]">
      {children}
    </label>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{hint}</div> : null}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-3 text-sm text-[var(--text-secondary)] shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15 ${
        props.className || ""
      }`.trim()}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-3 text-sm text-[var(--text-secondary)] shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15 ${
        props.className || ""
      }`.trim()}
    />
  );
}

function ToggleBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

function normalizeHex(value: string, fallback: string) {
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value || "")) return fallback;
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return value.toLowerCase();
}

function hexToRgb(hex: string) {
  const safe = normalizeHex(hex, "#000000").replace("#", "");
  const bigint = parseInt(safe, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function hexToRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function contrastText(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

function buildBrandingFromSettings(settings?: AppSettingsRow | null): BrandingPayload {
  const brandingFromLayout = settings?.dashboard_layout?.branding || {};
  return {
    sidebar_logo_url:
      settings?.branding?.sidebar_logo_url ||
      brandingFromLayout.sidebar_logo_url ||
      settings?.branding?.header_logo_url ||
      brandingFromLayout.header_logo_url ||
      "/logo.png",
    header_logo_url:
      settings?.branding?.header_logo_url ||
      brandingFromLayout.header_logo_url ||
      settings?.branding?.sidebar_logo_url ||
      brandingFromLayout.sidebar_logo_url ||
      "/logo.png",
    print_logo_url:
      settings?.branding?.print_logo_url ||
      brandingFromLayout.print_logo_url ||
      settings?.branding?.header_logo_url ||
      brandingFromLayout.header_logo_url ||
      settings?.branding?.sidebar_logo_url ||
      brandingFromLayout.sidebar_logo_url ||
      "/logo.png",
    language:
      settings?.branding?.language || brandingFromLayout.language || "it",
    branding_config: {
      ...DEFAULT_BRANDING_CONFIG,
      ...(brandingFromLayout.branding_config || {}),
      ...(settings?.branding?.branding_config || {}),
    },
  };
}

function buildDefaultSettings(teamId: string, teamName: string): AppSettingsRow {
  const base: AppSettingsRow = {
    id: "",
    team_id: teamId,
    team_name: teamName || "Team",
    team_subtitle: "",
    primary_color: "#171717",
    secondary_color: "#262626",
    accent_color: "#facc15",
    vehicle_type: "auto",
    default_warning_hours: 0,
    default_revision_hours: 0,
    default_expiry_alert_days: 30,
    modules: DEFAULT_MODULES,
    dashboard_layout: {},
    labels: DEFAULT_LABELS,
    branding: undefined,
  };

  return {
    ...base,
    branding: buildBrandingFromSettings(base),
  };
}

function BrandPreview({
  teamName,
  teamSubtitle,
  sidebarLogoUrl,
  headerLogoUrl,
  printLogoUrl,
  primaryColor,
  secondaryColor,
  accentColor,
  labels,
  config,
}: {
  teamName: string;
  teamSubtitle: string;
  sidebarLogoUrl: string;
  headerLogoUrl: string;
  printLogoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  labels: Record<string, string>;
  config: BrandingConfig;
}) {
  const onAccent = contrastText(accentColor);
  const secondarySoft = hexToRgba(secondaryColor, 0.16);
  const accentSoft = hexToRgba(accentColor, 0.18);

  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,23,31,0.96)] p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Anteprima realistica branding team
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Il brand piattaforma compare solo nella sidebar e nel piè di pagina delle stampe.
        Nell&apos;header pagina compare solo il branding del team, se attivato.
      </div>

      <div className="mt-5 overflow-hidden rounded-[28px] border border-white/10 shadow-sm">
        <div className="grid grid-cols-[240px_1fr]">
          <div className="min-h-[340px] p-4 text-white" style={{ backgroundColor: primaryColor }}>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                  <img
                    src={brandConfig.logoPath}
                    alt={brandConfig.appName}
                    className="h-10 w-10 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                    piattaforma
                  </div>
                  <div className="truncate text-sm font-bold text-white">
                    {brandConfig.appName}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border p-4" style={{ backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}>
              <div className="flex items-center gap-3">
                {config.showLogoInSidebar ? (
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                    <img
                      src={sidebarLogoUrl || "/logo.png"}
                      alt={teamName || "Team"}
                      className="h-10 w-10 object-contain"
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accentColor }}>
                    team
                  </div>
                  <div className="mt-1 truncate text-lg font-bold text-white">
                    {teamName || "Nome team"}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-sm text-white/70">
                {teamSubtitle || "Sottotitolo team"}
              </div>

              <div
                className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: secondarySoft, borderColor: secondarySoft, color: "#fff" }}
              >
                Badge secondario team
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {[labels.vehicle, labels.driver, labels.event, labels.component].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-white/90"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface-page)] p-4">
            <div className="rounded-[28px] border border-white/10 bg-[rgba(16,23,31,0.96)] p-5 shadow-sm">
              <div className={`rounded-[24px] border border-white/10 bg-[rgba(16,23,31,0.96)] shadow-sm ${config.compactHeader ? "p-4" : "p-5"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    {config.showLogoInHeader ? (
                      <div className="mb-3 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[rgba(16,23,31,0.96)]">
                          <img
                            src={headerLogoUrl || "/logo.png"}
                            alt={teamName || "Team"}
                            className="h-6 w-6 object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                            team
                          </div>
                          <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                            {teamName || "Nome team"}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className={`${config.compactHeader ? "text-2xl" : "text-3xl"} font-black tracking-tight text-[var(--text-primary)]`}>
                      {labels.event} · Preview
                    </div>
                    <div className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                      Header pagina con solo branding team, senza brand piattaforma.
                    </div>
                  </div>

                  <button
                    className="rounded-xl px-4 py-2 text-sm font-bold"
                    style={{ backgroundColor: accentColor, color: onAccent }}
                  >
                    Azione primaria
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Stampa scheda
                </div>
                <div className="mt-4 rounded-[24px] border border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {config.showLogoInPrint && config.printLetterheadMode !== "title_only" ? (
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]">
                          <img src={printLogoUrl || "/logo.png"} alt={teamName || "Team"} className="h-9 w-9 object-contain" />
                        </div>
                      ) : null}
                      <div>
                        <div className="text-lg font-black text-[var(--text-primary)]">{teamName || "Nome team"}</div>
                        {config.printLetterheadMode === "logo_title_subtitle" ? (
                          <div className="mt-1 text-sm text-[var(--text-muted)]">
                            {teamSubtitle || "Sottotitolo team"}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                      {config.printLetterheadMode}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-dashed border-white/10 pt-3 text-xs text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      <img src={brandConfig.logoPath} alt={brandConfig.appName} className="h-4 w-4 object-contain" />
                      <span className="font-semibold">{brandConfig.appName}</span>
                      <span>· Tutti i diritti riservati.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[labels.vehicle, labels.component, labels.maintenance].map((label, index) => (
                  <div
                    key={`${label}-${index}`}
                    className="rounded-[24px] border border-white/10 bg-[rgba(16,23,31,0.96)] p-4 shadow-sm"
                  >
                    <div className="text-sm font-semibold text-[var(--text-muted)]">{label}</div>
                    <div className="mt-2 text-2xl font-black text-[var(--text-primary)]">{index + 2}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">Card KPI</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
}

export default function SettingsPage() {
  const access = usePermissionAccess();
  const [settings, setSettings] = useState<AppSettingsRow | null>(null);
  const [definitions, setDefinitions] = useState<ComponentDefinition[]>([]);
  const [checklists, setChecklists] = useState<ChecklistGroup[]>([]);
  const [setupFields, setSetupFields] = useState<SetupField[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"sidebar" | "header" | "print" | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [section, setSection] = useState("branding");

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [settingsRes, defsRes, groupsRes, itemsRes, setupRes, widgetsRes] =
        await Promise.all([
          supabase.from("app_settings").select("*").eq("team_id", ctx.teamId).single(),
          supabase
            .from("team_component_definitions")
            .select("*")
            .eq("team_id", ctx.teamId)
            .order("order_index", { ascending: true }),
          supabase
            .from("team_checklists")
            .select("*")
            .eq("team_id", ctx.teamId)
            .order("order_index", { ascending: true }),
          supabase
            .from("team_checklist_items")
            .select("*")
            .eq("team_id", ctx.teamId)
            .order("order_index", { ascending: true }),
          supabase
            .from("team_setup_fields")
            .select("*")
            .eq("team_id", ctx.teamId)
            .order("order_index", { ascending: true }),
          supabase
            .from("team_dashboard_widgets")
            .select("*")
            .eq("team_id", ctx.teamId)
            .order("order_index", { ascending: true }),
        ]);

      const rawSettings = (settingsRes.data as AppSettingsRow | null) ?? buildDefaultSettings(ctx.teamId, ctx.name || "Team");

      if (settingsRes.error && settingsRes.error.code !== "PGRST116") {
        console.warn("Errore caricamento app_settings:", settingsRes.error);
      }

      const normalizedSettings: AppSettingsRow = {
        ...rawSettings,
        dashboard_layout: rawSettings.dashboard_layout || {},
        modules: { ...DEFAULT_MODULES, ...(rawSettings.modules || {}) },
        labels: { ...DEFAULT_LABELS, ...(rawSettings.labels || {}) },
        branding: buildBrandingFromSettings(rawSettings),
      };

      setSettings(normalizedSettings);
      setDefinitions((defsRes.data || []) as ComponentDefinition[]);
      setSetupFields((setupRes.data || []) as SetupField[]);
      setWidgets((widgetsRes.data || []) as DashboardWidget[]);

      const groups = (groupsRes.data || []) as any[];
      const items = (itemsRes.data || []) as any[];
      setChecklists(
        groups.map((group) => ({
          ...group,
          items: items.filter((item) => item.checklist_id === group.id),
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && access.canManageSettings) {
      void loadAll();
    }
  }, [access.loading, access.canManageSettings]);

  if (access.loading) {
    return (
      <PagePermissionState
        title="Control Center"
        subtitle="Configurazione avanzata del team"
        icon={<Settings size={20} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Control Center"
        subtitle="Configurazione avanzata del team"
        icon={<Settings size={20} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!access.canManageSettings) {
    return (
      <PagePermissionState
        title="Control Center"
        subtitle="Configurazione avanzata del team"
        icon={<Settings size={20} />}
        state="denied"
        message="Solo owner e admin possono aprire e modificare il control center del team."
      />
    );
  }

  const stats: StatItem[] = [
    {
      label: "Componenti standard",
      value: String(definitions.length),
      icon: <Blocks size={18} />,
      helper: "Definizioni base del mezzo",
    },
    {
      label: "Checklist",
      value: String(checklists.length),
      icon: <Wrench size={18} />,
      helper: "Gruppi check-up configurati",
    },
    {
      label: "Campi setup",
      value: String(setupFields.length),
      icon: <LayoutPanelTop size={18} />,
      helper: "Campi dinamici disponibili",
    },
    {
      label: "Moduli attivi",
      value: String(
        Object.values(settings?.modules || DEFAULT_MODULES).filter(Boolean).length
      ),
      icon: <ShieldCheck size={18} />,
      helper: "Funzioni abilitate nel team",
    },
  ];

  function patchSetting<K extends keyof AppSettingsRow>(
    key: K,
    value: AppSettingsRow[K]
  ) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  function patchBranding<K extends keyof BrandingPayload>(
    key: K,
    value: BrandingPayload[K]
  ) {
    if (!settings) return;
    setSettings({
      ...settings,
      branding: {
        ...(settings.branding || buildBrandingFromSettings(settings)),
        [key]: value,
      },
    });
  }

  function patchBrandingConfig<K extends keyof BrandingConfig>(
    key: K,
    value: BrandingConfig[K]
  ) {
    if (!settings) return;
    const currentBranding = settings.branding || buildBrandingFromSettings(settings);
    setSettings({
      ...settings,
      branding: {
        ...currentBranding,
        branding_config: {
          ...DEFAULT_BRANDING_CONFIG,
          ...currentBranding.branding_config,
          [key]: value,
        },
      },
    });
  }

async function uploadBrandAsset(kind: "sidebar" | "header" | "print", file: File) {
  if (!settings) return;
  setUploadingAsset(kind);
  setFeedback(null);

  try {
    const upload = await uploadTeamFile({
      file,
      area:
        kind === "sidebar"
          ? "team-sidebar-logo"
          : kind === "header"
          ? "team-header-logo"
          : "team-print-logo",
      recordId: "team-branding",
    });

    patchBranding(
      kind === "sidebar"
        ? "sidebar_logo_url"
        : kind === "header"
        ? "header_logo_url"
        : "print_logo_url",
      upload.publicUrl
    );

    setFeedback({
      type: "success",
      message:
        kind === "sidebar"
          ? "Logo sidebar caricato. Ricorda di salvare le impostazioni."
          : kind === "header"
          ? "Logo header caricato. Ricorda di salvare le impostazioni."
          : "Logo stampa caricato. Ricorda di salvare le impostazioni.",
    });
  } catch (error) {
    console.error(error);
    setFeedback({
      type: "error",
      message:
        kind === "sidebar"
          ? "Errore caricamento logo sidebar."
          : kind === "header"
          ? "Errore caricamento logo header."
          : "Errore caricamento logo stampa.",
    });
  } finally {
    setUploadingAsset(null);
  }
}

async function saveAll() {
    if (!settings) return;
    setSaving(true);
    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();

      const dashboardLayout = {
        ...(settings.dashboard_layout || {}),
        branding: {
          sidebar_logo_url: settings.branding?.sidebar_logo_url || "",
          header_logo_url: settings.branding?.header_logo_url || "",
          print_logo_url: settings.branding?.print_logo_url || "",
          language: settings.branding?.language || "it",
          branding_config: {
            ...DEFAULT_BRANDING_CONFIG,
            ...(settings.branding?.branding_config || {}),
          },
        },
      };

      const { error: settingsError } = await supabase
        .from("app_settings")
        .upsert({
          ...(settings.id ? { id: settings.id } : {}),
          team_id: ctx.teamId,
          team_name: settings.team_name,
          team_subtitle: settings.team_subtitle,
          primary_color: normalizeHex(settings.primary_color, "#171717"),
          secondary_color: normalizeHex(settings.secondary_color, "#262626"),
          accent_color: normalizeHex(settings.accent_color, "#facc15"),
          vehicle_type: settings.vehicle_type,
          default_warning_hours: settings.default_warning_hours,
          default_revision_hours: settings.default_revision_hours,
          default_expiry_alert_days: settings.default_expiry_alert_days,
          modules: settings.modules,
          dashboard_layout: dashboardLayout,
          labels: settings.labels || DEFAULT_LABELS,
        }, { onConflict: "team_id" });

      if (settingsError) throw settingsError;

      const cleanDefinitions = definitions
        .filter((row) => row.code.trim() && row.label.trim())
        .map((row, index) => ({
          team_id: ctx.teamId,
          code: row.code.trim(),
          label: row.label.trim(),
          category: row.category,
          is_required: row.is_required,
          tracks_hours: row.tracks_hours,
          has_expiry: row.has_expiry,
          default_expiry_years: row.has_expiry ? row.default_expiry_years || 1 : null,
          order_index: index + 1,
        }));

      await supabase
        .from("team_component_definitions")
        .delete()
        .eq("team_id", ctx.teamId);

      if (cleanDefinitions.length) {
        const { error } = await supabase
          .from("team_component_definitions")
          .insert(cleanDefinitions);
        if (error) throw error;
      }

      await supabase.from("team_checklist_items").delete().eq("team_id", ctx.teamId);
      await supabase.from("team_checklists").delete().eq("team_id", ctx.teamId);

      for (let index = 0; index < checklists.length; index++) {
        const group = checklists[index];
        if (!group.name.trim()) continue;

        const { data: createdGroup, error: groupError } = await supabase
          .from("team_checklists")
          .insert([
            {
              team_id: ctx.teamId,
              name: group.name.trim(),
              order_index: index + 1,
            },
          ])
          .select("*")
          .single();

        if (groupError) throw groupError;

        const itemRows = group.items
          .filter((item) => item.label.trim())
          .map((item, itemIndex) => ({
            team_id: ctx.teamId,
            checklist_id: createdGroup.id,
            label: item.label.trim(),
            input_type: item.input_type || "status",
            is_required: item.is_required,
            order_index: itemIndex + 1,
          }));

        if (itemRows.length) {
          const { error: itemError } = await supabase
            .from("team_checklist_items")
            .insert(itemRows);
          if (itemError) throw itemError;
        }
      }

      const cleanSetupFields = setupFields
        .filter((field) => field.field_key.trim() && field.label.trim())
        .map((field, index) => ({
          team_id: ctx.teamId,
          field_key: field.field_key.trim(),
          label: field.label.trim(),
          group_name: field.group_name || "Generale",
          field_type: field.field_type || "text",
          unit: field.unit || null,
          position: field.position || "left",
          order_index: index + 1,
          is_required: field.is_required,
        }));

      await supabase.from("team_setup_fields").delete().eq("team_id", ctx.teamId);
      if (cleanSetupFields.length) {
        const { error } = await supabase
          .from("team_setup_fields")
          .insert(cleanSetupFields);
        if (error) throw error;
      }

      const cleanWidgets = widgets
        .filter((widget) => widget.widget_code.trim() && widget.label.trim())
        .map((widget, index) => ({
          team_id: ctx.teamId,
          role_scope: widget.role_scope || "all",
          widget_code: widget.widget_code.trim(),
          label: widget.label.trim(),
          is_enabled: widget.is_enabled,
          size: widget.size || "md",
          order_index: index + 1,
          config: {},
        }));

      await supabase
        .from("team_dashboard_widgets")
        .delete()
        .eq("team_id", ctx.teamId);

      if (cleanWidgets.length) {
        const { error } = await supabase
          .from("team_dashboard_widgets")
          .insert(cleanWidgets);
        if (error) throw error;
      }

      dispatchBrandingRefresh();

      setFeedback({
        type: "success",
        message: "Control Center aggiornato correttamente.",
      });
      await loadAll();
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: "Errore salvataggio impostazioni.",
      });
    } finally {
      setSaving(false);
    }
  }

  const previewBranding = settings ? settings.branding || buildBrandingFromSettings(settings) : null;

  if (loading || !settings || !previewBranding) {
    return (
      <div className={`flex flex-col gap-6 p-6`}>
        <div className="rounded-3xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-6 py-5 text-sm text-[var(--text-muted)] shadow-sm">
          Caricamento impostazioni...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title="Control Center"
        subtitle="Branding, moduli, template mezzo, checklist, setup e dashboard del team"
        icon={<Settings size={22} />}
        actions={
          <button
            onClick={saveAll}
            disabled={saving}
            className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} className="mr-2 inline" />
            {saving ? "Salvataggio..." : "Salva impostazioni"}
          </button>
        }
      />

      {feedback ? (
        <FormStatusBanner type={feedback.type} message={feedback.message} />
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Questa pagina governa il comportamento standard della piattaforma per tutto il team."
      >
        <InfoBlock>
          Qui definisci branding, moduli attivi, componenti standard, checklist, setup dinamico
          e dashboard. Le impostazioni salvate diventano la base operativa del team e influenzano
          direttamente il lavoro su auto, componenti, eventi e check-up.
        </InfoBlock>
      </SectionCard>

      <SectionCard
        title="Aree configurabili"
        subtitle="Scegli il gruppo di impostazioni su cui lavorare."
      >
        <SectionTabs value={section} onChange={setSection} />
      </SectionCard>

      {section === "branding" ? (
  <div className="space-y-6">
    <SectionCard
      title="Branding team"
      subtitle="Il brand della piattaforma resta fisso: compare solo nella sidebar e nel piè di pagina delle stampe. Qui il team personalizza solo nome, loghi, colori e terminologia."
    >
      <InfoBlock>
        Il nome e il logo della piattaforma sono gestiti centralmente. Restano visibili solo nella sidebar e nel piè di pagina delle stampe. In questa sezione il cliente personalizza solo il proprio team: nome, sottotitolo, loghi dedicati, colori e lessico operativo.
      </InfoBlock>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Brand piattaforma fisso
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)]">
            <img src={brandConfig.logoPath} alt={brandConfig.appName} className="h-9 w-9 object-contain" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{brandConfig.appName}</div>
            <div className="text-xs text-[var(--text-muted)]">{brandConfig.appDescription}</div>
          </div>
        </div>
      </div>
    </SectionCard>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard
        title="Identità team"
        subtitle="Nome team, sottotitolo e loghi dedicati per sidebar, header e stampa."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome team" hint="Titolo principale mostrato nella sidebar, nell’header team e nelle stampe.">
            <Input
              value={settings.team_name}
              onChange={(e) => patchSetting("team_name", e.target.value)}
              placeholder="Es. Battaglia Racing Car"
            />
          </Field>

          <Field label="Sottotitolo team">
            <Input
              value={settings.team_subtitle || ""}
              onChange={(e) => patchSetting("team_subtitle", e.target.value)}
              placeholder="Es. Racing Team · SuperF1000"
            />
          </Field>

          <Field label="Lingua piattaforma">
            <Select
              value={previewBranding.language}
              onChange={(e) => patchBranding("language", e.target.value)}
            >
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Logo sidebar" hint="Fallback: logo header o logo base.">
            <Input
              value={previewBranding.sidebar_logo_url}
              onChange={(e) => patchBranding("sidebar_logo_url", e.target.value)}
              placeholder="/logo-sidebar.png"
            />
          </Field>

          <Field label="Logo header" hint="Usato nelle intestazioni delle pagine.">
            <Input
              value={previewBranding.header_logo_url}
              onChange={(e) => patchBranding("header_logo_url", e.target.value)}
              placeholder="/logo-header.png"
            />
          </Field>

          <Field label="Logo stampa" hint="Usato nelle pagine stampabili.">
            <Input
              value={previewBranding.print_logo_url}
              onChange={(e) => patchBranding("print_logo_url", e.target.value)}
              placeholder="/logo-print.png"
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <ImageIcon size={16} />
              Upload logo sidebar
            </div>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-white/[0.045]">
              Carica logo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBrandAsset("sidebar", file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              {uploadingAsset === "sidebar"
                ? "Caricamento logo sidebar..."
                : previewBranding.sidebar_logo_url || "Nessun logo sidebar selezionato"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <MonitorSmartphone size={16} />
              Upload logo header
            </div>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-white/[0.045]">
              Carica logo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBrandAsset("header", file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              {uploadingAsset === "header"
                ? "Caricamento logo header..."
                : previewBranding.header_logo_url || "Nessun logo header selezionato"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <ImageIcon size={16} />
              Upload logo stampa
            </div>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-white/[0.045]">
              Carica logo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBrandAsset("print", file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              {uploadingAsset === "print"
                ? "Caricamento logo stampa..."
                : previewBranding.print_logo_url || "Nessun logo stampa selezionato"}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ToggleBox
            label="Logo team in sidebar"
            checked={previewBranding.branding_config.showLogoInSidebar}
            onChange={(checked) => patchBrandingConfig("showLogoInSidebar", checked)}
          />
          <ToggleBox
            label="Logo team in header"
            checked={previewBranding.branding_config.showLogoInHeader}
            onChange={(checked) => patchBrandingConfig("showLogoInHeader", checked)}
          />
          <ToggleBox
            label="Logo team in stampa"
            checked={previewBranding.branding_config.showLogoInPrint}
            onChange={(checked) => patchBrandingConfig("showLogoInPrint", checked)}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToggleBox
            label="Header compatto"
            checked={previewBranding.branding_config.compactHeader}
            onChange={(checked) => patchBrandingConfig("compactHeader", checked)}
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-[var(--text-secondary)]">
            Il brand piattaforma non compare nelle intestazioni pagina: resta fisso solo nella sidebar e nel piè di pagina delle stampe.
          </div>
        </div>

        <div className="mt-4">
          <Field label="Carta intestata stampa">
            <Select
              value={previewBranding.branding_config.printLetterheadMode}
              onChange={(e) =>
                patchBrandingConfig("printLetterheadMode", e.target.value)
              }
            >
              <option value="logo_title_subtitle">Logo + nome team + sottotitolo</option>
              <option value="logo_title">Logo + nome team</option>
              <option value="title_only">Solo nome team</option>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Colori e terminologia"
        subtitle="Primary governa soprattutto la sidebar, accent governa le azioni principali, secondary i dettagli brand secondari."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Primary color" hint="Controlla soprattutto la sidebar e le superfici brand strutturali.">
            <Input
              type="color"
              className="h-12 p-1"
              value={normalizeHex(settings.primary_color, "#171717")}
              onChange={(e) => patchSetting("primary_color", e.target.value)}
            />
          </Field>
          <Field label="Secondary color" hint="Usato per dettagli brand secondari, badge e superfici soft.">
            <Input
              type="color"
              className="h-12 p-1"
              value={normalizeHex(settings.secondary_color, "#262626")}
              onChange={(e) => patchSetting("secondary_color", e.target.value)}
            />
          </Field>
          <Field label="Accent color" hint="Governa pulsanti primari, evidenziazioni e highlight principali.">
            <Input
              type="color"
              className="h-12 p-1"
              value={normalizeHex(settings.accent_color, "#facc15")}
              onChange={(e) => patchSetting("accent_color", e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Object.entries(settings.labels || DEFAULT_LABELS).map(([key, value]) => (
            <Field key={key} label={`Etichetta ${key}`}>
              <Input
                value={value}
                onChange={(e) =>
                  patchSetting("labels", {
                    ...(settings.labels || DEFAULT_LABELS),
                    [key]: e.target.value,
                  })
                }
              />
            </Field>
          ))}
        </div>
      </SectionCard>
    </div>

    <BrandPreview
      teamName={settings.team_name}
      teamSubtitle={settings.team_subtitle || ""}
      sidebarLogoUrl={previewBranding.sidebar_logo_url}
      headerLogoUrl={previewBranding.header_logo_url}
      printLogoUrl={previewBranding.print_logo_url}
      primaryColor={normalizeHex(settings.primary_color, "#171717")}
      secondaryColor={normalizeHex(settings.secondary_color, "#262626")}
      accentColor={normalizeHex(settings.accent_color, "#facc15")}
      labels={{ ...DEFAULT_LABELS, ...(settings.labels || {}) }}
      config={previewBranding.branding_config}
    />
  </div>
) : null}

      {section === "general" ? (
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
    <SectionCard
      title="Configurazione operativa"
      subtitle="Impostazioni base del mezzo e del comportamento generale del team."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Tipo mezzo">
          <Select
            value={settings.vehicle_type}
            onChange={(e) => patchSetting("vehicle_type", e.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="moto">Moto</option>
            <option value="kart">Kart</option>
            <option value="formula">Formula</option>
            <option value="custom">Custom</option>
          </Select>
        </Field>
      </div>
    </SectionCard>

    <SectionCard
            title="Moduli e soglie"
            subtitle="Attiva i moduli e governa alert e soglie di default."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Object.entries({ ...(settings.modules || DEFAULT_MODULES) }).map(
                ([key, enabled]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3"
                  >
                    <span className="font-semibold capitalize text-[var(--text-primary)]">
                      {key}
                    </span>
                    <input
                      type="checkbox"
                      checked={!!enabled}
                      onChange={(e) =>
                        patchSetting("modules", {
                          ...(settings.modules || DEFAULT_MODULES),
                          [key]: e.target.checked,
                        })
                      }
                    />
                  </label>
                )
              )}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Warning ore default">
                <Input
                  type="number"
                  value={settings.default_warning_hours}
                  onChange={(e) =>
                    patchSetting("default_warning_hours", Number(e.target.value || 0))
                  }
                />
              </Field>
              <Field label="Revisione ore default">
                <Input
                  type="number"
                  value={settings.default_revision_hours}
                  onChange={(e) =>
                    patchSetting("default_revision_hours", Number(e.target.value || 0))
                  }
                />
              </Field>
              <Field label="Alert scadenza (giorni)">
                <Input
                  type="number"
                  value={settings.default_expiry_alert_days}
                  onChange={(e) =>
                    patchSetting(
                      "default_expiry_alert_days",
                      Number(e.target.value || 0)
                    )
                  }
                />
              </Field>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {section === "components" ? (
        <SectionCard
          title="Componenti standard configurabili"
          subtitle="Definiscono il modulo Auto, la scheda mezzo e la struttura base del parco."
        >
          {definitions.length === 0 ? (
            <EmptyState
              title="Nessuna definizione presente"
              description="Aggiungi le voci base del tuo mezzo."
            />
          ) : null}
          <div className="space-y-3">
            {definitions.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 lg:grid-cols-[1fr_1.2fr_150px_110px_110px_120px_40px]"
              >
                <Input
                  value={row.code}
                  onChange={(e) =>
                    setDefinitions((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, code: e.target.value } : item
                      )
                    )
                  }
                  placeholder="code"
                />
                <Input
                  value={row.label}
                  onChange={(e) =>
                    setDefinitions((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Etichetta"
                />
                <Select
                  value={row.category}
                  onChange={(e) =>
                    setDefinitions((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, category: e.target.value }
                          : item
                      )
                    )
                  }
                >
                  <option value="base">Base</option>
                  <option value="expiry">Scadenza</option>
                  <option value="optional">Opzionale</option>
                </Select>
                <ToggleBox
                  label="Ore"
                  checked={row.tracks_hours}
                  onChange={(checked) =>
                    setDefinitions((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, tracks_hours: checked } : item
                      )
                    )
                  }
                />
                <ToggleBox
                  label="Scadenza"
                  checked={row.has_expiry}
                  onChange={(checked) =>
                    setDefinitions((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, has_expiry: checked } : item
                      )
                    )
                  }
                />
                <Input
                  type="number"
                  value={row.default_expiry_years || 0}
                  onChange={(e) =>
                    setDefinitions((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, default_expiry_years: Number(e.target.value || 0) }
                          : item
                      )
                    )
                  }
                  placeholder="Anni"
                />
                <button
                  onClick={() =>
                    setDefinitions((prev) =>
                      prev.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  className="rounded-xl bg-red-100 text-red-200 hover:bg-red-200"
                >
                  <Trash2 size={16} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() =>
                setDefinitions((prev) => [
                  ...prev,
                  {
                    id: `temp-${Date.now()}`,
                    code: "",
                    label: "",
                    category: "base",
                    is_required: true,
                    tracks_hours: false,
                    has_expiry: false,
                    default_expiry_years: null,
                    order_index: prev.length + 1,
                  },
                ])
              }
              className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi definizione
            </button>
          </div>
        </SectionCard>
      ) : null}

      {section === "checklists" ? (
        <SectionCard
          title="Check-up configurabile"
          subtitle="Definisci gruppi e voci del controllo tecnico."
        >
          {checklists.length === 0 ? <EmptyState title="Nessun gruppo di checklist" /> : null}
          <div className="space-y-4">
            {checklists.map((group, groupIndex) => (
              <div
                key={group.id}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
              >
                <div className="mb-3 flex items-center gap-3">
                  <Input
                    value={group.name}
                    onChange={(e) =>
                      setChecklists((prev) =>
                        prev.map((g, i) => (i === groupIndex ? { ...g, name: e.target.value } : g))
                      )
                    }
                    placeholder="Nome gruppo"
                  />
                  <button
                    onClick={() =>
                      setChecklists((prev) => prev.filter((_, i) => i !== groupIndex))
                    }
                    className="rounded-xl bg-red-100 px-3 py-3 text-red-200"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {group.items.map((item, itemIndex) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_160px_110px_40px]"
                    >
                      <Input
                        value={item.label}
                        onChange={(e) =>
                          setChecklists((prev) =>
                            prev.map((g, i) =>
                              i === groupIndex
                                ? {
                                    ...g,
                                    items: g.items.map((it, j) =>
                                      j === itemIndex ? { ...it, label: e.target.value } : it
                                    ),
                                  }
                                : g
                            )
                          )
                        }
                        placeholder="Voce checklist"
                      />
                      <Select
                        value={item.input_type}
                        onChange={(e) =>
                          setChecklists((prev) =>
                            prev.map((g, i) =>
                              i === groupIndex
                                ? {
                                    ...g,
                                    items: g.items.map((it, j) =>
                                      j === itemIndex
                                        ? { ...it, input_type: e.target.value }
                                        : it
                                    ),
                                  }
                                : g
                            )
                          )
                        }
                      >
                        <option value="status">Status</option>
                        <option value="text">Testo</option>
                        <option value="number">Numero</option>
                      </Select>
                      <ToggleBox
                        label="Obbl."
                        checked={item.is_required}
                        onChange={(checked) =>
                          setChecklists((prev) =>
                            prev.map((g, i) =>
                              i === groupIndex
                                ? {
                                    ...g,
                                    items: g.items.map((it, j) =>
                                      j === itemIndex ? { ...it, is_required: checked } : it
                                    ),
                                  }
                                : g
                            )
                          )
                        }
                      />
                      <button
                        onClick={() =>
                          setChecklists((prev) =>
                            prev.map((g, i) =>
                              i === groupIndex
                                ? {
                                    ...g,
                                    items: g.items.filter((_, j) => j !== itemIndex),
                                  }
                                : g
                            )
                          )
                        }
                        className="rounded-xl bg-red-100 text-red-200 hover:bg-red-200"
                      >
                        <Trash2 size={16} className="mx-auto" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <button
                    onClick={() =>
                      setChecklists((prev) =>
                        prev.map((g, i) =>
                          i === groupIndex
                            ? {
                                ...g,
                                items: [
                                  ...g.items,
                                  {
                                    id: `temp-${Date.now()}`,
                                    label: "",
                                    input_type: "status",
                                    is_required: true,
                                    order_index: g.items.length + 1,
                                  },
                                ],
                              }
                            : g
                        )
                      )
                    }
                    className="rounded-xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-2 font-semibold text-[var(--text-secondary)] hover:bg-white/[0.045]"
                  >
                    Aggiungi voce
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() =>
                setChecklists((prev) => [
                  ...prev,
                  { id: `temp-${Date.now()}`, name: "", order_index: prev.length + 1, items: [] },
                ])
              }
              className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi gruppo
            </button>
          </div>
        </SectionCard>
      ) : null}

      {section === "setup" ? (
        <SectionCard
          title="Setup dinamico"
          subtitle="Configura campi, gruppi e posizioni della scheda setup."
        >
          {setupFields.length === 0 ? (
            <EmptyState title="Nessun campo setup configurato" />
          ) : null}
          <div className="space-y-3">
            {setupFields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 lg:grid-cols-[1fr_1.2fr_180px_140px_120px_120px_40px]"
              >
                <Input
                  value={field.field_key}
                  onChange={(e) =>
                    setSetupFields((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, field_key: e.target.value } : item
                      )
                    )
                  }
                  placeholder="chiave"
                />
                <Input
                  value={field.label}
                  onChange={(e) =>
                    setSetupFields((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Etichetta"
                />
                <Input
                  value={field.group_name}
                  onChange={(e) =>
                    setSetupFields((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, group_name: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Gruppo"
                />
                <Select
                  value={field.field_type}
                  onChange={(e) =>
                    setSetupFields((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, field_type: e.target.value } : item
                      )
                    )
                  }
                >
                  <option value="text">Testo</option>
                  <option value="number">Numero</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Select</option>
                </Select>
                <Input
                  value={field.unit || ""}
                  onChange={(e) =>
                    setSetupFields((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, unit: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Unità"
                />
                <Select
                  value={field.position}
                  onChange={(e) =>
                    setSetupFields((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, position: e.target.value } : item
                      )
                    )
                  }
                >
                  <option value="left">Sinistra</option>
                  <option value="center">Centro</option>
                  <option value="right">Destra</option>
                </Select>
                <button
                  onClick={() =>
                    setSetupFields((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="rounded-xl bg-red-100 text-red-200 hover:bg-red-200"
                >
                  <Trash2 size={16} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() =>
                setSetupFields((prev) => [
                  ...prev,
                  {
                    id: `temp-${Date.now()}`,
                    field_key: "",
                    label: "",
                    group_name: "Generale",
                    field_type: "text",
                    unit: null,
                    position: "left",
                    order_index: prev.length + 1,
                    is_required: false,
                  },
                ])
              }
              className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi campo setup
            </button>
          </div>
        </SectionCard>
      ) : null}

      {section === "dashboard" ? (
        <SectionCard
          title="Dashboard configurabile"
          subtitle="Scegli widget, ordine e visibilità."
        >
          {widgets.length === 0 ? <EmptyState title="Nessun widget configurato" /> : null}
          <div className="space-y-3">
            {widgets.map((widget, index) => (
              <div
                key={widget.id}
                className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 lg:grid-cols-[1fr_1.2fr_120px_120px_110px_40px]"
              >
                <Input
                  value={widget.widget_code}
                  onChange={(e) =>
                    setWidgets((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, widget_code: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Codice widget"
                />
                <Input
                  value={widget.label}
                  onChange={(e) =>
                    setWidgets((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Etichetta"
                />
                <Select
                  value={widget.role_scope}
                  onChange={(e) =>
                    setWidgets((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, role_scope: e.target.value } : item
                      )
                    )
                  }
                >
                  <option value="all">Tutti</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="engineer">Engineer</option>
                  <option value="mechanic">Mechanic</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Select
                  value={widget.size}
                  onChange={(e) =>
                    setWidgets((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, size: e.target.value } : item
                      )
                    )
                  }
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </Select>
                <ToggleBox
                  label="Attivo"
                  checked={widget.is_enabled}
                  onChange={(checked) =>
                    setWidgets((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, is_enabled: checked } : item
                      )
                    )
                  }
                />
                <button
                  onClick={() =>
                    setWidgets((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="rounded-xl bg-red-100 text-red-200 hover:bg-red-200"
                >
                  <Trash2 size={16} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() =>
                setWidgets((prev) => [
                  ...prev,
                  {
                    id: `temp-${Date.now()}`,
                    role_scope: "all",
                    widget_code: "",
                    label: "",
                    is_enabled: true,
                    size: "md",
                    order_index: prev.length + 1,
                  },
                ])
              }
              className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi widget
            </button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
