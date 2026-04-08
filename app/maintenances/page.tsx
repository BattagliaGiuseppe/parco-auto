"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext, getTeamUsers } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import { Edit, PlusCircle, X, Wrench, CalendarDays, CarFront, Boxes } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";

type CarOption = { id: string; name: string };
type ComponentOption = { id: string; identifier: string };
const emptyForm = { carId: '', componentId: '', date: new Date().toISOString().slice(0,10), type: '', notes: '', status: 'completed', priority: 'medium', assignedTo: '' };

export default function MaintenancesPage() {
  const access = usePermissionAccess();
  const canViewMaintenances = access.hasPermission("maintenances.view");
  const canEditMaintenances = access.hasPermission("maintenances.edit", ["owner", "admin"]);

  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cars, setCars] = useState<CarOption[]>([]);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [teamRole, setTeamRole] = useState('viewer');

  async function fetchMaintenances() {
    setLoading(true);
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase
      .from('maintenances')
      .select('id, date, type, notes, status, priority, car_id(id,name), component_id(id,identifier), assigned_to_team_user_id(id,name,email)')
      .eq('team_id', ctx.teamId)
      .order('date', { ascending: false });
    setMaintenances(data || []);
    setLoading(false);
  }

  async function fetchCarsAndComponents() {
    const ctx = await getCurrentTeamContext();
    const [carsRes, compsRes, teamUsersRes] = await Promise.all([
      supabase.from('cars').select('id, name').eq('team_id', ctx.teamId).order('name'),
      supabase.from('components').select('id, identifier').eq('team_id', ctx.teamId).order('identifier'),
      getTeamUsers(),
    ]);
    setTeamRole(ctx.role);
    setCars((carsRes.data || []) as CarOption[]);
    setComponents((compsRes.data || []) as ComponentOption[]);
    setTeamUsers(teamUsersRes || []);
  }

  useEffect(() => {
    if (!access.loading && canViewMaintenances) {
      void fetchMaintenances();
      void fetchCarsAndComponents();
    }
  }, [access.loading, canViewMaintenances]);

  const stats = useMemo(() => [
    { label: 'Totale', value: String(maintenances.length), icon: <Wrench size={18} /> },
    { label: 'Aperte', value: String(maintenances.filter((m) => m.status !== 'completed').length), icon: <CalendarDays size={18} /> },
    { label: 'Auto coinvolte', value: String(new Set(maintenances.map((m) => m.car_id?.id).filter(Boolean)).size), icon: <CarFront size={18} /> },
    { label: 'Componenti', value: String(new Set(maintenances.map((m) => m.component_id?.id).filter(Boolean)).size), icon: <Boxes size={18} /> },
  ], [maintenances]);

  function validate() {
    const next: Record<string, string> = {};
    if (!form.carId) next.carId = 'Seleziona un mezzo';
    if (!form.componentId) next.componentId = 'Seleziona un componente';
    if (!form.date) next.date = 'Inserisci la data';
    if (!form.type.trim()) next.type = 'Inserisci il tipo intervento';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function openForEdit(m: any) {
    if (!canEditMaintenances) return;
    setEditId(m.id);
    setForm({
      carId: m.car_id?.id || '',
      componentId: m.component_id?.id || '',
      date: m.date || new Date().toISOString().slice(0,10),
      type: m.type || '',
      notes: m.notes || '',
      status: m.status || 'completed',
      priority: m.priority || 'medium',
      assignedTo: m.assigned_to_team_user_id?.id || '',
    });
    setErrors({});
    setOpenModal(true);
  }

  async function saveMaintenance() {
    if (!canEditMaintenances || !validate()) return;
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const payload = {
        car_id: form.carId,
        component_id: form.componentId,
        date: form.date,
        type: form.type.trim(),
        notes: form.notes.trim() || null,
        status: form.status,
        priority: form.priority,
        assigned_to_team_user_id: form.assignedTo || null,
        created_by_team_user_id: ctx.teamUserId,
      };
      if (editId) {
        const { error } = await supabase.from('maintenances').update(payload).eq('id', editId).eq('team_id', ctx.teamId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('maintenances').insert([{ team_id: ctx.teamId, ...payload }]);
        if (error) throw error;
      }
      setOpenModal(false);
      setEditId(null);
      setForm(emptyForm);
      await fetchMaintenances();
    } catch (e) {
      console.error('Errore salvataggio manutenzione:', e);
      alert('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  const canAssign = canEditMaintenances && (teamRole === 'owner' || teamRole === 'admin');

  if (access.loading) {
    return <PagePermissionState title="Manutenzioni" subtitle="Workflow tecnico con priorità, stato e assegnazione" icon={<Wrench size={22} />} state="loading" />;
  }
  if (access.error) {
    return <PagePermissionState title="Manutenzioni" subtitle="Workflow tecnico con priorità, stato e assegnazione" icon={<Wrench size={22} />} state="error" message={access.error} />;
  }
  if (!canViewMaintenances) {
    return <PagePermissionState title="Manutenzioni" subtitle="Workflow tecnico con priorità, stato e assegnazione" icon={<Wrench size={22} />} state="denied" message="Il tuo ruolo non ha accesso al modulo manutenzioni." />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Manutenzioni" subtitle="Workflow tecnico con priorità, stato e assegnazione" icon={<Wrench size={22} />} actions={canEditMaintenances ? <button onClick={() => { setOpenModal(true); setEditId(null); setForm(emptyForm); setErrors({}); }} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"><PlusCircle size={16} className="mr-2 inline" />Aggiungi manutenzione</button> : undefined} />
      {!canEditMaintenances ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Hai accesso in sola lettura a questo modulo.</div> : null}
      <SectionCard><StatsGrid items={stats} /></SectionCard>
      <SectionCard title="Storico interventi">
        {loading ? <div className="text-neutral-500">Caricamento...</div> : maintenances.length === 0 ? <EmptyState title="Nessuna manutenzione registrata" /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{maintenances.map((m) => <div key={m.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-neutral-900">{m.type}</div><div className="mt-1 text-sm text-neutral-500">{m.car_id?.name || '—'} · {m.component_id?.identifier || '—'}</div></div>{canEditMaintenances ? <button onClick={() => openForEdit(m)} className="rounded-xl bg-yellow-100 px-3 py-2 text-sm font-semibold text-yellow-800 hover:bg-yellow-200"><Edit size={16} className="mr-2 inline" />Modifica</button> : null}</div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><Info label="Data" value={m.date ? new Date(m.date).toLocaleDateString('it-IT') : '—'} /><Info label="Priorità" value={m.priority || '—'} /><Info label="Stato" value={m.status || '—'} /><Info label="Assegnato a" value={m.assigned_to_team_user_id?.name || m.assigned_to_team_user_id?.email || '—'} /></div>{m.notes ? <div className="mt-3 text-sm text-neutral-700">{m.notes}</div> : null}</div>)}</div>}
      </SectionCard>

      {openModal && canEditMaintenances ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-neutral-900">{editId ? 'Modifica manutenzione' : 'Aggiungi manutenzione'}</h3><button onClick={() => setOpenModal(false)} className="rounded-xl bg-neutral-100 p-2"><X size={18} /></button></div><div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Mezzo" required error={errors.carId}><select className="w-full rounded-xl border p-3" value={form.carId} onChange={(e) => setForm({ ...form, carId: e.target.value })}><option value="">Seleziona mezzo</option>{cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Componente" required error={errors.componentId}><select className="w-full rounded-xl border p-3" value={form.componentId} onChange={(e) => setForm({ ...form, componentId: e.target.value })}><option value="">Seleziona componente</option>{components.map((c) => <option key={c.id} value={c.id}>{c.identifier}</option>)}</select></Field><Field label="Data" required error={errors.date}><input type="date" className="w-full rounded-xl border p-3" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field><Field label="Tipo intervento" required error={errors.type}><input className="w-full rounded-xl border p-3" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Es. revisione, sostituzione, controllo" /></Field><Field label="Stato"><select className="w-full rounded-xl border p-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="open">Aperta</option><option value="in_progress">In corso</option><option value="completed">Completata</option></select></Field><Field label="Priorità"><select className="w-full rounded-xl border p-3" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Bassa</option><option value="medium">Media</option><option value="high">Alta</option></select></Field>{canAssign ? <Field label="Assegna a"><select className="w-full rounded-xl border p-3" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Nessuno</option>{teamUsers.map((user) => <option key={user.id} value={user.id}>{user.name || user.email || user.role}</option>)}</select></Field> : null}<div className={'md:col-span-2'}><Field label="Note"><textarea className="w-full rounded-xl border p-3 min-h-28" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div></div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setOpenModal(false)} className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold">Annulla</button><button onClick={saveMaintenance} disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">{saving ? 'Salvataggio...' : 'Salva manutenzione'}</button></div></div></div> : null}
    </div>
  );
}

function Field({ label, required = false, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-semibold text-neutral-700">{label}{required ? <span className="text-red-500"> *</span> : null}</label>{children}{error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 font-semibold text-neutral-900">{value}</div></div>;
}
