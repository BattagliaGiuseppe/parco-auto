"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import {
  Settings,
  Save,
  Palette,
  Bell,
  Shield,
  Globe,
  SlidersHorizontal,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type AppSettingsRow = {
  id: string;
  team_id: string;
  team_name: string;
  team_subtitle: string | null;
  team_logo_url: string | null;
  dashboard_cover_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  language: string;
  date_format: string;
  theme_mode: string;
  density_mode: string;
  time_format: string;
  default_warning_hours: number;
  default_revision_hours: number;
  default_expiry_alert_days: number;
  enable_events: boolean;
  enable_maintenances: boolean;
  enable_fuel: boolean;
  enable_setup: boolean;
  enable_notes: boolean;
  email_notifications: boolean;
  calendar_sync: boolean;
  critical_alerts: boolean;
  weekly_summary: boolean;
  created_at?: string;
  updated_at?: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

const DEFAULT_SETTINGS: Omit<AppSettingsRow, "id" | "team_id"> = {
  team_name: "Battaglia Racing",
  team_subtitle: "",
  team_logo_url: "",
  dashboard_cover_url: "",
  primary_color: "#facc15",
  secondary_color: "#111111",
  accent_color: "#eab308",
  language: "it",
  date_format: "it",
  theme_mode: "automatico",
  density_mode: "standard",
  time_format: "ore_minuti",
  default_warning_hours: 20,
  default_revision_hours: 30,
  default_expiry_alert_days: 30,
  enable_events: true,
  enable_maintenances: true,
  enable_fuel: true,
  enable_setup: true,
  enable_notes: true,
  email_notifications: true,
  calendar_sync: false,
  critical_alerts: true,
  weekly_summary: false,
};

export default function SettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const [teamName, setTeamName] = useState(DEFAULT_SETTINGS.team_name);
  const [teamSubtitle, setTeamSubtitle] = useState(DEFAULT_SETTINGS.team_subtitle || "");
  const [teamLogoUrl, setTeamLogoUrl] = useState(DEFAULT_SETTINGS.team_logo_url || "");
  const [dashboardCoverUrl, setDashboardCoverUrl] = useState(
    DEFAULT_SETTINGS.dashboard_cover_url || ""
  );

  const [primaryColor, setPrimaryColor] = useState(DEFAULT_SETTINGS.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SETTINGS.secondary_color);
  const [accentColor, setAccentColor] = useState(DEFAULT_SETTINGS.accent_color);

  const [language, setLanguage] = useState(DEFAULT_SETTINGS.language);
  const [dateFormat, setDateFormat] = useState(DEFAULT_SETTINGS.date_format);
  const [themeMode, setThemeMode] = useState(DEFAULT_SETTINGS.theme_mode);
  const [densityMode, setDensityMode] = useState(DEFAULT_SETTINGS.density_mode);
  const [timeFormat, setTimeFormat] = useState(DEFAULT_SETTINGS.time_format);

  const [defaultWarningHours, setDefaultWarningHours] = useState(
    DEFAULT_SETTINGS.default_warning_hours
  );
  const [defaultRevisionHours, setDefaultRevisionHours] = useState(
    DEFAULT_SETTINGS.default_revision_hours
  );
  const [defaultExpiryAlertDays, setDefaultExpiryAlertDays] = useState(
    DEFAULT_SETTINGS.default_expiry_alert_days
  );

  const [enableEvents, setEnableEvents] = useState(DEFAULT_SETTINGS.enable_events);
  const [enableMaintenances, setEnableMaintenances] = useState(
    DEFAULT_SETTINGS.enable_maintenances
  );
  const [enableFuel, setEnableFuel] = useState(DEFAULT_SETTINGS.enable_fuel);
  const [enableSetup, setEnableSetup] = useState(DEFAULT_SETTINGS.enable_setup);
  const [enableNotes, setEnableNotes] = useState(DEFAULT_SETTINGS.enable_notes);

  const [emailNotifications, setEmailNotifications] = useState(
    DEFAULT_SETTINGS.email_notifications
  );
  const [calendarSync, setCalendarSync] = useState(DEFAULT_SETTINGS.calendar_sync);
  const [criticalAlerts, setCriticalAlerts] = useState(DEFAULT_SETTINGS.critical_alerts);
  const [weeklySummary, setWeeklySummary] = useState(DEFAULT_SETTINGS.weekly_summary);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const applySettings = (row: AppSettingsRow) => {
    setSettingsId(row.id);
    setTeamId(row.team_id);

    setTeamName(row.team_name || DEFAULT_SETTINGS.team_name);
    setTeamSubtitle(row.team_subtitle || "");
    setTeamLogoUrl(row.team_logo_url || "");
    setDashboardCoverUrl(row.dashboard_cover_url || "");

    setPrimaryColor(row.primary_color || DEFAULT_SETTINGS.primary_color);
    setSecondaryColor(row.secondary_color || DEFAULT_SETTINGS.secondary_color);
    setAccentColor(row.accent_color || DEFAULT_SETTINGS.accent_color);

    setLanguage(row.language || DEFAULT_SETTINGS.language);
    setDateFormat(row.date_format || DEFAULT_SETTINGS.date_format);
    setThemeMode(row.theme_mode || DEFAULT_SETTINGS.theme_mode);
    setDensityMode(row.density_mode || DEFAULT_SETTINGS.density_mode);
    setTimeFormat(row.time_format || DEFAULT_SETTINGS.time_format);

    setDefaultWarningHours(row.default_warning_hours ?? DEFAULT_SETTINGS.default_warning_hours);
    setDefaultRevisionHours(row.default_revision_hours ?? DEFAULT_SETTINGS.default_revision_hours);
    setDefaultExpiryAlertDays(
      row.default_expiry_alert_days ?? DEFAULT_SETTINGS.default_expiry_alert_days
    );

    setEnableEvents(row.enable_events ?? DEFAULT_SETTINGS.enable_events);
    setEnableMaintenances(row.enable_maintenances ?? DEFAULT_SETTINGS.enable_maintenances);
    setEnableFuel(row.enable_fuel ?? DEFAULT_SETTINGS.enable_fuel);
    setEnableSetup(row.enable_setup ?? DEFAULT_SETTINGS.enable_setup);
    setEnableNotes(row.enable_notes ?? DEFAULT_SETTINGS.enable_notes);

    setEmailNotifications(row.email_notifications ?? DEFAULT_SETTINGS.email_notifications);
    setCalendarSync(row.calendar_sync ?? DEFAULT_SETTINGS.calendar_sync);
    setCriticalAlerts(row.critical_alerts ?? DEFAULT_SETTINGS.critical_alerts);
    setWeeklySummary(row.weekly_summary ?? DEFAULT_SETTINGS.weekly_summary);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);

      const ctx = await getCurrentTeamContext();
      setTeamId(ctx.teamId);

      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("team_id", ctx.teamId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: inserted, error: insertError } = await supabase
          .from("app_settings")
          .insert([
            {
              team_id: ctx.teamId,
              ...DEFAULT_SETTINGS,
            },
          ])
          .select("*")
          .single();

        if (insertError) throw insertError;

        applySettings(inserted as AppSettingsRow);
      } else {
        applySettings(data as AppSettingsRow);
      }
    } catch (error: any) {
      console.error("Errore caricamento impostazioni:", error);
      showToast(`Errore caricamento impostazioni: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const payload = useMemo(
    () => ({
      team_name: teamName.trim() || DEFAULT_SETTINGS.team_name,
      team_subtitle: teamSubtitle.trim() || null,
      team_logo_url: teamLogoUrl.trim() || null,
      dashboard_cover_url: dashboardCoverUrl.trim() || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      language,
      date_format: dateFormat,
      theme_mode: themeMode,
      density_mode: densityMode,
      time_format: timeFormat,
      default_warning_hours: Number(defaultWarningHours || 0),
      default_revision_hours: Number(defaultRevisionHours || 0),
      default_expiry_alert_days: Number(defaultExpiryAlertDays || 0),
      enable_events: enableEvents,
      enable_maintenances: enableMaintenances,
      enable_fuel: enableFuel,
      enable_setup: enableSetup,
      enable_notes: enableNotes,
      email_notifications: emailNotifications,
      calendar_sync: calendarSync,
      critical_alerts: criticalAlerts,
      weekly_summary: weeklySummary,
      updated_at: new Date().toISOString(),
    }),
    [
      teamName,
      teamSubtitle,
      teamLogoUrl,
      dashboardCoverUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      language,
      dateFormat,
      themeMode,
      densityMode,
      timeFormat,
      defaultWarningHours,
      defaultRevisionHours,
      defaultExpiryAlertDays,
      enableEvents,
      enableMaintenances,
      enableFuel,
      enableSetup,
      enableNotes,
      emailNotifications,
      calendarSync,
      criticalAlerts,
      weeklySummary,
    ]
  );

  const saveSettings = async () => {
    if (!teamId) {
      showToast("Team non trovato", "error");
      return;
    }

    try {
      setSaving(true);

      if (settingsId) {
        const { error } = await supabase
          .from("app_settings")
          .update(payload)
          .eq("id", settingsId)
          .eq("team_id", teamId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("app_settings")
          .insert([
            {
              team_id: teamId,
              ...payload,
            },
          ])
          .select("id")
          .single();

        if (error) throw error;
        setSettingsId(data.id);
      }

      showToast("Impostazioni salvate correttamente");
    } catch (error: any) {
      console.error("Errore salvataggio impostazioni:", error);
      showToast(`Errore salvataggio: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
        <div className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" />
          Caricamento impostazioni...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-lg font-semibold ${
            toast.type === "success" ? "bg-yellow-400 text-black" : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <Settings size={14} />
                Configurazione Team
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Impostazioni
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Personalizza identità del team, aspetto grafico, moduli attivi, soglie operative
                e notifiche della webapp.
              </p>
            </div>

            <button onClick={saveSettings} disabled={saving} className="btn-primary">
              <Save size={18} />
              {saving ? "Salvataggio..." : "Salva impostazioni"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SettingsCard
          icon={<Shield size={18} className="text-yellow-600" />}
          title="Identità team"
          description="Nome, sottotitolo e immagini del team."
        >
          <Field label="Nome team">
            <input
              className="input-base"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Es. Battaglia Racing"
            />
          </Field>

          <Field label="Sottotitolo">
            <input
              className="input-base"
              value={teamSubtitle}
              onChange={(e) => setTeamSubtitle(e.target.value)}
              placeholder="Es. Formula & Motorsport Operations"
            />
          </Field>

          <Field label="URL logo team">
            <input
              className="input-base"
              value={teamLogoUrl}
              onChange={(e) => setTeamLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>

          <Field label="URL immagine dashboard">
            <input
              className="input-base"
              value={dashboardCoverUrl}
              onChange={(e) => setDashboardCoverUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </SettingsCard>

        <SettingsCard
          icon={<Palette size={18} className="text-yellow-600" />}
          title="Aspetto grafico"
          description="Colori principali dell’interfaccia."
        >
          <ColorField label="Colore primario" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField
            label="Colore secondario"
            value={secondaryColor}
            onChange={setSecondaryColor}
          />
          <ColorField label="Colore accent" value={accentColor} onChange={setAccentColor} />

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-semibold text-neutral-700 mb-3">Anteprima palette</div>
            <div className="flex gap-3">
              <ColorPreview label="Primary" color={primaryColor} />
              <ColorPreview label="Secondary" color={secondaryColor} />
              <ColorPreview label="Accent" color={accentColor} />
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={<Globe size={18} className="text-yellow-600" />}
          title="Localizzazione"
          description="Lingua, formato data, tema e densità."
        >
          <Field label="Lingua">
            <select className="input-base" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </Field>

          <Field label="Formato data">
            <select
              className="input-base"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
            >
              <option value="it">Italiano</option>
              <option value="en">Internazionale</option>
            </select>
          </Field>

          <Field label="Tema interfaccia">
            <select
              className="input-base"
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value)}
            >
              <option value="automatico">Automatico</option>
              <option value="chiaro">Chiaro</option>
              <option value="scuro">Scuro</option>
            </select>
          </Field>

          <Field label="Densità interfaccia">
            <select
              className="input-base"
              value={densityMode}
              onChange={(e) => setDensityMode(e.target.value)}
            >
              <option value="standard">Standard</option>
              <option value="compatta">Compatta</option>
              <option value="ampia">Ampia</option>
            </select>
          </Field>

          <Field label="Formato tempo">
            <select
              className="input-base"
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value)}
            >
              <option value="ore_minuti">Ore e minuti</option>
              <option value="decimale">Decimale</option>
            </select>
          </Field>
        </SettingsCard>

        <SettingsCard
          icon={<SlidersHorizontal size={18} className="text-yellow-600" />}
          title="Soglie di default"
          description="Valori base per warning, revisione e scadenze."
        >
          <Field label="Warning ore default">
            <input
              type="number"
              className="input-base"
              value={defaultWarningHours}
              onChange={(e) => setDefaultWarningHours(Number(e.target.value))}
            />
          </Field>

          <Field label="Revisione ore default">
            <input
              type="number"
              className="input-base"
              value={defaultRevisionHours}
              onChange={(e) => setDefaultRevisionHours(Number(e.target.value))}
            />
          </Field>

          <Field label="Alert scadenza (giorni)">
            <input
              type="number"
              className="input-base"
              value={defaultExpiryAlertDays}
              onChange={(e) => setDefaultExpiryAlertDays(Number(e.target.value))}
            />
          </Field>
        </SettingsCard>

        <SettingsCard
          icon={<ImageIcon size={18} className="text-yellow-600" />}
          title="Moduli attivi"
          description="Attiva o disattiva le sezioni principali."
        >
          <ToggleRow label="Eventi" checked={enableEvents} onChange={setEnableEvents} />
          <ToggleRow
            label="Manutenzioni"
            checked={enableMaintenances}
            onChange={setEnableMaintenances}
          />
          <ToggleRow label="Carburante" checked={enableFuel} onChange={setEnableFuel} />
          <ToggleRow label="Setup" checked={enableSetup} onChange={setEnableSetup} />
          <ToggleRow label="Note" checked={enableNotes} onChange={setEnableNotes} />
        </SettingsCard>

        <SettingsCard
          icon={<Bell size={18} className="text-yellow-600" />}
          title="Notifiche e automazioni"
          description="Preferenze di alert e riepiloghi."
        >
          <ToggleRow
            label="Notifiche email"
            checked={emailNotifications}
            onChange={setEmailNotifications}
          />
          <ToggleRow label="Sync calendario" checked={calendarSync} onChange={setCalendarSync} />
          <ToggleRow
            label="Alert critici"
            checked={criticalAlerts}
            onChange={setCriticalAlerts}
          />
          <ToggleRow
            label="Riepilogo settimanale"
            checked={weeklySummary}
            onChange={setWeeklySummary}
          />
        </SettingsCard>
      </section>

      <div className="flex justify-end">
        <button onClick={saveSettings} disabled={saving} className="btn-primary">
          <Save size={18} />
          {saving ? "Salvataggio..." : "Salva impostazioni"}
        </button>
      </div>
    </div>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-base p-5 md:p-6">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h2 className="text-lg font-bold text-neutral-800">{title}</h2>
      </div>
      <p className="text-sm text-neutral-500 mb-5">{description}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-neutral-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="font-medium text-neutral-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-16 rounded-lg border border-neutral-300 bg-white p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-base"
        />
      </div>
    </Field>
  );
}

function ColorPreview({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-12 w-12 rounded-xl border border-neutral-300"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-neutral-600">{label}</span>
    </div>
  );
}