"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers3, Link2, Unlink, Search, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext, getTeamUsers } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

export default function MountsPage() {
  const [mounts, setMounts] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [teamRole, setTeamRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCar, setSelectedCar] = useState('');
  const [selectedComponent, setSelectedComponent] = useState('');
  const [mountedAt, setMountedAt] = useState(new Date().toISOString().slice(0,10));
  const [mountedBy, setMountedBy] = useState('');
  const [reason, setReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'history'>('all');
  const [carFilter, setCarFilter] = useState('');
  const [search, setSearch] = useState('');

  async function loadAll() {
    setLoading(true);
    const ctx = await getCurrentTeamContext();
    const [mountsRes, carsRes, compsRes, usersRes] = await Promise.all([
      supabase.from('car_components').select('id, mounted_at, removed_at, status, reason, cars:car_id(id,name), components:component_id(id,type,identifier), mounted_by_team_user_id(id,name,email), removed_by_team_user_id(id,name,email)').eq('team_id', ctx.teamId).order('created_at', { ascending: false }),
      supabase.from('cars').select('id, name').eq('team_id', ctx.teamId).order('name', { ascending: true }),
      supabase.from('components').select('id, type, identifier, car_id').eq('team_id', ctx.teamId).is('car_id', null).order('identifier', { ascending: true }),
      getTeamUsers(),
    ]);
    setMounts(mountsRes.data || []);
    setCars(carsRes.data || []);
    setComponents(compsRes.data || []);
    setTeamUsers(usersRes || []);
    setTeamRole(ctx.role);
    setMountedBy(ctx.teamUserId);
    setLoading(false);
  }

  useEffect(() => { void loadAll(); }, []);

  const activeMounts = mounts.filter((m) => !m.removed_at);

  const filtered = useMemo(() => {
    const rows = mounts.filter((row) => {
      if (statusFilter === 'active' && row.removed_at) return false;
      if (statusFilter === 'history' && !row.removed_at) return false;
      if (carFilter && row.cars?.id !== carFilter) return false;
      const q = search.toLowerCase().trim();
      if (q && !`${row.components?.identifier || ''} ${row.components?.type || ''} ${row.cars?.name || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return rows;
  }, [mounts, statusFilter, carFilter, search]);

  const stats = useMemo(() => [
    { label: 'Montaggi attivi', value: String(activeMounts.length), icon: <Link2 size={18} /> },
    { label: 'Storico totale', value: String(mounts.length), icon: <Layers3 size={18} /> },
    { label: 'Auto', value: String(cars.length), icon: <Link2 size={18} /> },
    { label: 'Componenti disponibili', value: String(components.length), icon: <PlusCircle size={18} /> },
  ], [activeMounts.length, mounts.length, cars.length, components.length]);

  async function addMount(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCar || !selectedComponent) return;
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const actorId = (teamRole === 'owner' || teamRole === 'admin') ? (mountedBy || ctx.teamUserId) : ctx.teamUserId;
      const { error } = await supabase.from('car_components').insert([{
        team_id: ctx.teamId,
        car_id: selectedCar,
        component_id: selectedComponent,
        mounted_at: mountedAt,
        installed_at: mountedAt,
        status: 'mounted',
        mounted_by_team_user_id: actorId,
        reason: reason || null,
      }]);
      if (error) throw error;
      await supabase.from('components').update({ car_id: selectedCar }).eq('team_id', ctx.teamId).eq('id', selectedComponent);
      setSelectedCar(''); setSelectedComponent(''); setMountedAt(new Date().toISOString().slice(0,10)); setReason('');
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('Errore montaggio componente');
    } finally {
      setSaving(false);
    }
  }

  async function unmount(mountId: string, componentId: string) {
    const ctx = await getCurrentTeamContext();
    const actorId = ctx.teamUserId;
    const today = new Date().toISOString().slice(0,10);
    const { error } = await supabase.from('car_components').update({ removed_at: today, removed_by_team_user_id: actorId, status: 'unmounted' }).eq('team_id', ctx.teamId).eq('id', mountId);
    if (!error) {
      await supabase.from('components').update({ car_id: null }).eq('team_id', ctx.teamId).eq('id', componentId);
      await loadAll();
    }
  }

  const canChooseActor = teamRole === 'owner' || teamRole === 'admin';

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Montaggi" subtitle="Controllo configurazione tecnica del mezzo" icon={<Layers3 size={22} />} />
      <SectionCard><StatsGrid items={stats} /></SectionCard>
      <SectionCard title="Montaggio rapido" subtitle="La data odierna è precompilata: cambiala solo se serve">
        <form onSubmit={addMount} className="grid grid-cols-1 gap-3 xl:grid-cols-[180px_1fr_160px_1fr_160px]">
          <select value={selectedCar} onChange={(e) => setSelectedCar(e.target.value)} className="rounded-xl border p-3" required><option value="">Seleziona auto</option>{cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={selectedComponent} onChange={(e) => setSelectedComponent(e.target.value)} className="rounded-xl border p-3" required><option value="">Seleziona componente</option>{components.map((c) => <option key={c.id} value={c.id}>{c.type} · {c.identifier}</option>)}</select>
          <input type="date" value={mountedAt} onChange={(e) => setMountedAt(e.target.value)} className="rounded-xl border p-3" />
          {canChooseActor ? <select value={mountedBy} onChange={(e) => setMountedBy(e.target.value)} className="rounded-xl border p-3"><option value="">Operatore</option>{teamUsers.map((user) => <option key={user.id} value={user.id}>{user.name || user.email || user.role}</option>)}</select> : <input value="Operatore corrente" disabled className="rounded-xl border p-3 bg-neutral-100 text-neutral-500" />}
          <button type="submit" disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500 disabled:opacity-60">{saving ? 'Montaggio...' : 'Monta componente'}</button>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="xl:col-span-5 rounded-xl border p-3 min-h-24" placeholder="Motivo / note del montaggio" />
        </form>
      </SectionCard>

      <SectionCard title="Filtri storico" subtitle="Controlla attivi, storico e montaggi per auto">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[160px_220px_1fr]">
          <select className="rounded-xl border p-3" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}><option value="all">Tutti</option><option value="active">Attivi</option><option value="history">Storico chiuso</option></select>
          <select className="rounded-xl border p-3" value={carFilter} onChange={(e) => setCarFilter(e.target.value)}><option value="">Tutte le auto</option>{cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"><Search size={18} className="text-neutral-400" /><input className="w-full bg-transparent outline-none" placeholder="Cerca componente o auto" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
      </SectionCard>

      <SectionCard title="Montaggi" subtitle="Visione unificata attivo + storico">
        {loading ? <div className="text-neutral-500">Caricamento...</div> : filtered.length === 0 ? <EmptyState title="Nessun montaggio registrato" /> : <div className="space-y-3">{filtered.map((m) => <div key={m.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:flex-row md:items-center md:justify-between"><div><div className="font-bold text-neutral-900">{m.components?.type} · {m.components?.identifier}</div><div className="mt-1 text-sm text-neutral-500">{m.cars?.name} · montato dal {m.mounted_at ? new Date(m.mounted_at).toLocaleDateString('it-IT') : '—'}{m.removed_at ? ` · smontato il ${new Date(m.removed_at).toLocaleDateString('it-IT')}` : ''}</div><div className="mt-2 flex flex-wrap gap-2">{m.reason ? <span className="rounded-full bg-white px-3 py-1 text-xs text-neutral-600">{m.reason}</span> : null}<StatusBadge label={m.removed_at ? 'Storico' : 'Attivo'} tone={m.removed_at ? 'neutral' : 'green'} /></div></div>{!m.removed_at ? <button onClick={() => unmount(m.id, m.components?.id)} className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"><Unlink size={16} className="mr-2 inline" />Smonta</button> : null}</div>)}</div>}
      </SectionCard>
    </div>
  );
}
