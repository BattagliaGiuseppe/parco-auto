"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Audiowide } from "next/font/google";
import { Boxes, PlusCircle, Search, Filter } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CarOption = { id: string; name: string };
type Definition = { code: string; label: string; category?: string | null; is_required?: boolean | null; tracks_hours?: boolean | null; has_expiry?: boolean | null; default_expiry_years?: number | null; order_index?: number | null };
type ComponentRow = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
  notes: string | null;
  car_id: string | null;
  car: { name: string } | { name: string }[] | null;
};

function normalizeCarName(car: ComponentRow['car']) {
  if (!car) return null;
  if (Array.isArray(car)) return car[0]?.name || null;
  return car.name || null;
}

function getStatus(row: ComponentRow) {
  const hours = Number(row.hours || 0);
  if (row.expiry_date && new Date(row.expiry_date) < new Date()) return { label: 'Scaduto', tone: 'red' as const };
  if (row.revision_threshold_hours !== null && row.revision_threshold_hours !== undefined && hours >= row.revision_threshold_hours) return { label: 'Fuori soglia', tone: 'red' as const };
  if (row.warning_threshold_hours !== null && row.warning_threshold_hours !== undefined && hours >= row.warning_threshold_hours) return { label: 'Attenzione', tone: 'yellow' as const };
  return { label: row.car_id ? 'Montato' : 'Smontato', tone: row.car_id ? 'blue' as const : 'neutral' as const };
}

