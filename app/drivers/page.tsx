"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", nickname: "", email: "", phone: "" });

  async function load() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { data } = await supabase.from("drivers").select("*").eq("team_id", ctx.teamId).order("last_name");
      setDrivers(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase.from("drivers").insert([{ ...form, team_id: ctx.teamId }]);
      if (error) throw error;
      setOpen(false);
      setForm({ first_name: "", last_name: "", nickname: "", email: "", phone: "" });
      await load();
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio pilota");
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Piloti" subtitle="Anagrafica, documenti, licenze e collegamento agli eventi" icon={<Users size={22} />} actions={<button onClick={() => setOpen(true)} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"><PlusCircle size={16} className="inline mr-2" />Nuovo pilota</button>} />

      <SectionCard title="Elenco piloti">
        {loading ? <div className="text-neutral-500">Caricamento...</div> : drivers.length === 0 ? <EmptyState title="Nessun pilota registrato" /> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => (
              <Link key={driver.id} href={`/drivers/${driver.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:shadow-md">
                <div className="font-bold text-neutral-900">{driver.first_name} {driver.last_name}</div>
                <div className="mt-1 text-sm text-neutral-500">{driver.nickname || "Nessun nickname"}</div>
                <div className="mt-3 text-sm text-neutral-700">{driver.email || "—"}</div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-neutral-900">Nuovo pilota</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(form).map(([key, value]) => (
                <input key={key} className="rounded-xl border p-3" value={value} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} placeholder={key.replace("_", " ")} />
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="rounded-xl bg-neutral-100 px-4 py-2">Annulla</button>
              <button onClick={save} disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">{saving ? "Salvataggio..." : "Salva pilota"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
