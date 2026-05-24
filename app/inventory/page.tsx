"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  Download,
  FileSpreadsheet,
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


type InventoryItem = {
  id: string;
  team_id: string;
  sku: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  supplier_name: string | null;
  supplier_code: string | null;
  manufacturer_code: string | null;
  barcode: string | null;
  quantity: number | null;
  minimum_quantity: number | null;
  reserved_quantity: number | null;
  reorder_quantity: number | null;
  unit: string | null;
  location: string | null;
  unit_cost: number | null;
  currency: string | null;
  notes: string | null;
  updated_at?: string | null;
};

type InventoryForm = {
  sku: string;
  name: string;
  category: string;
  brand: string;
  supplier_name: string;
  supplier_code: string;
  manufacturer_code: string;
  barcode: string;
  quantity: string;
  minimum_quantity: string;
  reserved_quantity: string;
  reorder_quantity: string;
  unit: string;
  location: string;
  unit_cost: string;
  currency: string;
  notes: string;
};

type Feedback = {
  type: "success" | "error" | "info";
  message: string;
};

type ImportRecord = Partial<Record<CanonicalInventoryField, string>>;

type ImportSummary = {
  inserted: number;
  updated: number;
  skipped: number;
  movements: number;
  errors: string[];
};

type CanonicalInventoryField =
  | "sku"
  | "name"
  | "category"
  | "brand"
  | "supplier_name"
  | "supplier_code"
  | "manufacturer_code"
  | "barcode"
  | "quantity"
  | "minimum_quantity"
  | "reserved_quantity"
  | "reorder_quantity"
  | "unit"
  | "location"
  | "unit_cost"
  | "currency"
  | "notes";

const inputClassName =
  "w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-700 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100";

const textareaClassName =
  "min-h-[100px] w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-700 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100";

const templateHeaders: CanonicalInventoryField[] = [
  "sku",
  "name",
  "category",
  "brand",
  "supplier_name",
  "supplier_code",
  "manufacturer_code",
  "barcode",
  "quantity",
  "minimum_quantity",
  "reserved_quantity",
  "reorder_quantity",
  "unit",
  "location",
  "unit_cost",
  "currency",
  "notes",
];

const headerAliases: Record<string, CanonicalInventoryField> = {
  sku: "sku",
  codice: "sku",
  codice_articolo: "sku",
  codiceinterno: "sku",
  codice_interno: "sku",
  articolo_codice: "sku",

  name: "name",
  nome: "name",
  articolo: "name",
  descrizione: "name",
  description: "name",
  item: "name",
  item_name: "name",

  category: "category",
  categoria: "category",
  gruppo: "category",
  family: "category",
  famiglia: "category",

  brand: "brand",
  marca: "brand",
  produttore: "brand",
  manufacturer: "brand",

  supplier_name: "supplier_name",
  supplier: "supplier_name",
  fornitore: "supplier_name",
  nome_fornitore: "supplier_name",

  supplier_code: "supplier_code",
  codice_fornitore: "supplier_code",
  cod_fornitore: "supplier_code",
  supplier_sku: "supplier_code",
  supplier_item_code: "supplier_code",

  manufacturer_code: "manufacturer_code",
  codice_produttore: "manufacturer_code",
  codice_oem: "manufacturer_code",
  oem: "manufacturer_code",
  manufacturer_part_number: "manufacturer_code",
  mpn: "manufacturer_code",

  barcode: "barcode",
  ean: "barcode",
  gtin: "barcode",
  codice_barre: "barcode",
  codice_a_barre: "barcode",

  quantity: "quantity",
  qty: "quantity",
  quantita: "quantity",
  quantità: "quantity",
  disponibile: "quantity",
  stock: "quantity",
  giacenza: "quantity",

  minimum_quantity: "minimum_quantity",
  min_qty: "minimum_quantity",
  quantita_minima: "minimum_quantity",
  quantità_minima: "minimum_quantity",
  scorta_minima: "minimum_quantity",
  minimum_stock: "minimum_quantity",

  reserved_quantity: "reserved_quantity",
  reserved: "reserved_quantity",
  impegnata: "reserved_quantity",
  impegnato: "reserved_quantity",
  riservata: "reserved_quantity",
  riservato: "reserved_quantity",

  reorder_quantity: "reorder_quantity",
  reorder_qty: "reorder_quantity",
  riordino: "reorder_quantity",
  quantita_riordino: "reorder_quantity",
  quantità_riordino: "reorder_quantity",

  unit: "unit",
  unita: "unit",
  unità: "unit",
  uom: "unit",
  um: "unit",
  misura: "unit",

  location: "location",
  posizione: "location",
  ubicazione: "location",
  scaffale: "location",
  magazzino: "location",

  unit_cost: "unit_cost",
  costo: "unit_cost",
  costo_unitario: "unit_cost",
  prezzo: "unit_cost",
  price: "unit_cost",
  unit_price: "unit_cost",

  currency: "currency",
  valuta: "currency",

  notes: "notes",
  note: "notes",
  annotazioni: "notes",
};

