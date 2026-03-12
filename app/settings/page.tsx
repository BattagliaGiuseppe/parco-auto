"use client";

import { useMemo, useState } from "react";
import {
  Settings,
  Save,
  Palette,
  Languages,
  Bell,
  ShieldCheck,
  LayoutDashboard,
  Wrench,
  CalendarDays,
  Fuel,
  NotebookPen,
  SlidersHorizontal,
  Image as ImageIcon,
  Building2,
  ToggleLeft,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type DensityMode = "compatta" | "standard" | "ampia";
type ThemeMode = "chiaro" | "scuro" | "automatico";
type TimeFormat = "ore_minuti" | "decimale";
type DateFormat = "it" | "en" | "iso";
type LanguageCode = "it" | "en" | "fr" | "de" | "es";

export default function SettingsPage() {
  const [teamName, setTeamName] = useState("Battaglia Racing");
  const [teamSubtitle, setTeamSubtitle] = useState("Gestione tecnica parco auto da corsa");
  const [teamLogoUrl, setTeamLogoUrl] = useState("");
  const [dashboardCoverUrl, setDashboardCoverUrl] = useState("");

  const [primaryColor, setPrimaryColor] = useState("#facc15");
  const [secondaryColor, setSecondaryColor] = useState("#111111");
  const [accentColor, setAccentColor] = useState("#eab308");

  const [language, setLanguage] = useState<LanguageCode>("it");
  const [dateFormat, setDateFormat] = useState<DateFormat>("it");
  const [themeMode, setThemeMode] = useState<ThemeMode>("automatico");
  const [densityMode, setDensityMode] = useState<DensityMode>("standard");
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("ore_minuti");

  const [defaultWarningHours, setDefaultWarningHours] = useState("20");
  const [defaultRevisionHours, setDefaultRevisionHours] = useState("30");
  const [defaultExpiryAlertDays, setDefaultExpiryAlertDays] = useState("30");

  const [enableEvents, setEnableEvents] = useState(true);
  const [enableMaintenances, setEnableMaintenances] = useState(true);
  const [enableFuel, setEnableFuel] = useState(true);
  const [enableSetup, setEnableSetup] = useState(true);
  const [enableNotes, setEnableNotes] = useState(true);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [calendarSync, setCalendarSync] = useState(false);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);

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

            <button className="btn-primary">
              <Save size={18} /> Salva impostazioni
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6">
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
            <ColorField
              label="Colore primario"
              value={primaryColor}
              onChange={setPrimaryColor}
            />
            <ColorField
              label="Colore secondario"
              value={secondaryColor}
              onChange={setSecondaryColor}
            />
            <ColorField
              label="Colore accento"
              value={accentColor}
              onChange={setAccentColor}
            />
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
            <MiniInfoCard label="Formato ore" value={timeFormat === "ore_minuti" ? "Ore + minuti" : "Decimale"} />
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