"use client";

import { useEffect, useState } from "react";
import { Package, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  location: string | null;
  created_at: string;
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [location, setLocation] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const ctx = await getCurrentTeamContext();

      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems((data || []) as InventoryItem[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function addItem() {
    if (!name.trim()) return;

    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.from("inventory_items").insert([
        {
          team_id: ctx.teamId,
          name: name.trim(),
          category: category.trim() || null,
          quantity: Number(quantity || 0),
          location: location.trim() || null,
        },
      ]);

      if (error) throw error;

      setName("");
      setCategory("");
      setQuantity("0");
      setLocation("");
      await loadData();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Magazzino"
        subtitle="Gestione ricambi, materiali e scorte"
        icon={<Package size={22} />}
      />

      <SectionCard title="Nuovo articolo" subtitle="Inserisci un nuovo articolo di magazzino">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome articolo" />
          <input className="input-base" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria" />
          <input className="input-base" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantità" />
          <input className="input-base" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Posizione" />
        </div>

        <div className="mt-4">
          <button onClick={addItem} className="btn-primary">
            <PlusCircle size={16} />
            Aggiungi articolo
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Articoli" subtitle="Elenco articoli attualmente registrati">
        {loading ? (
          <div className="text-sm text-neutral-500">Caricamento...</div>
        ) : items.length === 0 ? (
          <EmptyState title="Nessun articolo presente" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">Categoria</th>
                  <th className="p-3 text-left">Quantità</th>
                  <th className="p-3 text-left">Posizione</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-neutral-200 bg-white">
                    <td className="p-3 font-semibold text-neutral-900">{item.name}</td>
                    <td className="p-3">{item.category || "—"}</td>
                    <td className="p-3">{item.quantity ?? 0}</td>
                    <td className="p-3">{item.location || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}