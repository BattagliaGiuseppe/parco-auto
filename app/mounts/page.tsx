"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers3, Link2, Unlink, CarFront, Boxes } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";

export default function MountsPage() {
  const [mounts, setMounts] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [selectedCar, setSelectedCar] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("");
  const [mountedAt, setMountedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [{ data: carsData }, { data: compsData }, { data: mountsData }] = await Promise.all([
        supabase.from("cars").select("id, name").eq("team_id", ctx.teamId).order("name"),
        supabase.from("components").select("id, type, identifier, car_id").eq("team_id", ctx.teamId).order("identifier"),
        supabase
          .from("car_components")
          .select("id, mounted_at, removed_at, status, notes, hours_used, cars(name), components(type, identifier)")
          .eq("team_id", ctx.teamId)
          .order("mounted_at", { ascending: false }),
      ]);
      setCars(carsData || []);
      setComponents(compsData || []);
      setMounts(mountsData || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function addMount(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCar || !selectedComponent) return;
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();

      await supabase.from("car_components").update({ removed_at: new Date().toISOString(), status: "unmounted" }).eq("team_id", ctx.teamId).eq("component_id", selectedComponent).is("removed_at", null);

      const { error } = await supabase.from("car_components").insert([
        {
          team_id: ctx.teamId,
          car_id: selectedCar,
          component_id: selectedComponent,
          mounted_at: mountedAt || new Date().toISOString(),
          status: "mounted",
        },
      ]);
      if (error) throw error;

      await supabase.from("components").update({ car_id: selectedCar }).eq("team_id", ctx.teamId).eq("id", selectedComponent);

      setSelectedCar("");
      setSelectedComponent("");
      setMountedAt("");
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Errore montaggio componente");
    } finally {
      setSaving(false);
    }
  }

  async function unmount(id: string) {
    try {
      const ctx = await getCurrentTeamContext();
      const { data: row } = await supabase.from("car_components").select("component_id").eq("team_id", ctx.teamId).eq("id", id).single();
      await supabase.from("car_components").update({ removed_at: new Date().toISOString(), status: "unmounted" }).eq("team_id", ctx.teamId).eq("id", id);
      if (row?.component_id) {
        await supabase.from("components").update({ car_id: null }).eq("team_id", ctx.teamId).eq("id", row.component_id);
      }
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Errore smontaggio componente");
    }
  }

  const activeMounts = mounts.filter((m) => !m.removed_at);
  const stats: StatItem[] = useMemo(
    () => [
      { label: "Montaggi attivi", value: String(activeMounts.length), icon: <Link2 size={18} /> },
      { label: "Storico totale", value: String(mounts.length), icon: <Layers3 size={18} /> },
      { label: "Auto", value: String(cars.length), icon: <CarFront size={18} /> },
      { label: "Componenti", value: String(components.length), icon: <Boxes size={18} /> },
    ],
    [activeMounts.length, mounts.length, cars.length, components.length]
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Montaggi" subtitle="Configurazione tecnica attiva e storico montaggi/smontaggi" icon={<Layers3 size={22} />} />

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard title="Montaggio rapido" subtitle="Collega un componente disponibile a un'auto">
        <form onSubmit={addMount} className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <select value={selectedCar} onChange={(e) => setSelectedCar(e.target.value)} className="rounded-xl border p-3" required>
            <option value="">Seleziona auto</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select value={selectedComponent} onChange={(e) => setSelectedComponent(e.target.value)} className="rounded-xl border p-3" required>
            <option value="">Seleziona componente</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>{c.type} – {c.identifier}</option>
            ))}
          </select>

          <input type="date" value={mountedAt} onChange={(e) => setMountedAt(e.target.value)} className="rounded-xl border p-3" />

          <button type="submit" disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500 disabled:opacity-60">
            {saving ? "Montaggio..." : "Monta componente"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Montaggi attivi" subtitle="Situazione attuale dei componenti montati">
        {loading ? (
          <div className="text-neutral-500">Caricamento...</div>
        ) : activeMounts.length === 0 ? (
          <EmptyState title="Nessun montaggio attivo" />
        ) : (
          <div className="space-y-3">
            {activeMounts.map((m) => (
              <div key={m.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-bold text-neutral-900">{m.components?.type} · {m.components?.identifier}</div>
                  <div className="mt-1 text-sm text-neutral-500">{m.cars?.name} · dal {new Date(m.mounted_at).toLocaleDateString("it-IT")}</div>
                </div>
                <button onClick={() => unmount(m.id)} className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600">
                  <Unlink size={16} className="inline mr-2" />Scollega
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Storico" subtitle="Cronologia completa dei montaggi registrati">
        {mounts.length === 0 ? (
          <EmptyState title="Nessun montaggio registrato" />
        ) : (
          <div className="space-y-3">
            {mounts.map((m) => (
              <div key={m.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="font-semibold text-neutral-900">{m.components?.type} · {m.components?.identifier}</div>
                <div className="mt-1 text-sm text-neutral-600">{m.cars?.name}</div>
                <div className="mt-2 text-xs text-neutral-500">
                  {m.mounted_at ? `Montato il ${new Date(m.mounted_at).toLocaleDateString("it-IT")}` : ""}
                  {m.removed_at ? ` · Smontato il ${new Date(m.removed_at).toLocaleDateString("it-IT")}` : " · Attivo"}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
