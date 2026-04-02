"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Settings, Blocks, LayoutPanelTop, ShieldCheck, Wrench, PlusCircle, Trash2 } from "lucide-react";
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
  labels?: Record<string, string> | null;
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

type ChecklistGroup = { id: string; name: string; order_index: number; items: ChecklistItem[] };
type ChecklistItem = { id: string; label: string; input_type: string; is_required: boolean; order_index: number };
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

const emptyModuleState = { drivers: true, performance: true, inventory: true, telemetry: true, documents: true, mounts: true };
const emptyLabels = { vehicle: 'Auto', driver: 'Pilota', event: 'Evento', turn: 'Turno' };

function SectionTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tabs = [
    ['general', 'Generale'],
    ['components', 'Componenti standard'],
    ['checklists', 'Check-up'],
    ['setup', 'Setup'],
    ['dashboard', 'Dashboard'],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${value === key ? 'bg-yellow-400 text-black' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettingsRow | null>(null);
  const [definitions, setDefinitions] = useState<ComponentDefinition[]>([]);
  const [checklists, setChecklists] = useState<ChecklistGroup[]>([]);
  const [setupFields, setSetupFields] = useState<SetupField[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [section, setSection] = useState('general');

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [settingsRes, defsRes, groupsRes, itemsRes, setupRes, widgetsRes] = await Promise.all([
        supabase.from('app_settings').select('*').eq('team_id', ctx.teamId).single(),
        supabase.from('team_component_definitions').select('*').eq('team_id', ctx.teamId).order('order_index', { ascending: true }),
        supabase.from('team_checklists').select('*').eq('team_id', ctx.teamId).order('order_index', { ascending: true }),
        supabase.from('team_checklist_items').select('*').eq('team_id', ctx.teamId).order('order_index', { ascending: true }),
        supabase.from('team_setup_fields').select('*').eq('team_id', ctx.teamId).order('order_index', { ascending: true }),
        supabase.from('team_dashboard_widgets').select('*').eq('team_id', ctx.teamId).order('order_index', { ascending: true }),
      ]);

      const settingsData = settingsRes.data as AppSettingsRow;
      setSettings({ ...settingsData, labels: settingsData?.labels || emptyLabels });
      setDefinitions((defsRes.data || []) as ComponentDefinition[]);
      setSetupFields((setupRes.data || []) as SetupField[]);
      setWidgets((widgetsRes.data || []) as DashboardWidget[]);

      const groups = (groupsRes.data || []) as any[];
      const items = (itemsRes.data || []) as any[];
      setChecklists(groups.map((group) => ({
        ...group,
        items: items.filter((item) => item.checklist_id === group.id),
      })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  const stats: StatItem[] = useMemo(() => [
    { label: 'Componenti standard', value: String(definitions.length), icon: <Blocks size={18} /> },
    { label: 'Checklist', value: String(checklists.length), icon: <Wrench size={18} /> },
    { label: 'Campi setup', value: String(setupFields.length), icon: <LayoutPanelTop size={18} /> },
    { label: 'Moduli attivi', value: String(Object.values(settings?.modules || emptyModuleState).filter(Boolean).length), icon: <ShieldCheck size={18} /> },
  ], [definitions.length, checklists.length, setupFields.length, settings?.modules]);

  function patchSetting<K extends keyof AppSettingsRow>(key: K, value: AppSettingsRow[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  async function saveAll() {
    if (!settings) return;
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { error: settingsError } = await supabase.from('app_settings').update({
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
        dashboard_layout: settings.dashboard_layout || {},
        labels: settings.labels || emptyLabels,
      }).eq('team_id', ctx.teamId);
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
      await supabase.from('team_component_definitions').delete().eq('team_id', ctx.teamId);
      if (cleanDefinitions.length) {
        const { error } = await supabase.from('team_component_definitions').insert(cleanDefinitions);
        if (error) throw error;
      }

      await supabase.from('team_checklist_items').delete().eq('team_id', ctx.teamId);
      await supabase.from('team_checklists').delete().eq('team_id', ctx.teamId);
      for (let index = 0; index < checklists.length; index++) {
        const group = checklists[index];
        if (!group.name.trim()) continue;
        const { data: createdGroup, error: groupError } = await supabase.from('team_checklists').insert([{ team_id: ctx.teamId, name: group.name.trim(), order_index: index + 1 }]).select('*').single();
        if (groupError) throw groupError;
        const itemRows = group.items
          .filter((item) => item.label.trim())
          .map((item, itemIndex) => ({
            team_id: ctx.teamId,
            checklist_id: createdGroup.id,
            label: item.label.trim(),
            input_type: item.input_type || 'status',
            is_required: item.is_required,
            order_index: itemIndex + 1,
          }));
        if (itemRows.length) {
          const { error: itemError } = await supabase.from('team_checklist_items').insert(itemRows);
          if (itemError) throw itemError;
        }
      }

      const cleanSetupFields = setupFields
        .filter((field) => field.field_key.trim() && field.label.trim())
        .map((field, index) => ({
          team_id: ctx.teamId,
          field_key: field.field_key.trim(),
          label: field.label.trim(),
          group_name: field.group_name || 'Generale',
          field_type: field.field_type || 'text',
          unit: field.unit || null,
          position: field.position || 'left',
          order_index: index + 1,
          is_required: field.is_required,
        }));
      await supabase.from('team_setup_fields').delete().eq('team_id', ctx.teamId);
      if (cleanSetupFields.length) {
        const { error } = await supabase.from('team_setup_fields').insert(cleanSetupFields);
        if (error) throw error;
      }

      const cleanWidgets = widgets
        .filter((widget) => widget.widget_code.trim() && widget.label.trim())
        .map((widget, index) => ({
          team_id: ctx.teamId,
          role_scope: widget.role_scope || 'all',
          widget_code: widget.widget_code.trim(),
          label: widget.label.trim(),
          is_enabled: widget.is_enabled,
          size: widget.size || 'md',
          order_index: index + 1,
          config: {},
        }));
      await supabase.from('team_dashboard_widgets').delete().eq('team_id', ctx.teamId);
      if (cleanWidgets.length) {
        const { error } = await supabase.from('team_dashboard_widgets').insert(cleanWidgets);
        if (error) throw error;
      }

      setToast('Control Center aggiornato');
      setTimeout(() => setToast(''), 2500);
      await loadAll();
    } catch (err) {
      console.error(err);
      alert('Errore salvataggio impostazioni');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) return <div className="p-6 text-neutral-500">Caricamento impostazioni...</div>;

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      {toast ? <div className="fixed right-6 top-6 z-50 rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-black shadow-lg">{toast}</div> : null}
      <PageHeader
        title="Control Center"
        subtitle="Branding, moduli, template mezzo, checklist, setup e dashboard del team"
        icon={<Settings size={22} />}
        actions={<button onClick={saveAll} disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">
          <Save size={16} className="mr-2 inline" />{saving ? 'Salvataggio...' : 'Salva impostazioni'}
        </button>}
      />

      <SectionCard><StatsGrid items={stats} /></SectionCard>
      <SectionTabs value={section} onChange={setSection} />

      {section === 'general' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard title="Branding e identità" subtitle="Configura il team e la terminologia della piattaforma">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nome team"><input className="w-full rounded-xl border p-3" value={settings.team_name} onChange={(e) => patchSetting('team_name', e.target.value)} /></Field>
              <Field label="Sottotitolo"><input className="w-full rounded-xl border p-3" value={settings.team_subtitle || ''} onChange={(e) => patchSetting('team_subtitle', e.target.value)} /></Field>
              <Field label="Colore primario"><input type="color" className="h-12 w-full rounded-xl border p-1" value={settings.primary_color} onChange={(e) => patchSetting('primary_color', e.target.value)} /></Field>
              <Field label="Colore secondario"><input type="color" className="h-12 w-full rounded-xl border p-1" value={settings.secondary_color} onChange={(e) => patchSetting('secondary_color', e.target.value)} /></Field>
              <Field label="Accent color"><input type="color" className="h-12 w-full rounded-xl border p-1" value={settings.accent_color} onChange={(e) => patchSetting('accent_color', e.target.value)} /></Field>
              <Field label="Tipo mezzo">
                <select className="w-full rounded-xl border p-3" value={settings.vehicle_type} onChange={(e) => patchSetting('vehicle_type', e.target.value)}>
                  <option value="auto">Auto</option><option value="moto">Moto</option><option value="kart">Kart</option><option value="formula">Formula</option><option value="custom">Custom</option>
                </select>
              </Field>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              {Object.entries(settings.labels || emptyLabels).map(([key, value]) => (
                <Field key={key} label={`Etichetta ${key}`}><input className="w-full rounded-xl border p-3" value={value} onChange={(e) => patchSetting('labels', { ...(settings.labels || emptyLabels), [key]: e.target.value })} /></Field>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Moduli e soglie" subtitle="Attiva i moduli e governa alert e soglie di default">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Object.entries({ ...(settings.modules || emptyModuleState) }).map(([key, enabled]) => (
                <label key={key} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="font-semibold capitalize text-neutral-800">{key}</span>
                  <input type="checkbox" checked={!!enabled} onChange={(e) => patchSetting('modules', { ...(settings.modules || emptyModuleState), [key]: e.target.checked })} />
                </label>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Warning ore default"><input type="number" className="w-full rounded-xl border p-3" value={settings.default_warning_hours} onChange={(e) => patchSetting('default_warning_hours', Number(e.target.value || 0))} /></Field>
              <Field label="Revisione ore default"><input type="number" className="w-full rounded-xl border p-3" value={settings.default_revision_hours} onChange={(e) => patchSetting('default_revision_hours', Number(e.target.value || 0))} /></Field>
              <Field label="Alert scadenza (giorni)"><input type="number" className="w-full rounded-xl border p-3" value={settings.default_expiry_alert_days} onChange={(e) => patchSetting('default_expiry_alert_days', Number(e.target.value || 0))} /></Field>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {section === 'components' ? (
        <SectionCard title="Componenti standard configurabili" subtitle="Definiscono il modulo Auto, la scheda mezzo e la struttura base del parco">
          {definitions.length === 0 ? <EmptyState title="Nessuna definizione presente" description="Aggiungi le voci base del tuo mezzo." /> : null}
          <div className="space-y-3">
            {definitions.map((row, index) => (
              <div key={row.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 lg:grid-cols-[1fr_1.2fr_150px_110px_110px_120px_40px]">
                <input className="rounded-xl border p-3" value={row.code} onChange={(e) => setDefinitions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, code: e.target.value } : item))} placeholder="code" />
                <input className="rounded-xl border p-3" value={row.label} onChange={(e) => setDefinitions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label: e.target.value } : item))} placeholder="Etichetta" />
                <select className="rounded-xl border p-3" value={row.category} onChange={(e) => setDefinitions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, category: e.target.value } : item))}><option value="base">Base</option><option value="expiry">Scadenza</option><option value="optional">Opzionale</option></select>
                <ToggleBox label="Ore" checked={row.tracks_hours} onChange={(checked) => setDefinitions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, tracks_hours: checked } : item))} />
                <ToggleBox label="Scadenza" checked={row.has_expiry} onChange={(checked) => setDefinitions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, has_expiry: checked } : item))} />
                <input type="number" className="rounded-xl border p-3" value={row.default_expiry_years || 0} onChange={(e) => setDefinitions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, default_expiry_years: Number(e.target.value || 0) } : item))} placeholder="Anni" />
                <button onClick={() => setDefinitions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl bg-red-100 text-red-700 hover:bg-red-200"><Trash2 size={16} className="mx-auto" /></button>
              </div>
            ))}
          </div>
          <div className="mt-4"><button onClick={() => setDefinitions((prev) => [...prev, { id: `temp-${Date.now()}`, code: '', label: '', category: 'base', is_required: true, tracks_hours: false, has_expiry: false, default_expiry_years: null, order_index: prev.length + 1 }])} className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"><PlusCircle size={16} className="mr-2 inline" />Aggiungi definizione</button></div>
        </SectionCard>
      ) : null}

      {section === 'checklists' ? (
        <SectionCard title="Check-up configurabile" subtitle="Definisci gruppi e voci del controllo tecnico">
          {checklists.length === 0 ? <EmptyState title="Nessun gruppo di checklist" /> : null}
          <div className="space-y-4">
            {checklists.map((group, groupIndex) => (
              <div key={group.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <input className="w-full rounded-xl border p-3" value={group.name} onChange={(e) => setChecklists((prev) => prev.map((g, i) => i === groupIndex ? { ...g, name: e.target.value } : g))} placeholder="Nome gruppo" />
                  <button onClick={() => setChecklists((prev) => prev.filter((_, i) => i !== groupIndex))} className="rounded-xl bg-red-100 px-3 py-3 text-red-700"><Trash2 size={16} /></button>
                </div>
                <div className="space-y-2">
                  {group.items.map((item, itemIndex) => (
                    <div key={item.id} className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_160px_110px_40px]">
                      <input className="rounded-xl border p-3" value={item.label} onChange={(e) => setChecklists((prev) => prev.map((g, i) => i === groupIndex ? { ...g, items: g.items.map((it, j) => j === itemIndex ? { ...it, label: e.target.value } : it) } : g))} placeholder="Voce checklist" />
                      <select className="rounded-xl border p-3" value={item.input_type} onChange={(e) => setChecklists((prev) => prev.map((g, i) => i === groupIndex ? { ...g, items: g.items.map((it, j) => j === itemIndex ? { ...it, input_type: e.target.value } : it) } : g))}>
                        <option value="status">Status</option><option value="text">Testo</option><option value="number">Numero</option>
                      </select>
                      <ToggleBox label="Obbl." checked={item.is_required} onChange={(checked) => setChecklists((prev) => prev.map((g, i) => i === groupIndex ? { ...g, items: g.items.map((it, j) => j === itemIndex ? { ...it, is_required: checked } : it) } : g))} />
                      <button onClick={() => setChecklists((prev) => prev.map((g, i) => i === groupIndex ? { ...g, items: g.items.filter((_, j) => j !== itemIndex) } : g))} className="rounded-xl bg-red-100 text-red-700 hover:bg-red-200"><Trash2 size={16} className="mx-auto" /></button>
                    </div>
                  ))}
                </div>
                <div className="mt-3"><button onClick={() => setChecklists((prev) => prev.map((g, i) => i === groupIndex ? { ...g, items: [...g.items, { id: `temp-${Date.now()}`, label: '', input_type: 'status', is_required: true, order_index: g.items.length + 1 }] } : g))} className="rounded-xl bg-white px-4 py-2 font-semibold text-neutral-700 border">Aggiungi voce</button></div>
              </div>
            ))}
          </div>
          <div className="mt-4"><button onClick={() => setChecklists((prev) => [...prev, { id: `temp-${Date.now()}`, name: '', order_index: prev.length + 1, items: [] }])} className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"><PlusCircle size={16} className="mr-2 inline" />Aggiungi gruppo</button></div>
        </SectionCard>
      ) : null}

      {section === 'setup' ? (
        <SectionCard title="Setup dinamico" subtitle="Configura campi, gruppi e posizioni della scheda setup">
          {setupFields.length === 0 ? <EmptyState title="Nessun campo setup configurato" /> : null}
          <div className="space-y-3">
            {setupFields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 lg:grid-cols-[1fr_1.2fr_180px_140px_120px_120px_40px]">
                <input className="rounded-xl border p-3" value={field.field_key} onChange={(e) => setSetupFields((prev) => prev.map((item, i) => i === index ? { ...item, field_key: e.target.value } : item))} placeholder="chiave" />
                <input className="rounded-xl border p-3" value={field.label} onChange={(e) => setSetupFields((prev) => prev.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} placeholder="Etichetta" />
                <input className="rounded-xl border p-3" value={field.group_name} onChange={(e) => setSetupFields((prev) => prev.map((item, i) => i === index ? { ...item, group_name: e.target.value } : item))} placeholder="Gruppo" />
                <select className="rounded-xl border p-3" value={field.field_type} onChange={(e) => setSetupFields((prev) => prev.map((item, i) => i === index ? { ...item, field_type: e.target.value } : item))}>
                  <option value="text">Testo</option><option value="number">Numero</option><option value="textarea">Textarea</option><option value="select">Select</option>
                </select>
                <input className="rounded-xl border p-3" value={field.unit || ''} onChange={(e) => setSetupFields((prev) => prev.map((item, i) => i === index ? { ...item, unit: e.target.value } : item))} placeholder="Unità" />
                <select className="rounded-xl border p-3" value={field.position} onChange={(e) => setSetupFields((prev) => prev.map((item, i) => i === index ? { ...item, position: e.target.value } : item))}><option value="left">Sinistra</option><option value="center">Centro</option><option value="right">Destra</option></select>
                <button onClick={() => setSetupFields((prev) => prev.filter((_, i) => i !== index))} className="rounded-xl bg-red-100 text-red-700 hover:bg-red-200"><Trash2 size={16} className="mx-auto" /></button>
              </div>
            ))}
          </div>
          <div className="mt-4"><button onClick={() => setSetupFields((prev) => [...prev, { id: `temp-${Date.now()}`, field_key: '', label: '', group_name: 'Generale', field_type: 'text', unit: null, position: 'left', order_index: prev.length + 1, is_required: false }])} className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"><PlusCircle size={16} className="mr-2 inline" />Aggiungi campo setup</button></div>
        </SectionCard>
      ) : null}

      {section === 'dashboard' ? (
        <SectionCard title="Dashboard configurabile" subtitle="Scegli widget, ordine e visibilità">
          {widgets.length === 0 ? <EmptyState title="Nessun widget configurato" /> : null}
          <div className="space-y-3">
            {widgets.map((widget, index) => (
              <div key={widget.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 lg:grid-cols-[1fr_1.2fr_120px_120px_110px_40px]">
                <input className="rounded-xl border p-3" value={widget.widget_code} onChange={(e) => setWidgets((prev) => prev.map((item, i) => i === index ? { ...item, widget_code: e.target.value } : item))} placeholder="Codice widget" />
                <input className="rounded-xl border p-3" value={widget.label} onChange={(e) => setWidgets((prev) => prev.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} placeholder="Etichetta" />
                <select className="rounded-xl border p-3" value={widget.role_scope} onChange={(e) => setWidgets((prev) => prev.map((item, i) => i === index ? { ...item, role_scope: e.target.value } : item))}><option value="all">Tutti</option><option value="owner">Owner</option><option value="admin">Admin</option><option value="engineer">Engineer</option><option value="mechanic">Mechanic</option><option value="viewer">Viewer</option></select>
                <select className="rounded-xl border p-3" value={widget.size} onChange={(e) => setWidgets((prev) => prev.map((item, i) => i === index ? { ...item, size: e.target.value } : item))}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select>
                <ToggleBox label="Attivo" checked={widget.is_enabled} onChange={(checked) => setWidgets((prev) => prev.map((item, i) => i === index ? { ...item, is_enabled: checked } : item))} />
                <button onClick={() => setWidgets((prev) => prev.filter((_, i) => i !== index))} className="rounded-xl bg-red-100 text-red-700 hover:bg-red-200"><Trash2 size={16} className="mx-auto" /></button>
              </div>
            ))}
          </div>
          <div className="mt-4"><button onClick={() => setWidgets((prev) => [...prev, { id: `temp-${Date.now()}`, role_scope: 'all', widget_code: '', label: '', is_enabled: true, size: 'md', order_index: prev.length + 1 }])} className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"><PlusCircle size={16} className="mr-2 inline" />Aggiungi widget</button></div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-semibold text-neutral-700">{label}</label>{children}</div>;
}

function ToggleBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-xl border bg-white px-3 py-3 text-sm">{label}<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}
