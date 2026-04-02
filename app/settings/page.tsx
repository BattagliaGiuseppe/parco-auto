"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Settings, SlidersHorizontal, Blocks, ShieldCheck } from "lucide-react";
import { Audiowide } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

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

const emptyModuleState = {
  drivers: true,
  performance: true,
  inventory: true,
  telemetry: true,
  documents: true,
  mounts: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettingsRow | null>(null);
  const [definitions, setDefinitions] = useState<ComponentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [{ data: settingsData }, { data: defsData }] = await Promise.all([
        supabase.from("app_settings").select("*").eq("team_id", ctx.teamId).single(),
        supabase
          .from("team_component_definitions")
          .select("*")
          .eq("team_id", ctx.teamId)
          .order("order_index", { ascending: true }),
      ]);

      setSettings(settingsData as AppSettingsRow);
      setDefinitions((defsData || []) as ComponentDefinition[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const stats: StatItem[] = useMemo(() => {
    return [
      { label: "Componenti standard", value: String(definitions.length), icon: <Blocks size={18} /> },
      { label: "Moduli attivi", value: String(Object.values(settings?.modules || emptyModuleState).filter(Boolean).length), icon: <ShieldCheck size={18} /> },
      { label: "Tipo mezzo", value: settings?.vehicle_type || "—", icon: <SlidersHorizontal size={18} /> },
      { label: "Team", value: settings?.team_name || "—", icon: <Settings size={18} /> },
    ];
  }, [definitions.length, settings?.modules, settings?.team_name, settings?.vehicle_type]);

  function patchSetting<K extends keyof AppSettingsRow>(key: K, value: AppSettingsRow[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  function patchDefinition(id: string, key: keyof ComponentDefinition, value: any) {
    setDefinitions((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }

  function addDefinition() {
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
    ]);
  }

  async function saveAll() {
    if (!settings) return;
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { error: settingsError } = await supabase
        .from("app_settings")
        .update({
          team_name: settings.team_name,
          team_subtitle: settings.team_subtitle,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          accent_color: settings.accent_color,
          vehicle_type: settings.vehicle_type,
          default_warning_hours: settings.default_warning_hours,
          default_revision_hours: settings.default_revision_hours,
          default_expiry_alert_days: settings.default_expiry_alert_days,
          modules: settings.modules,
          dashboard_layout: settings.dashboard_layout,
        })
        .eq("team_id", ctx.teamId);
      if (settingsError) throw settingsError;

      const cleanRows = definitions
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

      const { error: deleteError } = await supabase.from("team_component_definitions").delete().eq("team_id", ctx.teamId);
      if (deleteError) throw deleteError;
      if (cleanRows.length) {
        const { error: insertError } = await supabase.from("team_component_definitions").insert(cleanRows);
        if (insertError) throw insertError;
      }

      setToast("Impostazioni salvate");
      setTimeout(() => setToast(""), 2500);
      await loadAll();
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio impostazioni");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return <div className="p-6 text-neutral-500">Caricamento impostazioni...</div>;
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      {toast ? <div className="fixed right-6 top-6 z-50 rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-black shadow-lg">{toast}</div> : null}

      <PageHeader
        title="Control Center"
        subtitle="Branding, moduli, preset mezzo, componenti standard e soglie operative"
        icon={<Settings size={22} />}
        actions={
          <button onClick={saveAll} disabled={saving} className="btn-primary bg-yellow-400 px-4 py-2 font-bold text-black rounded-xl hover:bg-yellow-500">
            <Save size={16} className="inline mr-2" />
            {saving ? "Salvataggio..." : "Salva impostazioni"}
          </button>
        }
      />

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Branding e identità" subtitle="Configurazione visuale del team">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nome team">
              <input className="w-full rounded-xl border p-3" value={settings.team_name} onChange={(e) => patchSetting("team_name", e.target.value)} />
            </Field>
            <Field label="Sottotitolo">
              <input className="w-full rounded-xl border p-3" value={settings.team_subtitle || ""} onChange={(e) => patchSetting("team_subtitle", e.target.value)} />
            </Field>
            <Field label="Colore primario"><input type="color" className="h-12 w-full rounded-xl border p-1" value={settings.primary_color} onChange={(e) => patchSetting("primary_color", e.target.value)} /></Field>
            <Field label="Colore secondario"><input type="color" className="h-12 w-full rounded-xl border p-1" value={settings.secondary_color} onChange={(e) => patchSetting("secondary_color", e.target.value)} /></Field>
            <Field label="Accent color"><input type="color" className="h-12 w-full rounded-xl border p-1" value={settings.accent_color} onChange={(e) => patchSetting("accent_color", e.target.value)} /></Field>
            <Field label="Tipo mezzo">
              <select className="w-full rounded-xl border p-3" value={settings.vehicle_type} onChange={(e) => patchSetting("vehicle_type", e.target.value)}>
                <option value="auto">Auto</option>
                <option value="moto">Moto</option>
                <option value="kart">Kart</option>
                <option value="formula">Formula</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Moduli e soglie" subtitle="Attiva solo ciò che serve al tuo team">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries({ ...(settings.modules || emptyModuleState) }).map(([key, enabled]) => (
              <label key={key} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <span className="font-semibold capitalize text-neutral-800">{key}</span>
                <input
                  type="checkbox"
                  checked={!!enabled}
                  onChange={(e) => patchSetting("modules", { ...(settings.modules || emptyModuleState), [key]: e.target.checked })}
                />
              </label>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Warning ore default">
              <input type="number" className="w-full rounded-xl border p-3" value={settings.default_warning_hours} onChange={(e) => patchSetting("default_warning_hours", Number(e.target.value || 0))} />
            </Field>
            <Field label="Revisione ore default">
              <input type="number" className="w-full rounded-xl border p-3" value={settings.default_revision_hours} onChange={(e) => patchSetting("default_revision_hours", Number(e.target.value || 0))} />
            </Field>
            <Field label="Alert scadenza (giorni)">
              <input type="number" className="w-full rounded-xl border p-3" value={settings.default_expiry_alert_days} onChange={(e) => patchSetting("default_expiry_alert_days", Number(e.target.value || 0))} />
            </Field>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Componenti standard configurabili" subtitle="Queste definizioni guidano il modulo Auto e il preset mezzo">
        {definitions.length === 0 ? <EmptyState title="Nessuna definizione presente" description="Aggiungi le voci base del tuo mezzo: componenti standard, soglie, elementi con scadenza." /> : null}
        <div className="space-y-3">
          {definitions.map((row) => (
            <div key={row.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 lg:grid-cols-[1fr_1.3fr_160px_110px_110px_140px]">
              <input className="rounded-xl border p-3" value={row.code} onChange={(e) => patchDefinition(row.id, "code", e.target.value)} placeholder="code" />
              <input className="rounded-xl border p-3" value={row.label} onChange={(e) => patchDefinition(row.id, "label", e.target.value)} placeholder="Etichetta" />
              <select className="rounded-xl border p-3" value={row.category} onChange={(e) => patchDefinition(row.id, "category", e.target.value)}>
                <option value="base">Base</option>
                <option value="expiry">Scadenza</option>
                <option value="optional">Opzionale</option>
              </select>
              <label className="flex items-center justify-between rounded-xl border bg-white px-3 py-3 text-sm">
                Ore
                <input type="checkbox" checked={row.tracks_hours} onChange={(e) => patchDefinition(row.id, "tracks_hours", e.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded-xl border bg-white px-3 py-3 text-sm">
                Scadenza
                <input type="checkbox" checked={row.has_expiry} onChange={(e) => patchDefinition(row.id, "has_expiry", e.target.checked)} />
              </label>
              <input type="number" className="rounded-xl border p-3" value={row.default_expiry_years || 0} onChange={(e) => patchDefinition(row.id, "default_expiry_years", Number(e.target.value || 0))} placeholder="Anni default" />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button onClick={addDefinition} className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800">Aggiungi definizione</button>
        </div>
      </SectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-neutral-700">{label}</label>
      {children}
    </div>
  );
}
