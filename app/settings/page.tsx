"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Settings,
  Save,
  Palette,
  Languages,
  Bell,
  ShieldCheck,
  LayoutDashboard,
  Wrench,
  Calendar,
  CalendarDays,
  Fuel,
  NotebookPen,
  SlidersHorizontal,
  Image as ImageIcon,
  Building2,
  ToggleLeft,
  Loader2,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type DensityMode = "compatta" | "standard" | "ampia";
type ThemeMode = "chiaro" | "scuro" | "automatico";
type TimeFormat = "ore_minuti" | "decimale";
type DateFormat = "it" | "en" | "iso";
type LanguageCode = "it" | "en" | "fr" | "de" | "es";

type AppSettingsRow = {
  id: string;
  team_name: string;
  team_subtitle: string | null;
  team_logo_url: string | null;
  dashboard_cover_url: string | null;

  primary_color: string;
  secondary_color: string;
  accent_color: string;

  language: LanguageCode;
  date_format: DateFormat;
  theme_mode: ThemeMode;
  density_mode: DensityMode;
  time_format: TimeFormat;

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

const DEFAULT_SETTINGS: Omit<AppSettingsRow, "id" | "created_at" | "updated_at"> = {
  team_name: "Battaglia Racing",
  team_subtitle: "Gestione tecnica parco auto da corsa",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missingSettings, setMissingSettings] = useState(false);

  const [teamName, setTeamName] = useState(DEFAULT_SETTINGS.team_name);
  const [teamSubtitle, setTeamSubtitle] = useState(DEFAULT_SETTINGS.team_subtitle || "");
  const [teamLogoUrl, setTeamLogoUrl] = useState(DEFAULT_SETTINGS.team_logo_url || "");
  const [dashboardCoverUrl, setDashboardCoverUrl] = useState(
    DEFAULT_SETTINGS.dashboard_cover_url || ""
  );

  const [primaryColor, setPrimaryColor] = useState(DEFAULT_SETTINGS.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SETTINGS.secondary_color);
  const [accentColor, setAccentColor] = useState(DEFAULT_SETTINGS.accent_color);

  const [language, setLanguage] = useState<LanguageCode>(DEFAULT_SETTINGS.language);
  const [dateFormat, setDateFormat] = useState<DateFormat>(DEFAULT_SETTINGS.date_format);
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_SETTINGS.theme_mode);
  const [densityMode, setDensityMode] = useState<DensityMode>(DEFAULT_SETTINGS.density_mode);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(DEFAULT_SETTINGS.time_format);

  const [defaultWarningHours, setDefaultWarningHours] = useState(
    String(DEFAULT_SETTINGS.default_warning_hours)
  );
  const [defaultRevisionHours, setDefaultRevisionHours] = useState(
    String(DEFAULT_SETTINGS.default_revision_hours)
  );
  const [defaultExpiryAlertDays, setDefaultExpiryAlertDays] = useState(
    String(DEFAULT_SETTINGS.default_expiry_alert_days)
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

  const languageLabel = useMemo(() => {
    const map: Record<LanguageCode, string> = {
      it: "Italiano",
      en: "English",
      fr: "Français",
      de: "Deutsch",
      es: "Español",
    };
    return map[language];
  }, [language]);

  function applySettings(row: AppSettingsRow) {
    setSettingsId(row.id);
    setMissingSettings(false);

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

    setDefaultWarningHours(String(row.default_warning_hours ?? DEFAULT_SETTINGS.default_warning_hours));
    setDefaultRevisionHours(
      String(row.default_revision_hours ?? DEFAULT_SETTINGS.default_revision_hours)
    );
    setDefaultExpiryAlertDays(
      String(row.default_expiry_alert_days ?? DEFAULT_SETTINGS.default_expiry_alert_days)
    );

    setEnableEvents(row.enable_events ?? DEFAULT_SETTINGS.enable_events);
    setEnableMaintenances(row.enable_maintenances ?? DEFAULT_SETTINGS.enable_maintenances);
    setEnableFuel(row.enable_fuel ?? DEFAULT_SETTINGS.enable_fuel);
    setEnableSetup(row.enable_setup ?? DEFAULT_SETTINGS.enable_setup);
    setEnableNotes(row.enable_notes ?? DEFAULT_SETTINGS.enable_notes);

    setEmailNotifications(
      row.email_notifications ?? DEFAULT_SETTINGS.email_notifications
    );
    setCalendarSync(row.calendar_sync ?? DEFAULT_SETTINGS.calendar_sync);
    setCriticalAlerts(row.critical_alerts ?? DEFAULT_SETTINGS.critical_alerts);
    setWeeklySummary(row.weekly_summary ?? DEFAULT_SETTINGS.weekly_summary);
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("app_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (!data) {
          setMissingSettings(true);
        } else {
          applySettings(data as AppSettingsRow);
        }
      } catch (error: any) {
        showToast(`Errore caricamento impostazioni: ${error.message}`, "error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  async function handleSave() {
    if (!settingsId) {
      showToast(
        "Configurazione iniziale mancante. Crea prima una riga in app_settings su Supabase.",
        "error"
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
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
      };

      const { data, error } = await supabase
        .from("app_settings")
        .update(payload)
        .eq("id", settingsId)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      applySettings(data as AppSettingsRow);
      showToast("Impostazioni salvate correttamente");
    } catch (error: any) {
      showToast(`Errore salvataggio impostazioni: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

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
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <Settings size={14} />
                Personalizzazione web app
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Impostazioni
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Personalizza identità, lingua, moduli e comportamento operativo della web app
                per adattarla alla tua scuderia o ad altri team.
              </p>
            </div>

            <button onClick={handleSave} disabled={saving || !settingsId} className="btn-primary">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? "Salvataggio..." : "Salva impostazioni"}
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6">
          {missingSettings && (
            <div className="mb-5 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="text-yellow-700 mt-0.5" size={18} />
                <div>
                  <div className="font-bold text-yellow-800">Configurazione iniziale mancante</div>
                  <div className="text-sm text-yellow-700 mt-1 leading-relaxed">
                    La tabella <span className="font-semibold">app_settings</span> non contiene
                    ancora nessuna riga. Inserisci una riga iniziale da Supabase e poi ricarica
                    questa pagina.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Building2 size={18} className="text-yellow-600" />}
              label="Team attivo"
              value={teamName || "—"}
            />
            <SummaryCard
              icon={<Languages size={18} className="text-yellow-600" />}
              label="Lingua"
              value={languageLabel}
            />
            <SummaryCard
              icon={<Palette size={18} className="text-yellow-600" />}
              label="Tema interfaccia"
              value={capitalize(themeMode)}
            />
            <SummaryCard
              icon={<ToggleLeft size={18} className="text-yellow-600" />}
              label="Moduli attivi"
              value={String(
                [enableEvents, enableMaintenances, enableFuel, enableSetup, enableNotes].filter(
                  Boolean
                ).length
              )}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SettingsCard
          title="Brand scuderia"
          icon={<Building2 className="text-yellow-500" size={18} />}
          description="Identità visiva del team e contenuti principali della web app."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome team">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="input-base"
                placeholder="Battaglia Racing"
              />
            </Field>

            <Field label="Sottotitolo / claim">
              <input
                type="text"
                value={teamSubtitle}
                onChange={(e) => setTeamSubtitle(e.target.value)}
                className="input-base"
                placeholder="Gestione tecnica motorsport"
              />
            </Field>

            <Field label="URL logo team">
              <input
                type="text"
                value={teamLogoUrl}
                onChange={(e) => setTeamLogoUrl(e.target.value)}
                className="input-base"
                placeholder="https://..."
              />
            </Field>

            <Field label="URL immagine dashboard">
              <input
                type="text"
                value={dashboardCoverUrl}
                onChange={(e) => setDashboardCoverUrl(e.target.value)}
                className="input-base"
                placeholder="https://..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <ColorField label="Colore primario" value={primaryColor} onChange={setPrimaryColor} />
            <ColorField
              label="Colore secondario"
              value={secondaryColor}
              onChange={setSecondaryColor}
            />
            <ColorField label="Colore accento" value={accentColor} onChange={setAccentColor} />
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-semibold text-neutral-700 mb-2">Anteprima rapida</div>
            <div className="rounded-xl border overflow-hidden bg-white">
              <div
                className="px-4 py-3 font-bold"
                style={{ backgroundColor: secondaryColor, color: primaryColor }}
              >
                {teamName || "Nome team"}
              </div>
              <div className="p-4 text-sm text-neutral-700 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{teamSubtitle || "Descrizione team"}</div>
                  <div className="text-neutral-500 text-xs mt-1">
                    Anteprima card intestazione web app
                  </div>
                </div>
                <div
                  className="h-10 w-10 rounded-full border"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Lingua e localizzazione"
          icon={<Languages className="text-yellow-500" size={18} />}
          description="Configura la lingua principale della web app e il formato dei dati."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Lingua interfaccia">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="input-base"
              >
                <option value="it">Italiano</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
              </select>
            </Field>

            <Field label="Formato data">
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                className="input-base"
              >
                <option value="it">Italiano (gg/mm/aaaa)</option>
                <option value="en">Internazionale (mm/dd/yyyy)</option>
                <option value="iso">ISO (yyyy-mm-dd)</option>
              </select>
            </Field>

            <Field label="Formato ore">
              <select
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value as TimeFormat)}
                className="input-base"
              >
                <option value="ore_minuti">Ore + minuti</option>
                <option value="decimale">Ore decimali</option>
              </select>
            </Field>

            <Field label="Tema">
              <select
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
                className="input-base"
              >
                <option value="automatico">Automatico</option>
                <option value="chiaro">Chiaro</option>
                <option value="scuro">Scuro</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-semibold text-neutral-700 mb-1">Anteprima</div>
            <div className="text-sm text-neutral-600">
              Lingua selezionata: <span className="font-semibold">{languageLabel}</span>
            </div>
            <div className="text-sm text-neutral-600 mt-1">
              Data esempio:{" "}
              <span className="font-semibold">
                {dateFormat === "it"
                  ? "31/12/2026"
                  : dateFormat === "en"
                  ? "12/31/2026"
                  : "2026-12-31"}
              </span>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Aspetto interfaccia"
          icon={<Palette className="text-yellow-500" size={18} />}
          description="Definisci come deve apparire la web app sui vari dispositivi."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Densità interfaccia">
              <select
                value={densityMode}
                onChange={(e) => setDensityMode(e.target.value as DensityMode)}
                className="input-base"
              >
                <option value="compatta">Compatta</option>
                <option value="standard">Standard</option>
                <option value="ampia">Ampia</option>
              </select>
            </Field>

            <Field label="Immagine / branding visuale">
              <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-500 flex items-center gap-2">
                <ImageIcon size={16} />
                Area pronta per upload logo/copertina
              </div>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MiniInfoCard label="Tema" value={capitalize(themeMode)} />
            <MiniInfoCard label="Densità" value={capitalize(densityMode)} />
            <MiniInfoCard
              label="Formato ore"
              value={timeFormat === "ore_minuti" ? "Ore + minuti" : "Decimale"}
            />
          </div>
        </SettingsCard>

        <SettingsCard
          title="Preferenze operative"
          icon={<SlidersHorizontal className="text-yellow-500" size={18} />}
          description="Valori predefiniti per lavorare più velocemente nei flussi quotidiani."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Soglia attenzione (ore)">
              <input
                type="number"
                value={defaultWarningHours}
                onChange={(e) => setDefaultWarningHours(e.target.value)}
                className="input-base"
              />
            </Field>

            <Field label="Soglia revisione (ore)">
              <input
                type="number"
                value={defaultRevisionHours}
                onChange={(e) => setDefaultRevisionHours(e.target.value)}
                className="input-base"
              />
            </Field>

            <Field label="Alert scadenza (giorni)">
              <input
                type="number"
                value={defaultExpiryAlertDays}
                onChange={(e) => setDefaultExpiryAlertDays(e.target.value)}
                className="input-base"
              />
            </Field>
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            Questi valori possono essere usati come default automatici quando crei nuovi
            componenti o nuove regole operative per la scuderia.
          </div>
        </SettingsCard>

        <SettingsCard
          title="Moduli attivi"
          icon={<LayoutDashboard className="text-yellow-500" size={18} />}
          description="Attiva o disattiva le sezioni della web app in base alle esigenze del team."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow
              label="Calendario eventi"
              checked={enableEvents}
              onChange={setEnableEvents}
              icon={<CalendarDays size={16} className="text-yellow-600" />}
            />
            <ToggleRow
              label="Manutenzioni"
              checked={enableMaintenances}
              onChange={setEnableMaintenances}
              icon={<Wrench size={16} className="text-yellow-600" />}
            />
            <ToggleRow
              label="Gestione carburante"
              checked={enableFuel}
              onChange={setEnableFuel}
              icon={<Fuel size={16} className="text-yellow-600" />}
            />
            <ToggleRow
              label="Setup assetto"
              checked={enableSetup}
              onChange={setEnableSetup}
              icon={<Settings size={16} className="text-yellow-600" />}
            />
            <ToggleRow
              label="Note tecniche"
              checked={enableNotes}
              onChange={setEnableNotes}
              icon={<NotebookPen size={16} className="text-yellow-600" />}
            />
          </div>
        </SettingsCard>

        <SettingsCard
          title="Notifiche e integrazioni"
          icon={<Bell className="text-yellow-500" size={18} />}
          description="Configura avvisi, riepiloghi e collegamenti con servizi esterni."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow
              label="Notifiche via email"
              checked={emailNotifications}
              onChange={setEmailNotifications}
              icon={<Bell size={16} className="text-yellow-600" />}
            />
            <ToggleRow
              label="Avvisi criticità"
              checked={criticalAlerts}
              onChange={setCriticalAlerts}
              icon={<ShieldCheck size={16} className="text-yellow-600" />}
            />
            <ToggleRow
              label="Riepilogo settimanale"
              checked={weeklySummary}
              onChange={setWeeklySummary}
              icon={<CalendarDays size={16} className="text-yellow-600" />}
            />
            <ToggleRow
              label="Sincronizza calendario esterno"
              checked={calendarSync}
              onChange={setCalendarSync}
              icon={<Calendar size={16} className="text-yellow-600" />}
            />
          </div>
        </SettingsCard>
      </section>

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-lg font-semibold flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-yellow-400 text-black"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function SettingsCard({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-base p-5 md:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h2 className="text-lg font-bold text-neutral-800">{title}</h2>
          <p className="text-sm text-neutral-500 mt-1">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
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
      <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
        {label}
      </label>
      {children}
    </div>
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
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="text-sm font-semibold text-neutral-700 mb-2">{label}</div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-base"
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: React.ReactNode;
}) {
  return (
    <label className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-semibold text-neutral-800">{label}</span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-yellow-400" : "bg-neutral-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}