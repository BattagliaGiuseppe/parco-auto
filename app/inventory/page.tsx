"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Package, PlusCircle, Download, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import StatsGrid from "@/components/StatsGrid";

export default function InventoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    category: "",
    quantity: "0",
    minimum_quantity: "0",
    reserved_quantity: "0",
    unit: "pz",
    location: "",
    notes: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("team_id", ctx.teamId)
      .order("created_at", { ascending: false });
    setRows(data || []);
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(
    () => [
      { label: "Articoli", value: String(rows.length), icon: <Package size={18} /> },
      {
        label: "Sotto scorta",
        value: String(
          rows.filter((row) => Number(row.quantity || 0) <= Number(row.minimum_quantity || 0)).length
        ),
        icon: <Package size={18} />,
      },
      {
        label: "Quantità impegnata",
        value: String(rows.reduce((acc, row) => acc + Number(row.reserved_quantity || 0), 0)),
        icon: <Package size={18} />,
      },
      {
        label: "Totale disponibile",
        value: String(rows.reduce((acc, row) => acc + Number(row.quantity || 0), 0)),
        icon: <Package size={18} />,
      },
    ],
    [rows]
  );

  async function addItem() {
    if (!form.name.trim()) {
      alert("Inserisci il nome articolo");
      return;
    }
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from("inventory_items").insert([
      {
        team_id: ctx.teamId,
        name: form.name.trim(),
        category: form.category || null,
        quantity: Number(form.quantity || 0),
        minimum_quantity: Number(form.minimum_quantity || 0),
        reserved_quantity: Number(form.reserved_quantity || 0),
        unit: form.unit || "pz",
        location: form.location || null,
        notes: form.notes || null,
      },
    ]);
    if (!error) {
      setForm({
        name: "",
        category: "",
        quantity: "0",
        minimum_quantity: "0",
        reserved_quantity: "0",
        unit: "pz",
        location: "",
        notes: "",
      });
      await load();
    }
  }

  function exportCsv() {
    const header = [
      "name",
      "category",
      "quantity",
      "minimum_quantity",
      "reserved_quantity",
      "unit",
      "location",
      "notes",
    ];
    const lines = rows.map((row) => header.map((key) => JSON.stringify(row[key] ?? "")).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    if (!headerLine) return;
    const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const ctx = await getCurrentTeamContext();
    const rowsToInsert = lines
      .map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const record: any = { team_id: ctx.teamId };
        headers.forEach((header, index) => {
          record[header] = values[index] || null;
        });
        record.quantity = Number(record.quantity || 0);
        record.minimum_quantity = Number(record.minimum_quantity || 0);
        record.reserved_quantity = Number(record.reserved_quantity || 0);
        record.unit = record.unit || "pz";
        return record;
      })
      .filter((row) => row.name);

    if (rowsToInsert.length === 0) return;
    const { error } = await supabase.from("inventory_items").insert(rowsToInsert);
    if (error) alert(error.message);
    else await load();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Magazzino"
        subtitle="Scorte, sottoscorta, quantità impegnate e import/export CSV"
        icon={<Package size={22} />}
        actions={
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border px-4 py-2 font-semibold"
            >
              <Upload size={16} className="mr-2 inline" />Importa CSV
            </button>
            <button
              onClick={exportCsv}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"
            >
              <Download size={16} className="mr-2 inline" />Esporta CSV
            </button>
          </>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importCsv(file);
        }}
      />
      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>
      <SectionCard
        title="Nuovo articolo"
        subtitle="Quantità disponibile, minima e impegnata sono ora separate e chiare"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className="rounded-xl border p-3" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="rounded-xl border p-3" type="number" placeholder="Quantità disponibile" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input className="rounded-xl border p-3" type="number" placeholder="Quantità minima" value={form.minimum_quantity} onChange={(e) => setForm({ ...form, minimum_quantity: e.target.value })} />
          <input className="rounded-xl border p-3" type="number" placeholder="Quantità impegnata" value={form.reserved_quantity} onChange={(e) => setForm({ ...form, reserved_quantity: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="Unità (es. pz, set, L)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="Posizione" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="Note" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="mt-4">
          <button onClick={addItem} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">
            <PlusCircle size={16} className="mr-2 inline" />Aggiungi articolo
          </button>
        </div>
      </SectionCard>
      <SectionCard title="Archivio magazzino">
        {rows.length === 0 ? (
          <EmptyState title="Nessun articolo di magazzino" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-500">
                  <th className="p-3">Nome</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Disponibile</th>
                  <th className="p-3">Minima</th>
                  <th className="p-3">Impegnata</th>
                  <th className="p-3">Unità</th>
                  <th className="p-3">Posizione</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="p-3 font-semibold">{row.name}</td>
                    <td className="p-3">{row.category || "—"}</td>
                    <td className="p-3">{row.quantity}</td>
                    <td className="p-3">{row.minimum_quantity}</td>
                    <td className="p-3">{row.reserved_quantity}</td>
                    <td className="p-3">{row.unit || "pz"}</td>
                    <td className="p-3">{row.location || "—"}</td>
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