function buildDefaultForm(): InventoryForm {
  return {
    sku: "",
    name: "",
    category: "",
    brand: "",
    supplier_name: "",
    supplier_code: "",
    manufacturer_code: "",
    barcode: "",
    quantity: "0",
    minimum_quantity: "0",
    reserved_quantity: "0",
    reorder_quantity: "0",
    unit: "pz",
    location: "",
    unit_cost: "",
    currency: "EUR",
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
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-neutral-700">{label}</label>
      {hint ? <div className="mb-2 text-xs text-neutral-500">{hint}</div> : null}
      {children}
    </div>
  );
}

function InfoBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-600 shadow-sm">
      <div className="mb-2 flex items-center gap-2 font-bold text-neutral-900">
        <Info size={16} />
        Nota import/export
      </div>
      {children}
    </div>
  );
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/[\s\-.\/]+/g, "_")
    .replace(/[()]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canonicalHeader(value: string): CanonicalInventoryField | null {
  const normalized = normalizeHeader(value);
  return headerAliases[normalized] ?? null;
}

function normalizeText(value: string | null | undefined) {
  const clean = (value ?? "").trim();
  return clean.length > 0 ? clean : null;
}

function normalizeCurrency(value: string | null | undefined) {
  return normalizeText(value)?.toUpperCase() || "EUR";
}

function parseNumber(value: string | number | null | undefined, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  const cleaned = raw.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");

  let normalized = cleaned;
  if (commaIndex > -1 && dotIndex > -1) {
    normalized =
      commaIndex > dotIndex
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (commaIndex > -1) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 3,
  }).format(Number(value ?? 0));
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], records: Record<string, unknown>[]) {
  const lines = [headers.join(";")].concat(
    records.map((record) => headers.map((header) => csvEscape(record[header])).join(";"))
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function detectDelimiter(headerLine: string) {
  const delimiters = [";", ",", "\t"];
  return delimiters.reduce((best, delimiter) => {
    const count = headerLine.split(delimiter).length;
    const bestCount = headerLine.split(best).length;
    return count > bestCount ? delimiter : best;
  }, ";");
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { records: [] as ImportRecord[], ignoredHeaders: [] as string[] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const canonicalHeaders = rawHeaders.map(canonicalHeader);
  const ignoredHeaders = rawHeaders.filter((_, index) => !canonicalHeaders[index]);

  const records = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const record: ImportRecord = {};

    canonicalHeaders.forEach((header, index) => {
      if (!header) return;
      record[header] = values[index] ?? "";
    });

    return record;
  });

  return { records, ignoredHeaders };
}

function buildInventoryPayload(form: InventoryForm, teamId: string, quantityOverride?: number) {
  return {
    team_id: teamId,
    sku: normalizeText(form.sku),
    name: form.name.trim(),
    category: normalizeText(form.category),
    brand: normalizeText(form.brand),
    supplier_name: normalizeText(form.supplier_name),
    supplier_code: normalizeText(form.supplier_code),
    manufacturer_code: normalizeText(form.manufacturer_code),
    barcode: normalizeText(form.barcode),
    quantity: quantityOverride ?? Math.max(parseNumber(form.quantity), 0),
    minimum_quantity: Math.max(parseNumber(form.minimum_quantity), 0),
    reserved_quantity: Math.max(parseNumber(form.reserved_quantity), 0),
    reorder_quantity: Math.max(parseNumber(form.reorder_quantity), 0),
    unit: normalizeText(form.unit) || "pz",
    location: normalizeText(form.location),
    unit_cost: form.unit_cost.trim() ? Math.max(parseNumber(form.unit_cost), 0) : null,
    currency: normalizeCurrency(form.currency),
    notes: normalizeText(form.notes),
  };
}

function buildInventoryPayloadFromImport(record: ImportRecord, teamId: string, quantityOverride = 0) {
  return {
    team_id: teamId,
    sku: normalizeText(record.sku),
    name: normalizeText(record.name) || "",
    category: normalizeText(record.category),
    brand: normalizeText(record.brand),
    supplier_name: normalizeText(record.supplier_name),
    supplier_code: normalizeText(record.supplier_code),
    manufacturer_code: normalizeText(record.manufacturer_code),
    barcode: normalizeText(record.barcode),
    quantity: quantityOverride,
    minimum_quantity: Math.max(parseNumber(record.minimum_quantity), 0),
    reserved_quantity: Math.max(parseNumber(record.reserved_quantity), 0),
    reorder_quantity: Math.max(parseNumber(record.reorder_quantity), 0),
    unit: normalizeText(record.unit) || "pz",
    location: normalizeText(record.location),
    unit_cost: record.unit_cost ? Math.max(parseNumber(record.unit_cost), 0) : null,
    currency: normalizeCurrency(record.currency),
    notes: normalizeText(record.notes),
  };
}

function itemMatchesImport(item: InventoryItem, record: ImportRecord) {
  const sku = normalizeText(record.sku)?.toLowerCase();
  const barcode = normalizeText(record.barcode)?.toLowerCase();

  if (sku && item.sku?.toLowerCase() === sku) return true;
  if (barcode && item.barcode?.toLowerCase() === barcode) return true;

  return false;
}

export default function InventoryPage() {
  const access = usePermissionAccess();
  const canViewInventory = access.hasPermission("inventory.view");
  const canEditInventory = access.hasPermission("inventory.edit", ["owner", "admin"]);

  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [form, setForm] = useState<InventoryForm>(buildDefaultForm());
  const [formOpen, setFormOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Errore imprevisto durante il caricamento del magazzino.",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewInventory) {
      void load();
    }
  }, [access.loading, canViewInventory]);

  const stats = useMemo(() => {
    const underMinimum = rows.filter((row) => {
      const available = Number(row.quantity ?? 0) - Number(row.reserved_quantity ?? 0);
      return available <= Number(row.minimum_quantity ?? 0);
    }).length;

    return [
      {
        label: "Articoli",
        value: String(rows.length),
        icon: <Package size={18} />,
        helper: "Totale articoli registrati",
      },
      {
        label: "Sotto minima",
        value: String(underMinimum),
        icon: <Info size={18} />,
        helper: "Disponibilità netta sotto soglia",
      },
      {
        label: "Impegnati",
        value: String(rows.filter((row) => Number(row.reserved_quantity ?? 0) > 0).length),
        icon: <Package size={18} />,
        helper: "Materiale già riservato",
      },
      {
        label: "Categorie",
        value: String(new Set(rows.map((row) => row.category).filter(Boolean)).size),
        icon: <Package size={18} />,
        helper: "Categorie merceologiche presenti",
      },
    ];
  }, [rows]);

  async function createMovement(params: {
    itemId: string;
    quantityDelta: number;
    movementType: "in" | "import" | "correction";
    reason: string;
    unitCost?: number | null;
    currency?: string | null;
    notes?: string | null;
  }) {
    if (params.quantityDelta === 0) return null;

    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.rpc("create_inventory_movement", {
      p_team_id: ctx.teamId,
      p_inventory_item_id: params.itemId,
      p_movement_type: params.movementType,
      p_quantity_delta: params.quantityDelta,
      p_reason: params.reason,
      p_reference_type: null,
      p_reference_id: null,
      p_unit_cost: params.unitCost ?? null,
      p_currency: params.currency || "EUR",
      p_created_by_team_user_id: ctx.teamUserId,
      p_notes: params.notes ?? null,
    });

    if (error) throw error;
    return true;
  }

  async function addItem() {
    if (!canEditInventory || saving) return;
    setFeedback(null);

    if (!form.name.trim()) {
      setFeedback({ type: "error", message: "Inserisci almeno il nome dell'articolo." });
      return;
    }

    setSaving(true);

    try {
      const ctx = await getCurrentTeamContext();
      const initialQuantity = Math.max(parseNumber(form.quantity), 0);
      const payload = buildInventoryPayload(form, ctx.teamId, 0);

      const { data, error } = await supabase
        .from("inventory_items")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      const itemId = (data as { id: string } | null)?.id;
      if (!itemId) throw new Error("Articolo creato ma ID non restituito.");

      if (initialQuantity > 0) {
        await createMovement({
          itemId,
          quantityDelta: initialQuantity,
          movementType: "in",
          reason: "Carico iniziale da inserimento manuale",
          unitCost: payload.unit_cost,
          currency: payload.currency,
          notes: payload.notes,
        });
      }

      setForm(buildDefaultForm());
      setFormOpen(false);
      setFeedback({ type: "success", message: "Articolo aggiunto correttamente." });
      await load();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Errore inserimento articolo: ${error.message}`
            : "Errore inserimento articolo.",
      });
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const records = rows.map((row) => ({
      sku: row.sku ?? "",
      name: row.name,
      category: row.category ?? "",
      brand: row.brand ?? "",
      supplier_name: row.supplier_name ?? "",
      supplier_code: row.supplier_code ?? "",
      manufacturer_code: row.manufacturer_code ?? "",
      barcode: row.barcode ?? "",
      quantity: row.quantity ?? 0,
      minimum_quantity: row.minimum_quantity ?? 0,
      reserved_quantity: row.reserved_quantity ?? 0,
      reorder_quantity: row.reorder_quantity ?? 0,
      unit: row.unit ?? "pz",
      location: row.location ?? "",
      unit_cost: row.unit_cost ?? "",
      currency: row.currency ?? "EUR",
      notes: row.notes ?? "",
    }));

    downloadCsv("inventory_items_export.csv", templateHeaders, records);
  }

  function downloadTemplate() {
    downloadCsv("inventory_import_template.csv", templateHeaders, [
      {
        sku: "BRK-PAD-FR-001",
        name: "Pastiglie freno anteriori",
        category: "Freni",
        brand: "Esempio Brand",
        supplier_name: "Fornitore Spa",
        supplier_code: "FORN-123",
        manufacturer_code: "OEM-456",
        barcode: "8050000000000",
        quantity: "10",
        minimum_quantity: "2",
        reserved_quantity: "0",
        reorder_quantity: "4",
        unit: "pz",
        location: "Scaffale A3",
        unit_cost: "85,00",
        currency: "EUR",
        notes: "Riga esempio: puoi eliminarla prima dell'import.",
      },
    ]);
  }

  async function findExistingItem(record: ImportRecord, teamId: string) {
    const sku = normalizeText(record.sku);
    const barcode = normalizeText(record.barcode);

    if (sku) {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("team_id", teamId)
        .eq("sku", sku)
        .maybeSingle();

      if (error) throw error;
      if (data) return data as InventoryItem;
    }

    if (barcode) {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("team_id", teamId)
        .eq("barcode", barcode)
        .maybeSingle();

      if (error) throw error;
      if (data) return data as InventoryItem;
    }

    return rows.find((item) => itemMatchesImport(item, record)) ?? null;
  }

  async function importCsv(file: File) {
    if (!canEditInventory || importing) return;
    setFeedback(null);
    setImporting(true);

    const summary: ImportSummary = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      movements: 0,
      errors: [],
    };

    try {
      const text = await file.text();
      const { records, ignoredHeaders } = parseCsv(text);

      if (!records.length) {
        setFeedback({ type: "error", message: "Il file CSV è vuoto o non valido." });
        return;
      }

      const ctx = await getCurrentTeamContext();

      for (const [index, record] of records.entries()) {
        const rowNumber = index + 2;
        const name = normalizeText(record.name);

        if (!name) {
          summary.skipped += 1;
          summary.errors.push(`Riga ${rowNumber}: manca il nome articolo.`);
          continue;
        }

        const importedQuantity = Math.max(parseNumber(record.quantity), 0);
        const payload = buildInventoryPayloadFromImport(record, ctx.teamId, 0);
        payload.name = name;

        try {
          const existing = await findExistingItem(record, ctx.teamId);

          if (existing) {
            const currentQuantity = Number(existing.quantity ?? 0);
            const quantityDelta = importedQuantity - currentQuantity;

            const { error } = await supabase
              .from("inventory_items")
              .update({
                sku: payload.sku,
                name: payload.name,
                category: payload.category,
                brand: payload.brand,
                supplier_name: payload.supplier_name,
                supplier_code: payload.supplier_code,
                manufacturer_code: payload.manufacturer_code,
                barcode: payload.barcode,
                minimum_quantity: payload.minimum_quantity,
                reserved_quantity: payload.reserved_quantity,
                reorder_quantity: payload.reorder_quantity,
                unit: payload.unit,
                location: payload.location,
                unit_cost: payload.unit_cost,
                currency: payload.currency,
                notes: payload.notes,
              })
              .eq("team_id", ctx.teamId)
              .eq("id", existing.id);

            if (error) throw error;

            if (quantityDelta !== 0) {
              await createMovement({
                itemId: existing.id,
                quantityDelta,
                movementType: "correction",
                reason: "Rettifica quantità da import CSV",
                unitCost: payload.unit_cost,
                currency: payload.currency,
                notes: `Import file ${file.name}`,
              });
              summary.movements += 1;
            }

            summary.updated += 1;
          } else {
            const { data, error } = await supabase
              .from("inventory_items")
              .insert([payload])
              .select("id")
              .single();

            if (error) throw error;

            const itemId = (data as { id: string } | null)?.id;
            if (!itemId) throw new Error("ID articolo non restituito.");

            if (importedQuantity > 0) {
              await createMovement({
                itemId,
                quantityDelta: importedQuantity,
                movementType: "import",
                reason: "Carico iniziale da import CSV",
                unitCost: payload.unit_cost,
                currency: payload.currency,
                notes: `Import file ${file.name}`,
              });
              summary.movements += 1;
            }

            summary.inserted += 1;
          }
        } catch (error) {
          summary.skipped += 1;
          summary.errors.push(
            `Riga ${rowNumber}: ${error instanceof Error ? error.message : "errore importazione"}`
          );
        }
      }

      const ignoredCopy = ignoredHeaders.length
        ? ` Colonne ignorate: ${ignoredHeaders.join(", ")}.`
        : "";
      const errorsCopy = summary.errors.length
        ? ` Errori: ${summary.errors.slice(0, 5).join(" | ")}${
            summary.errors.length > 5 ? " ..." : ""
          }`
        : "";

      setFeedback({
        type: summary.errors.length ? "info" : "success",
        message: `Import completato. Creati: ${summary.inserted}. Aggiornati: ${summary.updated}. Saltati: ${summary.skipped}. Movimenti: ${summary.movements}.${ignoredCopy}${errorsCopy}`,
      });

      await load();
    } finally {
      setImporting(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void importCsv(file);
    event.currentTarget.value = "";
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Magazzino"
        subtitle="Articoli, scorte e import/export"
        icon={<Package size={28} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Magazzino"
        subtitle="Articoli, scorte e import/export"
        icon={<Package size={28} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewInventory) {
    return (
      <PagePermissionState
        title="Magazzino"
        subtitle="Articoli, scorte e import/export"
        icon={<Package size={28} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo magazzino."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Magazzino"
        subtitle="Anagrafica articoli, scorte minime, import/export e base movimenti."
        icon={<Package size={28} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEditInventory ? (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-500"
              >
                <PlusCircle size={16} className="mr-2 inline" />
                Nuovo articolo
              </button>
            ) : null}
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-200"
            >
              <FileSpreadsheet size={16} className="mr-2 inline" />
              Template CSV
            </button>
            {canEditInventory ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload size={16} className="mr-2 inline" />
                  {importing ? "Import..." : "Importa CSV"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800"
            >
              <Download size={16} className="mr-2 inline" />
              Esporta CSV
            </button>
          </div>
        }
      />

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      {!canEditInventory ? (
        <FormStatusBanner type="info" message="Hai accesso in sola lettura a questo modulo." />
      ) : null}

      <StatsGrid items={stats} />

      <InfoBlock>
        Il magazzino è pronto per un caricamento iniziale pulito: puoi usare il template CSV oppure
        importare file con intestazioni comuni italiane/inglesi. Il sistema riconosce separatori con
        virgola, punto e virgola e numeri europei con decimali a virgola.
      </InfoBlock>

      <SectionCard
        title="Articoli a magazzino"
        subtitle="Consulta disponibilità, soglie minime, codici e materiali impegnati."
      >
        {loading ? (
          <div className="text-neutral-500">Caricamento magazzino...</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nessun articolo registrato"
            description="Aggiungi il primo articolo oppure scarica il template e importa un CSV iniziale."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {canEditInventory ? (
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-500"
                  >
                    Aggiungi articolo
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-200"
                >
                  Scarica template CSV
                </button>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 bg-white text-sm">
              <thead className="bg-neutral-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Articolo</th>
                  <th className="px-4 py-3">Codici</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Disponibile</th>
                  <th className="px-4 py-3">Minima</th>
                  <th className="px-4 py-3">Impegnata</th>
                  <th className="px-4 py-3">Unità</th>
                  <th className="px-4 py-3">Posizione</th>
                  <th className="px-4 py-3">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((row) => {
                  const quantity = Number(row.quantity ?? 0);
                  const reserved = Number(row.reserved_quantity ?? 0);
                  const available = Math.max(quantity - reserved, 0);
                  const minimum = Number(row.minimum_quantity ?? 0);
                  const lowStock = available <= minimum;

                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-neutral-900">{row.name}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {[row.brand, row.supplier_name].filter(Boolean).join(" · ") || "—"}
                        </div>
                        {row.notes ? (
                          <div className="mt-1 max-w-md text-xs leading-5 text-neutral-500">
                            {row.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs leading-5 text-neutral-600">
                        <div>SKU: {row.sku || "—"}</div>
                        <div>Forn.: {row.supplier_code || "—"}</div>
                        <div>OEM: {row.manufacturer_code || "—"}</div>
                        <div>EAN: {row.barcode || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{row.category || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            lowStock
                              ? "font-semibold text-red-600"
                              : "font-semibold text-neutral-900"
                          }
                        >
                          {formatNumber(available)}
                        </span>
                        {available !== quantity ? (
                          <div className="mt-1 text-xs text-neutral-500">
                            Giacenza: {formatNumber(quantity)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{formatNumber(minimum)}</td>
                      <td className="px-4 py-3 text-neutral-700">{formatNumber(reserved)}</td>
                      <td className="px-4 py-3 text-neutral-700">{row.unit || "pz"}</td>
                      <td className="px-4 py-3 text-neutral-700">{row.location || "—"}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {row.unit_cost !== null && row.unit_cost !== undefined
                          ? `${formatNumber(row.unit_cost)} ${row.currency || "EUR"}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Nuovo articolo</h3>
                <div className="mt-1 text-sm text-neutral-500">
                  Inserisci anagrafica, codici standard e quantità iniziale.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl bg-neutral-100 px-3 py-2 font-semibold text-neutral-800 hover:bg-neutral-200"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Codice interno / SKU" hint="Consigliato per import/export e aggiornamenti futuri.">
                <input
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                  placeholder="Es. BRK-PAD-FR-001"
                  className={inputClassName}
                />
              </Field>

              <Field label="Nome articolo">
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Es. Pastiglie freno anteriori"
                  className={inputClassName}
                />
              </Field>

              <Field label="Categoria">
                <input
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  placeholder="Es. Freni"
                  className={inputClassName}
                />
              </Field>

              <Field label="Marca">
                <input
                  value={form.brand}
                  onChange={(event) => setForm({ ...form, brand: event.target.value })}
                  placeholder="Es. Brembo"
                  className={inputClassName}
                />
              </Field>

              <Field label="Fornitore">
                <input
                  value={form.supplier_name}
                  onChange={(event) => setForm({ ...form, supplier_name: event.target.value })}
                  placeholder="Es. Fornitore Spa"
                  className={inputClassName}
                />
              </Field>

              <Field label="Codice fornitore">
                <input
                  value={form.supplier_code}
                  onChange={(event) => setForm({ ...form, supplier_code: event.target.value })}
                  placeholder="Es. FORN-123"
                  className={inputClassName}
                />
              </Field>

              <Field label="Codice produttore / OEM">
                <input
                  value={form.manufacturer_code}
                  onChange={(event) => setForm({ ...form, manufacturer_code: event.target.value })}
                  placeholder="Es. OEM-456"
                  className={inputClassName}
                />
              </Field>

              <Field label="Barcode / EAN">
                <input
                  value={form.barcode}
                  onChange={(event) => setForm({ ...form, barcode: event.target.value })}
                  placeholder="Es. 8050000000000"
                  className={inputClassName}
                />
              </Field>

              <Field label="Quantità iniziale">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                  className={inputClassName}
                />
              </Field>

              <Field label="Scorta minima">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.minimum_quantity}
                  onChange={(event) => setForm({ ...form, minimum_quantity: event.target.value })}
                  className={inputClassName}
                />
              </Field>

              <Field label="Impegnata / riservata">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.reserved_quantity}
                  onChange={(event) => setForm({ ...form, reserved_quantity: event.target.value })}
                  className={inputClassName}
                />
              </Field>

              <Field label="Quantità riordino">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.reorder_quantity}
                  onChange={(event) => setForm({ ...form, reorder_quantity: event.target.value })}
                  className={inputClassName}
                />
              </Field>

              <Field label="Unità di misura">
                <input
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  placeholder="pz"
                  className={inputClassName}
                />
              </Field>

              <Field label="Posizione">
                <input
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="Es. Scaffale A3"
                  className={inputClassName}
                />
              </Field>

              <Field label="Costo unitario">
                <input
                  value={form.unit_cost}
                  onChange={(event) => setForm({ ...form, unit_cost: event.target.value })}
                  placeholder="Es. 85,00"
                  className={inputClassName}
                />
              </Field>

              <Field label="Valuta">
                <input
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                  placeholder="EUR"
                  className={inputClassName}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Note">
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Annotazioni utili, lotto, compatibilità, note fornitore..."
                    className={textareaClassName}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-200"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={addItem}
                disabled={saving}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlusCircle size={16} className="mr-2 inline" />
                {saving ? "Salvataggio..." : "Aggiungi articolo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
