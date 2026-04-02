"use client";

import { useEffect, useState } from "react";
import { Package, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";

export default function InventoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", category: "", quantity: "0", location: "" });

  async function load() {
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase.from("inventory_items").select("*").eq("team_id", ctx.teamId).order("created_at", { ascending: false });
    setRows(data || []);
  }

  useEffect(() => { load(); }, []);

  async function addItem() {
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from("inventory_items").insert([{ team_id: ctx.teamId, name: form.name, category: form.category || null, quantity: Number(form.quantity || 0), location: form.location || null }]);
    if (!error) {
      setForm({ name: "", category: "", quantity: "0", location: "" });
      await load();
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Magazzino" subtitle="Ricambi, materiali e scorte" icon={<Package size={22} />} />
      <SectionCard title="Nuovo articolo">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className="rounded-xl border p-3" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="rounded-xl border p-3" type="number" placeholder="Quantità" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="Posizione" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="mt-4"><button onClick={addItem} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"><PlusCircle size={16} className="inline mr-2" />Aggiungi</button></div>
      </SectionCard>
      <SectionCard title="Articoli registrati">
        {rows.length === 0 ? <EmptyState title="Nessun articolo di magazzino" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b text-left text-neutral-500"><th className="p-3">Nome</th><th className="p-3">Categoria</th><th className="p-3">Quantità</th><th className="p-3">Posizione</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b"><td className="p-3 font-semibold">{row.name}</td><td className="p-3">{row.category || '—'}</td><td className="p-3">{row.quantity}</td><td className="p-3">{row.location || '—'}</td></tr>)}</tbody></table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