export default function ComponentsPage() {
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'mounted' | 'unmounted'>('all');
  const [carFilter, setCarFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ type: '', customType: '', identifier: '', car_id: '', hours: '0', life_hours: '0', warning_threshold_hours: '', revision_threshold_hours: '', expiry_date: '', notes: '' });

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [rowsRes, carsRes, defsRes] = await Promise.all([
        supabase.from('components').select('id,type,identifier,expiry_date,hours,life_hours,warning_threshold_hours,revision_threshold_hours,notes,car_id,car:car_id(name)').eq('team_id', ctx.teamId).order('identifier', { ascending: true }),
        supabase.from('cars').select('id,name').eq('team_id', ctx.teamId).order('name', { ascending: true }),
        supabase.from('team_component_definitions').select('*').eq('team_id', ctx.teamId).order('order_index', { ascending: true }),
      ]);
      setRows((rowsRes.data || []) as ComponentRow[]);
      setCars((carsRes.data || []) as CarOption[]);
      setDefinitions((defsRes.data || []) as Definition[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  const availableTypes = useMemo(() => {
    const fromDefinitions = definitions.map((definition) => ({ value: definition.code, label: definition.label }));
    const fromRows = [...new Set(rows.map((row) => row.type))]
      .filter((value) => !fromDefinitions.some((definition) => definition.value === value))
      .map((value) => ({ value, label: value }));
    return [...fromDefinitions, ...fromRows];
  }, [definitions, rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const carName = normalizeCarName(row.car) || '';
      const q = search.trim().toLowerCase();
      if (statusFilter === 'mounted' && !row.car_id) return false;
      if (statusFilter === 'unmounted' && row.car_id) return false;
      if (carFilter && row.car_id !== carFilter) return false;
      if (typeFilter && row.type !== typeFilter) return false;
      if (q && !(`${row.identifier} ${row.type} ${carName}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, statusFilter, carFilter, typeFilter, search]);

  const stats = useMemo(() => [
    { label: 'Totale componenti', value: String(rows.length), icon: <Boxes size={18} /> },
    { label: 'Montati', value: String(rows.filter((row) => !!row.car_id).length), icon: <Filter size={18} /> },
    { label: 'Smontati', value: String(rows.filter((row) => !row.car_id).length), icon: <Filter size={18} /> },
    { label: 'Tipi configurati', value: String(definitions.length), icon: <Boxes size={18} /> },
  ], [rows, definitions.length]);

  async function saveComponent() {
    const type = form.type === '__custom__' ? form.customType.trim() : form.type;
    if (!type || !form.identifier.trim()) {
      alert('Tipo e identificativo sono obbligatori');
      return;
    }
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const payload: any = {
        team_id: ctx.teamId,
        type,
        identifier: form.identifier.trim(),
        car_id: form.car_id || null,
        hours: Number(form.hours || 0),
        life_hours: Number(form.life_hours || 0),
        warning_threshold_hours: form.warning_threshold_hours ? Number(form.warning_threshold_hours) : null,
        revision_threshold_hours: form.revision_threshold_hours ? Number(form.revision_threshold_hours) : null,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
        is_active: true,
      };

      if (form.type === '__custom__') {
        const existingDefinition = definitions.find((definition) => definition.code === type);
        if (!existingDefinition) {
          const { error: definitionError } = await supabase.from('team_component_definitions').insert([{
            team_id: ctx.teamId,
            code: type,
            label: type,
            category: form.expiry_date ? 'expiry' : 'optional',
            is_required: false,
            tracks_hours: true,
            has_expiry: !!form.expiry_date,
            default_expiry_years: form.expiry_date ? 1 : null,
            order_index: definitions.length + 1,
          }]);
          if (definitionError) throw definitionError;
        }
      }

      const { error } = await supabase.from('components').insert([payload]);
      if (error) throw error;
      setOpen(false);
      setForm({ type: '', customType: '', identifier: '', car_id: '', hours: '0', life_hours: '0', warning_threshold_hours: '', revision_threshold_hours: '', expiry_date: '', notes: '' });
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('Errore salvataggio componente');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader title="Componenti" subtitle="Archivio tecnico, filtri professionali e creazione componenti dal template team" icon={<Boxes size={22} />} actions={<button onClick={() => setOpen(true)} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"><PlusCircle size={16} className="mr-2 inline" />Nuovo componente</button>} />
      <SectionCard><StatsGrid items={stats} /></SectionCard>
      <SectionCard title="Filtri" subtitle="Prima scegli lo stato, poi eventualmente l'auto o il tipo">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[180px_220px_220px_1fr]">
          <select className="rounded-xl border p-3" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}><option value="all">Tutti</option><option value="mounted">Montati</option><option value="unmounted">Smontati</option></select>
          <select className="rounded-xl border p-3" value={carFilter} onChange={(e) => setCarFilter(e.target.value)}><option value="">Tutte le auto</option>{cars.map((car) => <option key={car.id} value={car.id}>{car.name}</option>)}</select>
          <select className="rounded-xl border p-3" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">Tutti i tipi</option>{availableTypes.map((definition) => <option key={definition.value} value={definition.value}>{definition.label}</option>)}</select>
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"><Search size={18} className="text-neutral-400" /><input className="w-full bg-transparent outline-none" placeholder="Cerca identificativo, tipo o auto" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
      </SectionCard>
      <SectionCard title="Archivio componenti">
        {loading ? <div className="text-neutral-500">Caricamento componenti...</div> : filtered.length === 0 ? <EmptyState title="Nessun componente trovato" /> : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filtered.map((row) => {
              const status = getStatus(row);
              return (
                <div key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-neutral-900">{row.type} · {row.identifier}</div>
                      <div className="mt-1 text-sm text-neutral-500">{normalizeCarName(row.car) || 'Non montato'} · Ore {Number(row.hours || 0).toFixed(1)}</div>
                    </div>
                    <StatusBadge label={status.label} tone={status.tone} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/components/${row.id}`} className="rounded-xl border px-4 py-2 text-sm font-semibold">Apri scheda</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <PageHeader title="Nuovo componente" subtitle="I tipi configurati arrivano dalle impostazioni, ma puoi anche creare un tipo custom" />
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <Field label="Tipo" required>
                  <select className="w-full rounded-xl border p-3" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="">Seleziona tipo</option>
                    {availableTypes.map((definition) => <option key={definition.value} value={definition.value}>{definition.label}</option>)}
                    <option value="__custom__">Tipo personalizzato</option>
                  </select>
                </Field>
                {form.type === '__custom__' ? <Field label="Nuovo tipo" required><input className="w-full rounded-xl border p-3" value={form.customType} onChange={(e) => setForm({ ...form, customType: e.target.value })} /></Field> : null}
                <Field label="Identificativo" required><input className="w-full rounded-xl border p-3" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></Field>
                <Field label="Monta subito su mezzo"><select className="w-full rounded-xl border p-3" value={form.car_id} onChange={(e) => setForm({ ...form, car_id: e.target.value })}><option value="">Nessuno</option>{cars.map((car) => <option key={car.id} value={car.id}>{car.name}</option>)}</select></Field>
              </div>
              <div className="space-y-4">
                <Field label="Ore"><input type="number" className="w-full rounded-xl border p-3" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
                <Field label="Vita componente"><input type="number" className="w-full rounded-xl border p-3" value={form.life_hours} onChange={(e) => setForm({ ...form, life_hours: e.target.value })} /></Field>
                <Field label="Warning ore"><input type="number" className="w-full rounded-xl border p-3" value={form.warning_threshold_hours} onChange={(e) => setForm({ ...form, warning_threshold_hours: e.target.value })} /></Field>
                <Field label="Revisione ore"><input type="number" className="w-full rounded-xl border p-3" value={form.revision_threshold_hours} onChange={(e) => setForm({ ...form, revision_threshold_hours: e.target.value })} /></Field>
                <Field label="Scadenza"><input type="date" className="w-full rounded-xl border p-3" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
              </div>
              <div className="md:col-span-2"><Field label="Note"><textarea className="w-full rounded-xl border p-3 min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => setOpen(false)} className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold">Annulla</button><button onClick={saveComponent} disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">{saving ? 'Salvataggio...' : 'Salva componente'}</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-semibold text-neutral-700">{label}{required ? <span className="text-red-500"> *</span> : null}</label>{children}</div>;
}
