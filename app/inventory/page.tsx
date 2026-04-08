"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Package, PlusCircle, Upload, Download } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import StatsGrid from "@/components/StatsGrid";
import PagePermissionState from "@/components/PagePermissionState";

export default function InventoryPage() {
  const access = usePermissionAccess();
  const canViewInventory = access.hasPermission("inventory.view");
  const canEditInventory = access.hasPermission("inventory.edit", ["owner", "admin"]);

  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', category: '', quantity: '0', minimum_quantity: '0', reserved_quantity: '0', unit: 'pz', location: '', notes: '' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase.from('inventory_items').select('*').eq('team_id', ctx.teamId).order('name');
    setRows(data || []);
  }

  useEffect(() => {
    if (!access.loading && canViewInventory) {
      void load();
    }
  }, [access.loading, canViewInventory]);

  const stats = useMemo(() => [
    { label: 'Articoli', value: String(rows.length), icon: <Package size={18} /> },
    { label: 'Sotto minima', value: String(rows.filter((row) => Number(row.quantity) <= Number(row.minimum_quantity)).length), icon: <Package size={18} /> },
    { label: 'Impegnati', value: String(rows.filter((row) => Number(row.reserved_quantity) > 0).length), icon: <Package size={18} /> },
    { label: 'Categorie', value: String(new Set(rows.map((row) => row.category).filter(Boolean)).size), icon: <Package size={18} /> },
  ], [rows]);

  async function addItem() {
    if (!canEditInventory) return;
    const ctx = await getCurrentTeamContext();
    if (!form.name.trim()) return;
    const payload = {
      team_id: ctx.teamId,
      name: form.name.trim(),
      category: form.category || null,
      quantity: Number(form.quantity || 0),
      minimum_quantity: Number(form.minimum_quantity || 0),
      reserved_quantity: Number(form.reserved_quantity || 0),
      unit: form.unit || 'pz',
      location: form.location || null,
      notes: form.notes || null,
    };
    const { error } = await supabase.from('inventory_items').insert([payload]);
    if (!error) {
      setForm({ name: '', category: '', quantity: '0', minimum_quantity: '0', reserved_quantity: '0', unit: 'pz', location: '', notes: '' });
      await load();
    }
  }

  function exportCsv() {
    const headers = ['name', 'category', 'quantity', 'minimum_quantity', 'reserved_quantity', 'unit', 'location', 'notes'];
    const lines = [headers.join(',')].concat(
      rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(','))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    if (!canEditInventory) return;
    const text = await file.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const ctx = await getCurrentTeamContext();
    const rowsToInsert = lines.map((line) => {
      const values = line.match(/(".*?"|[^,]+)/g) || [];
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = (values[index] || '').replace(/^"|"$/g, '');
      });
      return {
        team_id: ctx.teamId,
        name: record.name || '',
        category: record.category || null,
        quantity: Number(record.quantity || 0),
        minimum_quantity: Number(record.minimum_quantity || 0),
        reserved_quantity: Number(record.reserved_quantity || 0),
        unit: record.unit || 'pz',
        location: record.location || null,
        notes: record.notes || null,
      };
    }).filter((row) => row.name.trim());

    if (!rowsToInsert.length) return;
    const { error } = await supabase.from('inventory_items').insert(rowsToInsert);
    if (!error) await load();
  }

  if (access.loading) {
    return <PagePermissionState title="Magazzino" subtitle="Disponibilità, minimi, riserve e import-export CSV" icon={<Package size={22} />} state="loading" />;
  }
  if (access.error) {
    return <PagePermissionState title="Magazzino" subtitle="Disponibilità, minimi, riserve e import-export CSV" icon={<Package size={22} />} state="error" message={access.error} />;
  }
  if (!canViewInventory) {
    return <PagePermissionState title="Magazzino" subtitle="Disponibilità, minimi, riserve e import-export CSV" icon={<Package size={22} />} state="denied" message="Il tuo ruolo non ha accesso al modulo magazzino." />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Magazzino"
        subtitle="Disponibilità, minimi, riserve e import-export CSV"
        icon={<Package size={22} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEditInventory ? (
              <>
                <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"><Upload size={16} className="mr-2 inline" />Importa CSV</button>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importCsv(file); e.currentTarget.value = ''; }} />
              </>
            ) : null}
            <button onClick={exportCsv} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"><Download size={16} className="mr-2 inline" />Esporta CSV</button>
          </div>
        }
      />
      {!canEditInventory ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Hai accesso in sola lettura a questo modulo.</div> : null}
      <SectionCard><StatsGrid items={stats} /></SectionCard>
      {canEditInventory ? (
        <SectionCard title="Nuovo articolo" subtitle="Inserimento rapido a singola riga">
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
      ) : null}
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
