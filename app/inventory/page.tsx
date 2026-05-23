"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Audiowide } from "next/font/google";
import {
  Download,
  Info,
  Package,
  PlusCircle,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import StatsGrid from "@/components/StatsGrid";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  minimum_quantity: number | null;
  reserved_quantity: number | null;
  unit: string | null;
  location: string | null;
  notes: string | null;
};

type InventoryForm = {
  name: string;
  category: string;
  quantity: string;
  minimum_quantity: string;
  reserved_quantity: string;
  unit: string;
  location: string;
  notes: string;
};

const inputClassName =
  "w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100";

const textareaClassName =
  "min-h-28 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100";

function buildDefaultForm(): InventoryForm {
  return {
    name: "",
    category: "",
    quantity: "0",
    minimum_quantity: "0",
    reserved_quantity: "0",
    unit: "pz",
    location: "",
    notes: "",
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-800">{label}</span>
        {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const access = usePermissionAccess();
  const canViewInventory = access.hasPermission("inventory.view");
  const canEditInventory = access.hasPermission("inventory.edit", ["owner", "admin"]);

  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<InventoryForm>(buildDefaultForm());

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();

      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("name");

      if (error) {
        setFeedback({
          type: "error",
          message: `Impossibile caricare il magazzino: ${error.message}`,
        });
        setRows([]);
        return;
      }

      setRows((data as InventoryItem[] | null) ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewInventory) {
      void load();
    }
  }, [access.loading, canViewInventory]);

  const stats = useMemo(
    () => [
      {
        label: "Articoli",
        value: String(rows.length),
        icon: <Package size={18} />,
        helper: "Totale articoli registrati",
      },
      {
        label: "Sotto minima",
        value: String(
          rows.filter(
            (row) => Number(row.quantity || 0) <= Number(row.minimum_quantity || 0)
          ).length
        ),
        icon: <PlusCircle size={18} />,
        helper: "Articoli da riordinare",
      },
      {
        label: "Impegnati",
        value: String(
          rows.filter((row) => Number(row.reserved_quantity || 0) > 0).length
        ),
        icon: <Upload size={18} />,
        helper: "Materiale già riservato",
      },
      {
        label: "Categorie",
        value: String(new Set(rows.map((row) => row.category).filter(Boolean)).size),
        icon: <Download size={18} />,
        helper: "Categorie merceologiche presenti",
      },
    ],
    [rows]
  );

  async function addItem() {
    if (!canEditInventory) return;

    setFeedback(null);

    if (!form.name.trim()) {
      setFeedback({
        type: "error",
        message: "Inserisci almeno il nome dell'articolo.",
      });
      return;
    }

    const ctx = await getCurrentTeamContext();
    const payload = {
      team_id: ctx.teamId,
      name: form.name.trim(),
      category: form.category.trim() || null,
      quantity: Number(form.quantity || 0),
      minimum_quantity: Number(form.minimum_quantity || 0),
      reserved_quantity: Number(form.reserved_quantity || 0),
      unit: form.unit.trim() || "pz",
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase.from("inventory_items").insert([payload]);

    if (error) {
      setFeedback({
        type: "error",
        message: `Errore inserimento articolo: ${error.message}`,
      });
      return;
    }

    setForm(buildDefaultForm());
    setFeedback({
      type: "success",
      message: "Articolo aggiunto correttamente.",
    });
    await load();
  }

  function exportCsv() {
    const headers = [
      "name",
      "category",
      "quantity",
      "minimum_quantity",
      "reserved_quantity",
      "unit",
      "location",
      "notes",
    ];

    const lines = [headers.join(",")].concat(
      rows.map((row) =>
        headers.map((header) => JSON.stringify((row as Record<string, unknown>)[header] ?? "")).join(",")
      )
    );

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    if (!canEditInventory) return;

    setFeedback(null);

    const text = await file.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);

    if (!headerLine) {
      setFeedback({
        type: "error",
        message: "Il file CSV è vuoto o non valido.",
      });
      return;
    }

    const headers = headerLine
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""));

    const ctx = await getCurrentTeamContext();

    const rowsToInsert = lines
      .map((line) => {
        const values = line.match(/(".*?"|[^,]+)/g) || [];
        const record: Record<string, string> = {};

        headers.forEach((header, index) => {
          record[header] = (values[index] || "").replace(/^"|"$/g, "");
        });

        return {
          team_id: ctx.teamId,
          name: record.name || "",
          category: record.category || null,
          quantity: Number(record.quantity || 0),
          minimum_quantity: Number(record.minimum_quantity || 0),
          reserved_quantity: Number(record.reserved_quantity || 0),
          unit: record.unit || "pz",
          location: record.location || null,
          notes: record.notes || null,
        };
      })
      .filter((row) => row.name.trim());

    if (!rowsToInsert.length) {
      setFeedback({
        type: "info",
        message: "Nessun articolo valido trovato nel CSV importato.",
      });
      return;
    }

    const { error } = await supabase.from("inventory_items").insert(rowsToInsert);

    if (error) {
      setFeedback({
        type: "error",
        message: `Errore importazione CSV: ${error.message}`,
      });
      return;
    }

    setFeedback({
      type: "success",
      message: "Importazione completata correttamente.",
    });
    await load();
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Magazzino"
        subtitle="Gestisci articoli, scorte minime e materiale impegnato"
        icon={<Package size={20} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Magazzino"
        subtitle="Gestisci articoli, scorte minime e materiale impegnato"
        icon={<Package size={20} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewInventory) {
    return (
      <PagePermissionState
        title="Magazzino"
        subtitle="Gestisci articoli, scorte minime e materiale impegnato"
        icon={<Package size={20} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo magazzino."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title="Magazzino"
        subtitle="Controlla disponibilità, soglie minime, materiale impegnato e import/export CSV."
        icon={<Package size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            {canEditInventory ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
                >
                  <Upload size={16} className="mr-2 inline" />
                  Importa CSV
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importCsv(file);
                    e.currentTarget.value = "";
                  }}
                />
              </>
            ) : null}

            <button
              type="button"
              onClick={exportCsv}
              className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
            >
              <Download size={16} className="mr-2 inline" />
              Esporta CSV
            </button>
          </div>
        }
      />

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      {!canEditInventory ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Il magazzino ti aiuta a tenere sotto controllo disponibilità, soglie e materiale già impegnato."
      >
        <InfoBlock>
          Usa il form per registrare nuovi articoli e la tabella per controllare rapidamente le quantità disponibili,
          le scorte minime e il materiale già riservato. Import ed export CSV servono per allineare il magazzino con file esterni
          senza perdere la struttura della webapp.
        </InfoBlock>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {canEditInventory ? (
          <SectionCard
            title="Nuovo articolo"
            subtitle="Inserisci un nuovo materiale, ricambio o consumabile a magazzino."
          >
            <div className="grid grid-cols-1 gap-4">
              <Field label="Nome articolo">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Es. Pastiglie freno anteriori"
                  className={inputClassName}
                />
              </Field>

              <Field label="Categoria">
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Es. Freni"
                  className={inputClassName}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Disponibile">
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className={inputClassName}
                  />
                </Field>

                <Field label="Scorta minima">
                  <input
                    type="number"
                    min="0"
                    value={form.minimum_quantity}
                    onChange={(e) =>
                      setForm({ ...form, minimum_quantity: e.target.value })
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Impegnata">
                  <input
                    type="number"
                    min="0"
                    value={form.reserved_quantity}
                    onChange={(e) =>
                      setForm({ ...form, reserved_quantity: e.target.value })
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Unità">
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="pz"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Posizione">
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Es. Scaffale A3"
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Note">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Annotazioni utili, codici fornitore, lotto, compatibilità..."
                  className={textareaClassName}
                />
              </Field>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                >
                  <PlusCircle size={16} className="mr-2 inline" />
                  Aggiungi articolo
                </button>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Articoli a magazzino"
          subtitle="Consulta disponibilità, soglie minime e materiali impegnati."
          className={canEditInventory ? "" : "xl:col-span-2"}
        >
          {loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
              Caricamento magazzino...
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nessun articolo registrato"
              description="Aggiungi il primo articolo oppure importa un CSV."
            />
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200 bg-white text-sm">
                <thead className="bg-neutral-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Disponibile</th>
                    <th className="px-4 py-3">Minima</th>
                    <th className="px-4 py-3">Impegnata</th>
                    <th className="px-4 py-3">Unità</th>
                    <th className="px-4 py-3">Posizione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((row) => {
                    const lowStock =
                      Number(row.quantity || 0) <= Number(row.minimum_quantity || 0);

                    return (
                      <tr key={row.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-neutral-900">{row.name}</div>
                          {row.notes ? (
                            <div className="mt-1 max-w-md text-xs leading-5 text-neutral-500">
                              {row.notes}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {row.category || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              lowStock
                                ? "font-semibold text-red-600"
                                : "font-semibold text-neutral-900"
                            }
                          >
                            {row.quantity ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {row.minimum_quantity ?? 0}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {row.reserved_quantity ?? 0}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {row.unit || "pz"}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {row.location || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
