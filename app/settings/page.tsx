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
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { uploadTeamFile } from "@/lib/storage";
import { buildBrandingTheme, dispatchBrandingRefresh } from "@/lib/brandingTheme";
import {
  DASHBOARD_WIDGET_REGISTRY,
  DEFAULT_CONTROL_CENTER_LABELS,
  MODULE_REGISTRY,
  getDashboardWidgetLabel,
  getModuleLabel,
  normalizeControlCenterModules,
  normalizeControlCenterLabels,
} from "@/lib/controlCenter";
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
  theme_tokens?: Record<string, string> | null;
  updated_at?: string | null;
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
  options?: string[] | string | null;
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
  options?: string[] | string | null;
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

type SettingsHealthSnapshot = {
  can_manage?: boolean;
  save_rpc_available?: boolean;
  settings_count?: number;
  settings_updated_at?: string | null;
  counts?: Record<string, number>;
  manager_write_policies?: Record<string, number>;
  checked_at?: string;
};

type SaveVerification = {
  checkedAt: string;
  ok: boolean;
  message: string;
};


const DEFAULT_MODULES = normalizeControlCenterModules(null);

const DEFAULT_LABELS = DEFAULT_CONTROL_CENTER_LABELS;

const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  showLogoInHeader: true,
  showLogoInSidebar: true,
  showLogoInPrint: true,
  showPlatformNameInHeader: true,
  showPlatformNameInSidebar: true,
  compactHeader: false,
  printLetterheadMode: "logo_title_subtitle",
};

const DASHBOARD_WIDGET_OPTIONS = DASHBOARD_WIDGET_REGISTRY;

function normalizeSetupOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function optionsToText(value?: string[] | string | null) {
  if (typeof value === "string") return value;
  return normalizeSetupOptions(value).join("\n");
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}


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
    ["audit", "Stato salvataggio"],
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
              : "border border-white/10 bg-white/[0.06] text-[var(--text-secondary)] hover:border-[var(--brand-accent)]/40 hover:bg-white/[0.1] hover:text-[var(--text-primary)]"
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

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
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
    <div className="rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm leading-6 text-[var(--brand-accent)]">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non disponibile";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
        ok
          ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-200"
          : "border-red-400/30 bg-red-500/12 text-red-200"
      }`}
    >
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {label}
    </span>
  );
}

function AuditMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-[var(--text-primary)]">{value}</div>
      {helper ? <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{helper}</div> : null}
    </div>
  );
}

function arraysHaveSameContent(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"sidebar" | "header" | "print" | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [section, setSection] = useState("branding");
  const [health, setHealth] = useState<SettingsHealthSnapshot | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastSaveVerification, setLastSaveVerification] = useState<SaveVerification | null>(null);

  async function loadHealth(teamId?: string) {
    try {
      const ctx = teamId ? null : await getCurrentTeamContext();
      const currentTeamId = teamId || ctx?.teamId;
      if (!currentTeamId) return;

      const { data, error } = await supabase.rpc("get_settings_control_center_health", {
        p_team_id: currentTeamId,
      });

      if (error) {
        setHealth(null);
        setHealthError(error.message);
        return;
      }

      setHealth((data || null) as SettingsHealthSnapshot | null);
      setHealthError(null);
    } catch (error) {
      setHealth(null);
      setHealthError(
        error instanceof Error
          ? error.message
          : "Impossibile verificare lo stato del Control Center."
      );
    }
  }

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    setHealthError(null);
    setFeedback(null);
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

      if (settingsRes.error && settingsRes.error.code !== "PGRST116") {
        throw new Error(`Impossibile caricare le impostazioni generali: ${settingsRes.error.message}`);
      }

      const criticalErrors = [defsRes.error, groupsRes.error, itemsRes.error, setupRes.error, widgetsRes.error].filter(Boolean);
      if (criticalErrors.length > 0) {
        throw new Error(
          criticalErrors
            .map((error: any) => error?.message || "Errore caricamento configurazione")
            .join(" · ")
        );
      }

      const rawSettings = (settingsRes.data as AppSettingsRow | null) ?? buildDefaultSettings(ctx.teamId, ctx.name || "Team");

      const normalizedSettings: AppSettingsRow = {
        ...rawSettings,
        dashboard_layout: rawSettings.dashboard_layout || {},
        modules: normalizeControlCenterModules(rawSettings),
        labels: normalizeControlCenterLabels(rawSettings.labels as any),
        branding: buildBrandingFromSettings(rawSettings),
      };

      setSettings(normalizedSettings);
      setDefinitions((defsRes.data || []) as ComponentDefinition[]);
      setSetupFields(
        ((setupRes.data || []) as SetupField[]).map((field) => ({
          ...field,
          options: normalizeSetupOptions((field as any).options),
        }))
      );
      setWidgets((widgetsRes.data || []) as DashboardWidget[]);

      const groups = (groupsRes.data || []) as any[];
      const items = (itemsRes.data || []) as any[];
      setChecklists(
        groups.map((group) => ({
          ...group,
          items: items.filter((item) => item.checklist_id === group.id).map((item) => ({ ...item, options: normalizeSetupOptions((item as any).options) })),
        }))
      );

      await loadHealth(ctx.teamId);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Errore caricamento impostazioni.";
      setLoadError(message);
      setFeedback({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && access.canManageSettings) {
      void loadAll();
    }
  }, [access.loading, access.canManageSettings]);

  const effectiveBrandingTheme = useMemo(
    () => (settings ? buildBrandingTheme(settings) : null),
    [settings]
  );

  const themeCompatibilityWarnings = useMemo(() => {
    if (!settings || !effectiveBrandingTheme) return [] as string[];
    const warnings: string[] = [];
    const requestedPrimary = normalizeHex(settings.primary_color, "#171717");
    const requestedSecondary = normalizeHex(settings.secondary_color, "#262626");
    if (requestedPrimary !== effectiveBrandingTheme.colors.primary) {
      warnings.push("Primary color non valido: verrà usato il fallback sicuro.");
    }
    if (requestedSecondary !== effectiveBrandingTheme.colors.secondary) {
      warnings.push("Secondary color non valido: verrà usato il fallback sicuro.");
    }
    return warnings;
  }, [effectiveBrandingTheme, settings]);

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

  if (!file.type.startsWith("image/")) {
    setUploadingAsset(null);
    setFeedback({ type: "error", message: "Formato non valido: carica un'immagine PNG, JPG, SVG o WebP." });
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    setUploadingAsset(null);
    setFeedback({ type: "error", message: "Logo troppo pesante: usa un file sotto i 2 MB." });
    return;
  }

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
    if (!settings || loadError) return;
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

      const cleanDefinitions = definitions
        .filter((row) => row.code.trim() && row.label.trim())
        .map((row, index) => ({
          code: row.code.trim(),
          label: row.label.trim(),
          category: row.category,
          is_required: row.is_required,
          tracks_hours: row.tracks_hours,
          has_expiry: row.has_expiry,
          default_expiry_years: row.has_expiry ? row.default_expiry_years || 1 : null,
          order_index: index + 1,
        }));

      const cleanChecklists = checklists
        .filter((group) => group.name.trim())
        .map((group, index) => ({
          name: group.name.trim(),
          order_index: index + 1,
          items: group.items
            .filter((item) => item.label.trim())
            .map((item, itemIndex) => ({
              label: item.label.trim(),
              input_type: item.input_type || "status",
              options: item.input_type === "select" ? normalizeSetupOptions(item.options) : [],
              is_required: item.is_required,
              order_index: itemIndex + 1,
            })),
        }));

      const cleanSetupFields = setupFields
        .filter((field) => field.field_key.trim() && field.label.trim())
        .map((field, index) => ({
          field_key: field.field_key.trim(),
          label: field.label.trim(),
          group_name: field.group_name || "Generale",
          field_type: field.field_type || "text",
          unit: field.unit || null,
          options: field.field_type === "select" ? normalizeSetupOptions(field.options) : [],
          position: field.position || "left",
          order_index: index + 1,
          is_required: field.is_required,
        }));

      const cleanWidgets = widgets
        .filter((widget) => widget.widget_code.trim())
        .map((widget, index) => ({
          role_scope: widget.role_scope || "all",
          widget_code: widget.widget_code.trim(),
          label: widget.label.trim() || getDashboardWidgetLabel(widget.widget_code),
          is_enabled: widget.is_enabled,
          size: widget.size || "md",
          order_index: index + 1,
          config: {},
        }));

      const { error } = await supabase.rpc("save_team_settings_bundle", {
        p_team_id: ctx.teamId,
        p_settings: {
          id: settings.id || null,
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
        },
        p_component_definitions: cleanDefinitions,
        p_checklists: cleanChecklists,
        p_setup_fields: cleanSetupFields,
        p_dashboard_widgets: cleanWidgets,
      });

      if (error) throw error;

      const [verifySettingsRes, verifyDefinitionsRes, verifyChecklistsRes, verifySetupRes, verifyWidgetsRes] =
        await Promise.all([
          supabase
            .from("app_settings")
            .select("team_name, primary_color, secondary_color, accent_color, updated_at")
            .eq("team_id", ctx.teamId)
            .maybeSingle(),
          supabase
            .from("team_component_definitions")
            .select("id", { count: "exact", head: true })
            .eq("team_id", ctx.teamId),
          supabase
            .from("team_checklists")
            .select("id", { count: "exact", head: true })
            .eq("team_id", ctx.teamId),
          supabase
            .from("team_setup_fields")
            .select("id", { count: "exact", head: true })
            .eq("team_id", ctx.teamId),
          supabase
            .from("team_dashboard_widgets")
            .select("id", { count: "exact", head: true })
            .eq("team_id", ctx.teamId),
        ]);

      const verificationIssues: string[] = [];
      if (verifySettingsRes.error) verificationIssues.push(`Impostazioni generali: ${verifySettingsRes.error.message}`);
      if (verifyDefinitionsRes.error) verificationIssues.push(`Componenti standard: ${verifyDefinitionsRes.error.message}`);
      if (verifyChecklistsRes.error) verificationIssues.push(`Checklist: ${verifyChecklistsRes.error.message}`);
      if (verifySetupRes.error) verificationIssues.push(`Setup: ${verifySetupRes.error.message}`);
      if (verifyWidgetsRes.error) verificationIssues.push(`Dashboard: ${verifyWidgetsRes.error.message}`);

      const verifySettings = verifySettingsRes.data as any;
      if (verifySettings && verifySettings.team_name !== settings.team_name) {
        verificationIssues.push("Nome team salvato diverso dal valore richiesto.");
      }

      const countChecks = [
        { label: "componenti standard", expected: cleanDefinitions.length, actual: verifyDefinitionsRes.count ?? 0 },
        { label: "checklist", expected: cleanChecklists.length, actual: verifyChecklistsRes.count ?? 0 },
        { label: "campi setup", expected: cleanSetupFields.length, actual: verifySetupRes.count ?? 0 },
        { label: "widget dashboard", expected: cleanWidgets.length, actual: verifyWidgetsRes.count ?? 0 },
      ];

      for (const check of countChecks) {
        if (check.expected !== check.actual) {
          verificationIssues.push(
            `Conteggio ${check.label} non allineato: attesi ${check.expected}, salvati ${check.actual}.`
          );
        }
      }

      const verificationOk = verificationIssues.length === 0;
      setLastSaveVerification({
        checkedAt: new Date().toISOString(),
        ok: verificationOk,
        message: verificationOk
          ? "Rilettura database completata: le sezioni principali risultano allineate."
          : verificationIssues.join(" · "),
      });

      dispatchBrandingRefresh();

      setFeedback({
        type: verificationOk ? "success" : "error",
        message: verificationOk
          ? "Control Center aggiornato e verificato sul database."
          : `Salvataggio completato, ma la verifica ha rilevato anomalie: ${verificationIssues.join(" · ")}`,
      });
      await loadAll();
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: "Errore salvataggio impostazioni. Verifica di aver eseguito db/settings_hardening_patch.sql e db/settings_control_center_audit_patch.sql.",
      });
    } finally {
      setSaving(false);
    }
  }

  const previewBranding = settings ? settings.branding || buildBrandingFromSettings(settings) : null;

  if (!loading && loadError) {
    return (
      <PagePermissionState
        title="Control Center"
        subtitle="Configurazione avanzata del team"
        icon={<Settings size={20} />}
        state="error"
        message={loadError}
      />
    );
  }

  if (loading || !settings || !previewBranding) {
    return (
      <div className={`flex flex-col gap-6 p-6`}>
        <div className="rounded-3xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-6 py-5 text-sm text-[var(--text-muted)] shadow-sm">
          Caricamento impostazioni...
        </div>
      </div>
    );
  }

  const loadedSectionCounts = {
    componenti: definitions.length,
    checklist: checklists.length,
    setup: setupFields.length,
    dashboard: widgets.length,
  };

  const databaseCounts = health?.counts || {};
  const saveRpcReady = health?.save_rpc_available === true;
  const managerCanWrite = health?.can_manage === true;

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title="Control Center"
        subtitle="Branding, moduli, template mezzo, checklist, setup e dashboard del team"
        icon={<Settings size={22} />}
        actions={
          <button
            onClick={saveAll}
            disabled={saving || !!loadError}
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
        title="Stato Control Center"
        subtitle="Controlla se le impostazioni sono caricate, salvabili e realmente allineate al database."
        actions={
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)] hover:bg-white/[0.12]"
          >
            <RefreshCw size={14} className="mr-2 inline" />
            Ricontrolla
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AuditMetric
            label="RPC salvataggio"
            value={<StatusPill ok={saveRpcReady} label={saveRpcReady ? "OK" : "Da verificare"} />}
            helper="Verifica che la funzione transazionale sia disponibile sul database."
          />
          <AuditMetric
            label="Permesso scrittura"
            value={<StatusPill ok={managerCanWrite} label={managerCanWrite ? "Owner/Admin" : "Non abilitato"} />}
            helper="Solo owner/admin devono poter modificare il Control Center."
          />
          <AuditMetric
            label="Ultimo salvataggio DB"
            value={<span className="text-base font-black">{formatDateTime(health?.settings_updated_at || settings.updated_at)}</span>}
            helper="Timestamp letto dal database, non dalla sola preview locale."
          />
          <AuditMetric
            label="Ultima verifica"
            value={<span className="text-base font-black">{formatDateTime(health?.checked_at || lastSaveVerification?.checkedAt)}</span>}
            helper={lastSaveVerification?.message || "Esegui un salvataggio o ricontrolla lo stato."}
          />
        </div>

        {healthError ? (
          <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-bold">Diagnostica database non disponibile</div>
                <div className="mt-1 text-red-100/80">
                  {healthError}. Se hai appena caricato questa patch, esegui la query <strong>db/settings_control_center_audit_patch.sql</strong>.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {themeCompatibilityWarnings.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm leading-6 text-[var(--brand-accent)]">
            <div className="flex items-start gap-3">
              <Eye size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-bold">Differenza tra preview locale e tema realmente applicato</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {themeCompatibilityWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
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

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
            <Eye size={16} />
            Tema effettivo applicato
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { label: "Primary", requested: normalizeHex(settings.primary_color, "#171717"), applied: effectiveBrandingTheme?.colors.primary || "#171717" },
              { label: "Secondary", requested: normalizeHex(settings.secondary_color, "#262626"), applied: effectiveBrandingTheme?.colors.secondary || "#262626" },
              { label: "Accent", requested: normalizeHex(settings.accent_color, "#facc15"), applied: effectiveBrandingTheme?.colors.accent || "#facc15" },
            ].map((color) => (
              <div key={color.label} className="rounded-xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-3 text-xs text-[var(--text-secondary)]">
                <div className="font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{color.label}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-7 w-7 rounded-lg border border-white/10" style={{ backgroundColor: color.requested }} />
                  <span>richiesto {color.requested}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-7 w-7 rounded-lg border border-white/10" style={{ backgroundColor: color.applied }} />
                  <span>applicato {color.applied}</span>
                </div>
              </div>
            ))}
          </div>
          {themeCompatibilityWarnings.length > 0 ? (
            <div className="mt-4 rounded-xl border border-yellow-400/25 bg-yellow-500/10 px-3 py-2 text-sm leading-6 text-[var(--brand-accent)]">
              Alcuni colori richiesti non sono applicati perché romperebbero il contrasto del tema scuro. La preview locale mostra il valore scelto, mentre il tema reale usa il valore applicato qui sopra.
            </div>
          ) : null}
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
      primaryColor={effectiveBrandingTheme?.colors.primary || normalizeHex(settings.primary_color, "#171717")}
      secondaryColor={effectiveBrandingTheme?.colors.secondary || normalizeHex(settings.secondary_color, "#262626")}
      accentColor={effectiveBrandingTheme?.colors.accent || normalizeHex(settings.accent_color, "#facc15")}
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
              {MODULE_REGISTRY.filter((module) => module.visibleInControlCenter).map((module) => {
                const enabled = normalizeControlCenterModules(settings)[module.id];
                const dependenciesDisabled = module.dependsOn?.filter((dep) => !normalizeControlCenterModules(settings)[dep]) || [];
                return (
                  <label
                    key={module.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3"
                  >
                    <span>
                      <span className="block font-semibold text-[var(--text-primary)]">
                        {getModuleLabel(module.id, settings.labels)}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                        {module.description}
                        {dependenciesDisabled.length > 0 ? ` Dipende da: ${dependenciesDisabled.map((dep) => getModuleLabel(dep, settings.labels)).join(", ")}.` : ""}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!enabled}
                      disabled={dependenciesDisabled.length > 0}
                      onChange={(e) =>
                        patchSetting("modules", {
                          ...normalizeControlCenterModules(settings),
                          [module.id]: e.target.checked,
                        })
                      }
                    />
                  </label>
                );
              })}
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
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-red-200 transition hover:border-red-300/50 hover:bg-red-500/20 hover:text-red-100"
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
              className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-2 font-semibold text-[var(--text-primary)] hover:bg-white/[0.12]"
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
                    className="flex min-h-[44px] items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-red-200 transition hover:border-red-300/50 hover:bg-red-500/20 hover:text-red-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {group.items.map((item, itemIndex) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_170px_110px_40px]"
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
                        <option value="select">Select</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="date">Data</option>
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
                        className="flex min-h-[44px] items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-red-200 transition hover:border-red-300/50 hover:bg-red-500/20 hover:text-red-100"
                      >
                        <Trash2 size={16} className="mx-auto" />
                      </button>
                      {item.input_type === "select" ? (
                        <div className="md:col-span-4">
                          <Label>Opzioni select</Label>
                          <Textarea
                            rows={3}
                            value={optionsToText(item.options)}
                            onChange={(e) =>
                              setChecklists((prev) =>
                                prev.map((g, i) =>
                                  i === groupIndex
                                    ? {
                                        ...g,
                                        items: g.items.map((it, j) =>
                                          j === itemIndex ? { ...it, options: e.target.value } : it
                                        ),
                                      }
                                    : g
                                )
                              )
                            }
                            placeholder={"Una opzione per riga\nOK\nDa verificare\nSostituire"}
                          />
                        </div>
                      ) : null}
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
                                    options: [],
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
              className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-2 font-semibold text-[var(--text-primary)] hover:bg-white/[0.12]"
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
                {field.field_type === "select" ? (
                  <div className="lg:col-span-6">
                    <Label>Opzioni select</Label>
                    <Textarea
                      rows={3}
                      value={optionsToText(field.options)}
                      onChange={(e) =>
                        setSetupFields((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, options: e.target.value } : item
                          )
                        )
                      }
                      placeholder={"Una opzione per riga\nSlick\nRain\nUsed"}
                    />
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      Le opzioni saranno disponibili nei campi setup di tipo select. Puoi scriverle una per riga oppure separate da virgola.
                    </div>
                  </div>
                ) : null}
                <button
                  onClick={() =>
                    setSetupFields((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-red-200 transition hover:border-red-300/50 hover:bg-red-500/20 hover:text-red-100"
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
                    options: [],
                    position: "left",
                    order_index: prev.length + 1,
                    is_required: false,
                  },
                ])
              }
              className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-2 font-semibold text-[var(--text-primary)] hover:bg-white/[0.12]"
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
                className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 lg:grid-cols-[92px_1fr_1.2fr_120px_120px_110px_40px]"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-xs font-black text-[var(--text-secondary)]">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setWidgets((prev) => moveArrayItem(prev, index, index - 1))}
                      disabled={index === 0}
                      className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Sposta widget su"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setWidgets((prev) => moveArrayItem(prev, index, index + 1))}
                      disabled={index === widgets.length - 1}
                      className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-[var(--text-secondary)] hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Sposta widget giù"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
                <Select
                  value={widget.widget_code}
                  onChange={(e) => {
                    const nextCode = e.target.value;
                    setWidgets((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? { ...item, widget_code: nextCode, label: item.label || getDashboardWidgetLabel(nextCode) }
                          : item
                      )
                    );
                  }}
                >
                  <option value="">Seleziona widget</option>
                  {DASHBOARD_WIDGET_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </Select>
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
                  <option value="sm">Compatto</option>
                  <option value="md">Standard</option>
                  <option value="lg">Ampio</option>
                  <option value="xl">Riga intera</option>
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
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-red-200 transition hover:border-red-300/50 hover:bg-red-500/20 hover:text-red-100"
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
                    widget_code: "cars_ready",
                    label: getDashboardWidgetLabel("cars_ready"),
                    is_enabled: true,
                    size: "md",
                    order_index: prev.length + 1,
                  },
                ])
              }
              className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-2 font-semibold text-[var(--text-primary)] hover:bg-white/[0.12]"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi widget
            </button>
          </div>
        </SectionCard>
      ) : null}

      {section === "audit" ? (
        <div className="space-y-6">
          <SectionCard
            title="Diagnostica salvataggio"
            subtitle="Serve a capire se una modifica è solo in preview, salvata sul database o applicata realmente al tema globale."
            actions={
              <button
                type="button"
                onClick={() => void loadAll()}
                className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)] hover:bg-white/[0.12]"
              >
                <RefreshCw size={14} className="mr-2 inline" />
                Ricarica tutto
              </button>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <AuditMetric label="Impostazioni" value={health?.settings_count ?? "—"} helper="Record app_settings per il team." />
              <AuditMetric label="Componenti" value={databaseCounts.component_definitions ?? loadedSectionCounts.componenti} helper={`Caricati in UI: ${loadedSectionCounts.componenti}`} />
              <AuditMetric label="Checklist" value={databaseCounts.checklists ?? loadedSectionCounts.checklist} helper={`Caricate in UI: ${loadedSectionCounts.checklist}`} />
              <AuditMetric label="Setup" value={databaseCounts.setup_fields ?? loadedSectionCounts.setup} helper={`Caricati in UI: ${loadedSectionCounts.setup}`} />
              <AuditMetric label="Widget" value={databaseCounts.dashboard_widgets ?? loadedSectionCounts.dashboard} helper={`Caricati in UI: ${loadedSectionCounts.dashboard}`} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                  <Database size={16} />
                  Stato database
                </div>
                <div className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.045] px-3 py-2">
                    <span>RPC transazionale</span>
                    <StatusPill ok={saveRpcReady} label={saveRpcReady ? "Disponibile" : "Mancante"} />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.045] px-3 py-2">
                    <span>Scrittura owner/admin</span>
                    <StatusPill ok={managerCanWrite} label={managerCanWrite ? "OK" : "Bloccata"} />
                  </div>
                  <div className="rounded-xl bg-white/[0.045] px-3 py-2">
                    <div className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Ultimo updated_at</div>
                    <div className="mt-1 font-semibold text-[var(--text-primary)]">{formatDateTime(health?.settings_updated_at || settings.updated_at)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                  <Eye size={16} />
                  Tema richiesto vs tema applicato
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Primary", requested: normalizeHex(settings.primary_color, "#171717"), applied: effectiveBrandingTheme?.colors.primary || "#171717" },
                    { label: "Secondary", requested: normalizeHex(settings.secondary_color, "#262626"), applied: effectiveBrandingTheme?.colors.secondary || "#262626" },
                    { label: "Accent", requested: normalizeHex(settings.accent_color, "#facc15"), applied: effectiveBrandingTheme?.colors.accent || "#facc15" },
                  ].map((color) => (
                    <div key={color.label} className="rounded-xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{color.label}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                        <div>
                          <div className="mb-1">Richiesto</div>
                          <div className="h-8 rounded-lg border border-white/10" style={{ backgroundColor: color.requested }} />
                          <div className="mt-1 font-mono">{color.requested}</div>
                        </div>
                        <div>
                          <div className="mb-1">Applicato</div>
                          <div className="h-8 rounded-lg border border-white/10" style={{ backgroundColor: color.applied }} />
                          <div className="mt-1 font-mono">{color.applied}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {themeCompatibilityWarnings.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                    I colori richiesti sono compatibili con il tema reale.
                  </div>
                ) : null}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
