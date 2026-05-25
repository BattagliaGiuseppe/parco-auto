"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  ImageIcon,
  Info,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  PlusCircle,
  RefreshCw,
  Settings2,
  Trash2,
  Upload,
  XCircle,
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
  image_path: string | null;
  image_updated_at?: string | null;
  updated_at?: string | null;
};

type InventoryMovementType =
  | "in"
  | "out"
  | "adjustment"
  | "reserve"
  | "release_reserve"
  | "consume"
  | "return"
  | "import"
  | "correction";

type InventoryMovement = {
  id: string;
  team_id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity_delta: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  unit_cost: number | null;
  currency: string | null;
  created_by_team_user_id: string | null;
  created_at: string;
  notes: string | null;
};

type MovementForm = {
  itemId: string;
  itemName: string;
  movementType: InventoryMovementType;
  quantity: string;
  reason: string;
  notes: string;
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

type ImportMappingValue = CanonicalInventoryField | "ignore";

type ImportWizardState = {
  fileName: string;
  headers: string[];
  rows: string[][];
  delimiter: string;
  mapping: Record<number, ImportMappingValue>;
};

type ImportValidationResult = {
  records: ImportRecord[];
  validRows: number;
  errorRows: number;
  warningRows: number;
  errors: string[];
  warnings: string[];
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

type InventoryTableColumnKey =
  | "photo"
  | "article"
  | "codes"
  | "category"
  | "available"
  | "minimum"
  | "reserved"
  | "unit"
  | "location"
  | "cost"
  | "actions";

type ImportProgress = {
  total: number;
  done: number;
  inserted: number;
  updated: number;
  skipped: number;
  movements: number;
  current: string;
};

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

const defaultTableColumnOrder: InventoryTableColumnKey[] = [
  "photo",
  "article",
  "codes",
  "category",
  "available",
  "minimum",
  "reserved",
  "unit",
  "location",
  "cost",
  "actions",
];

const tableColumnLabels: Record<InventoryTableColumnKey, string> = {
  photo: "Foto",
  article: "Articolo",
  codes: "Codici",
  category: "Categoria",
  available: "Disponibile",
  minimum: "Minima",
  reserved: "Impegnata",
  unit: "Unità",
  location: "Posizione",
  cost: "Costo",
  actions: "Azioni",
};

const tableColumnStorageKey = "inventory.tableColumnOrder.v1";
const inventoryImageBucket = "inventory-images";
const maxInventoryImageBytes = 5 * 1024 * 1024;

const importFieldOptions: { value: ImportMappingValue; label: string; required?: boolean }[] = [
  { value: "ignore", label: "Ignora colonna" },
  { value: "sku", label: "SKU / codice interno" },
  { value: "name", label: "Nome articolo", required: true },
  { value: "category", label: "Categoria" },
  { value: "brand", label: "Marca" },
  { value: "supplier_name", label: "Fornitore" },
  { value: "supplier_code", label: "Codice fornitore" },
  { value: "manufacturer_code", label: "Codice produttore / OEM" },
  { value: "barcode", label: "Barcode / EAN" },
  { value: "quantity", label: "Quantità disponibile" },
  { value: "minimum_quantity", label: "Scorta minima" },
  { value: "reserved_quantity", label: "Quantità impegnata" },
  { value: "reorder_quantity", label: "Quantità riordino" },
  { value: "unit", label: "Unità di misura" },
  { value: "location", label: "Posizione / ubicazione" },
  { value: "unit_cost", label: "Costo unitario" },
  { value: "currency", label: "Valuta" },
  { value: "notes", label: "Note" },
];

const numericImportFields = new Set<CanonicalInventoryField>([
  "quantity",
  "minimum_quantity",
  "reserved_quantity",
  "reorder_quantity",
  "unit_cost",
]);

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

function buildFormFromItem(item: InventoryItem): InventoryForm {
  return {
    sku: item.sku ?? "",
    name: item.name ?? "",
    category: item.category ?? "",
    brand: item.brand ?? "",
    supplier_name: item.supplier_name ?? "",
    supplier_code: item.supplier_code ?? "",
    manufacturer_code: item.manufacturer_code ?? "",
    barcode: item.barcode ?? "",
    quantity: String(item.quantity ?? 0),
    minimum_quantity: String(item.minimum_quantity ?? 0),
    reserved_quantity: String(item.reserved_quantity ?? 0),
    reorder_quantity: String(item.reorder_quantity ?? 0),
    unit: item.unit ?? "pz",
    location: item.location ?? "",
    unit_cost: item.unit_cost === null || item.unit_cost === undefined ? "" : String(item.unit_cost),
    currency: item.currency ?? "EUR",
    notes: item.notes ?? "",
  };
}

function buildDefaultMovementForm(item: InventoryItem, movementType: InventoryMovementType): MovementForm {
  const defaultReasonByType: Record<InventoryMovementType, string> = {
    in: "Carico manuale",
    out: "Scarico manuale",
    adjustment: "Rettifica inventario",
    reserve: "Materiale impegnato",
    release_reserve: "Rilascio materiale impegnato",
    consume: "Utilizzo materiale",
    return: "Reso a magazzino",
    import: "Import",
    correction: "Correzione",
  };

  return {
    itemId: item.id,
    itemName: item.name,
    movementType,
    quantity: movementType === "adjustment" ? String(item.quantity ?? 0) : "",
    reason: defaultReasonByType[movementType],
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
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMovementTypeLabel(type: InventoryMovementType) {
  const labels: Record<InventoryMovementType, string> = {
    in: "Carico",
    out: "Scarico",
    adjustment: "Rettifica",
    reserve: "Impegno",
    release_reserve: "Rilascio impegno",
    consume: "Utilizzo",
    return: "Reso",
    import: "Import",
    correction: "Correzione",
  };

  return labels[type] ?? type;
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

function parseCsvForWizard(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header) =>
    header.trim().replace(/^\ufeff/, "")
  );

  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));
  return { headers, rows, delimiter };
}

function detectImportMapping(headers: string[]) {
  return headers.reduce<Record<number, ImportMappingValue>>((mapping, header, index) => {
    const detected = canonicalHeader(header);
    mapping[index] = detected ?? "ignore";
    return mapping;
  }, {});
}

function buildRecordsFromMapping(
  rows: string[][],
  mapping: Record<number, ImportMappingValue>
) {
  return rows
    .map((row) => {
      const record: ImportRecord = {};

      Object.entries(mapping).forEach(([indexValue, field]) => {
        if (field === "ignore") return;
        const index = Number(indexValue);
        record[field] = row[index] ?? "";
      });

      return record;
    })
    .filter((record) => Object.values(record).some((value) => normalizeText(value)));
}

function hasValidNumberFormat(value: string | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return true;

  const cleaned = raw.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "," || cleaned === "." || cleaned === "-" || cleaned === "-") {
    return false;
  }

  return Number.isFinite(parseNumber(raw, Number.NaN));
}

function validateImportRecords(records: ImportRecord[]): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const skuCounter = new Map<string, number[]>();
  const barcodeCounter = new Map<string, number[]>();
  let errorRows = 0;
  let warningRows = 0;

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    let rowHasError = false;
    let rowHasWarning = false;

    if (!normalizeText(record.name)) {
      errors.push(`Riga ${rowNumber}: manca il nome articolo.`);
      rowHasError = true;
    }

    numericImportFields.forEach((field) => {
      if (!hasValidNumberFormat(record[field])) {
        errors.push(`Riga ${rowNumber}: il campo ${field} non è numerico.`);
        rowHasError = true;
      }
    });

    const sku = normalizeText(record.sku)?.toLowerCase();
    const barcode = normalizeText(record.barcode)?.toLowerCase();

    if (sku) {
      skuCounter.set(sku, [...(skuCounter.get(sku) ?? []), rowNumber]);
    }

    if (barcode) {
      barcodeCounter.set(barcode, [...(barcodeCounter.get(barcode) ?? []), rowNumber]);
    }

    if (!normalizeText(record.sku) && !normalizeText(record.barcode)) {
      warnings.push(`Riga ${rowNumber}: nessuno SKU/barcode, non potrà aggiornare articoli esistenti.`);
      rowHasWarning = true;
    }

    if (rowHasError) errorRows += 1;
    else if (rowHasWarning) warningRows += 1;
  });

  skuCounter.forEach((rows, sku) => {
    if (rows.length > 1) {
      errors.push(`SKU duplicato nel file (${sku}) alle righe ${rows.join(", ")}.`);
      errorRows += rows.length;
    }
  });

  barcodeCounter.forEach((rows, barcode) => {
    if (rows.length > 1) {
      errors.push(`Barcode duplicato nel file (${barcode}) alle righe ${rows.join(", ")}.`);
      errorRows += rows.length;
    }
  });

  return {
    records,
    validRows: Math.max(records.length - errorRows, 0),
    errorRows,
    warningRows,
    errors,
    warnings,
  };
}

function getImportFieldLabel(field: ImportMappingValue) {
  return importFieldOptions.find((option) => option.value === field)?.label ?? field;
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

function buildInventoryUpdatePayload(form: InventoryForm) {
  return {
    sku: normalizeText(form.sku),
    name: form.name.trim(),
    category: normalizeText(form.category),
    brand: normalizeText(form.brand),
    supplier_name: normalizeText(form.supplier_name),
    supplier_code: normalizeText(form.supplier_code),
    manufacturer_code: normalizeText(form.manufacturer_code),
    barcode: normalizeText(form.barcode),
    minimum_quantity: Math.max(parseNumber(form.minimum_quantity), 0),
    reorder_quantity: Math.max(parseNumber(form.reorder_quantity), 0),
    unit: normalizeText(form.unit) || "pz",
    location: normalizeText(form.location),
    unit_cost: form.unit_cost.trim() ? Math.max(parseNumber(form.unit_cost), 0) : null,
    currency: normalizeCurrency(form.currency),
    notes: normalizeText(form.notes),
    updated_at: new Date().toISOString(),
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


function getInventoryImageUrl(imagePath: string | null | undefined) {
  if (!imagePath) return null;
  const { data } = supabase.storage.from(inventoryImageBucket).getPublicUrl(imagePath);
  return data.publicUrl || null;
}

function sanitizeFileName(filename: string) {
  const parts = filename.split(".");
  const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : "jpg";
  const base = parts
    .join(".")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${base || "foto-articolo"}.${extension || "jpg"}`;
}

function validateInventoryImageFile(file: File) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return "Formato foto non supportato. Usa JPG, PNG, WEBP o GIF.";
  }

  if (file.size > maxInventoryImageBytes) {
    return "La foto è troppo grande. Dimensione massima: 5 MB.";
  }

  return null;
}

function formatSupabaseImportError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const err = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof err.message === "string" ? err.message : null,
      typeof err.details === "string" ? `Dettagli: ${err.details}` : null,
      typeof err.hint === "string" ? `Suggerimento: ${err.hint}` : null,
      typeof err.code === "string" ? `Codice: ${err.code}` : null,
    ].filter(Boolean);

    if (parts.length) return parts.join(" | ");

    try {
      return JSON.stringify(error);
    } catch {
      return "errore importazione non leggibile";
    }
  }

  return String(error || "errore importazione");
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
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [movementForm, setMovementForm] = useState<MovementForm | null>(null);
  const [movementSaving, setMovementSaving] = useState(false);
  const [movementHistoryItem, setMovementHistoryItem] = useState<InventoryItem | null>(null);
  const [movementHistory, setMovementHistory] = useState<InventoryMovement[]>([]);
  const [movementHistoryLoading, setMovementHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "reserved" | "withPhoto" | "withoutPhoto">("all");
  const [importWizard, setImportWizard] = useState<ImportWizardState | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [imageUploadingId, setImageUploadingId] = useState<string | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<InventoryTableColumnKey[]>([
    ...defaultTableColumnOrder,
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load(options?: { keepFeedback?: boolean }) {
    setLoading(true);
    if (!options?.keepFeedback) setFeedback(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(tableColumnStorageKey);
      if (!saved) return;

      const parsed = JSON.parse(saved) as InventoryTableColumnKey[];
      const filtered = parsed.filter((key): key is InventoryTableColumnKey =>
        defaultTableColumnOrder.includes(key as InventoryTableColumnKey)
      );
      const missing = defaultTableColumnOrder.filter((key) => !filtered.includes(key));

      if (filtered.length) {
        setColumnOrder([...filtered, ...missing]);
      }
    } catch {
      setColumnOrder([...defaultTableColumnOrder]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(tableColumnStorageKey, JSON.stringify(columnOrder));
  }, [columnOrder]);


  useEffect(() => {
    if (!formImageFile) {
      setFormImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(formImageFile);
    setFormImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [formImageFile]);

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

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const quantity = Number(row.quantity ?? 0);
      const reserved = Number(row.reserved_quantity ?? 0);
      const available = Math.max(quantity - reserved, 0);
      const minimum = Number(row.minimum_quantity ?? 0);

      if (stockFilter === "low" && available > minimum) return false;
      if (stockFilter === "reserved" && reserved <= 0) return false;
      if (stockFilter === "withPhoto" && !row.image_path) return false;
      if (stockFilter === "withoutPhoto" && row.image_path) return false;

      if (!query) return true;

      const searchable = [
        row.name,
        row.sku,
        row.category,
        row.brand,
        row.supplier_name,
        row.supplier_code,
        row.manufacturer_code,
        row.barcode,
        row.location,
        row.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [rows, search, stockFilter]);

  const importValidation = useMemo(() => {
    if (!importWizard) return null;
    const records = buildRecordsFromMapping(importWizard.rows, importWizard.mapping);
    return validateImportRecords(records);
  }, [importWizard]);

  const mappedFields = useMemo(() => {
    if (!importWizard) return [] as ImportMappingValue[];
    return Object.values(importWizard.mapping).filter((field) => field !== "ignore");
  }, [importWizard]);

  function openNewItemForm() {
    setEditId(null);
    setForm(buildDefaultForm());
    setFormImageFile(null);
    setFormOpen(true);
  }

  function openEditItemForm(row: InventoryItem) {
    setEditId(row.id);
    setForm(buildFormFromItem(row));
    setFormImageFile(null);
    setFormOpen(true);
  }

  function closeItemForm() {
    setEditId(null);
    setForm(buildDefaultForm());
    setFormImageFile(null);
    setFormOpen(false);
  }

  function openMovementForm(row: InventoryItem, movementType: InventoryMovementType) {
    setMovementForm(buildDefaultMovementForm(row, movementType));
  }

  function closeMovementForm() {
    setMovementForm(null);
  }

  async function openMovementHistory(row: InventoryItem) {
    setMovementHistoryItem(row);
    setMovementHistory([]);
    setMovementHistoryLoading(true);

    try {
      const ctx = await getCurrentTeamContext();
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("inventory_item_id", row.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setMovementHistory((data as InventoryMovement[] | null) ?? []);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Errore caricamento storico movimenti: ${error.message}`
            : "Errore caricamento storico movimenti.",
      });
    } finally {
      setMovementHistoryLoading(false);
    }
  }

  function handleFormImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    const validationError = validateInventoryImageFile(file);
    if (validationError) {
      setFeedback({ type: "error", message: validationError });
      return;
    }

    setFormImageFile(file);
  }

  function clearFormImage() {
    setFormImageFile(null);
  }

  async function uploadInventoryImage(params: {
    itemId: string;
    teamId: string;
    file: File;
    previousImagePath?: string | null;
  }) {
    const validationError = validateInventoryImageFile(params.file);
    if (validationError) throw new Error(validationError);

    const path = `${params.teamId}/${params.itemId}/${Date.now()}-${sanitizeFileName(params.file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(inventoryImageBucket)
      .upload(path, params.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: params.file.type,
      });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ image_path: path, image_updated_at: new Date().toISOString() })
      .eq("team_id", params.teamId)
      .eq("id", params.itemId);

    if (updateError) {
      await supabase.storage.from(inventoryImageBucket).remove([path]);
      throw updateError;
    }

    if (params.previousImagePath && params.previousImagePath !== path) {
      const { error: removeOldError } = await supabase.storage
        .from(inventoryImageBucket)
        .remove([params.previousImagePath]);

      if (removeOldError) {
        console.warn("Vecchia foto non rimossa:", removeOldError.message);
      }
    }

    return path;
  }

  async function handleRowImageChange(row: InventoryItem, file: File) {
    if (!canEditInventory || imageUploadingId) return;

    setFeedback(null);
    setImageUploadingId(row.id);

    try {
      await uploadInventoryImage({
        itemId: row.id,
        teamId: row.team_id,
        file,
        previousImagePath: row.image_path,
      });

      await load({ keepFeedback: true });
      setFeedback({ type: "success", message: `Foto aggiornata per ${row.name}.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Errore caricamento foto: ${error.message}`
            : "Errore caricamento foto.",
      });
    } finally {
      setImageUploadingId(null);
    }
  }

  async function removeInventoryImage(row: InventoryItem) {
    if (!canEditInventory || imageUploadingId || !row.image_path) return;

    setFeedback(null);
    setImageUploadingId(row.id);

    try {
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ image_path: null, image_updated_at: new Date().toISOString() })
        .eq("team_id", row.team_id)
        .eq("id", row.id);

      if (updateError) throw updateError;

      const { error: removeError } = await supabase.storage
        .from(inventoryImageBucket)
        .remove([row.image_path]);

      if (removeError) {
        console.warn("Foto non rimossa dallo storage:", removeError.message);
      }

      await load({ keepFeedback: true });
      setFeedback({ type: "success", message: `Foto rimossa da ${row.name}.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? `Errore rimozione foto: ${error.message}` : "Errore rimozione foto.",
      });
    } finally {
      setImageUploadingId(null);
    }
  }

  async function createMovement(params: {
    itemId: string;
    quantityDelta: number;
    movementType: InventoryMovementType;
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

      if (formImageFile) {
        await uploadInventoryImage({
          itemId,
          teamId: ctx.teamId,
          file: formImageFile,
        });
      }

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
      setFormImageFile(null);
      setFormOpen(false);
      await load({ keepFeedback: true });
      setFeedback({ type: "success", message: "Articolo aggiunto correttamente." });
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


  async function updateItem() {
    if (!canEditInventory || saving || !editId) return;
    setFeedback(null);

    if (!form.name.trim()) {
      setFeedback({ type: "error", message: "Inserisci almeno il nome dell'articolo." });
      return;
    }

    setSaving(true);

    try {
      const ctx = await getCurrentTeamContext();
      const payload = buildInventoryUpdatePayload(form);
      const currentItem = rows.find((row) => row.id === editId);

      const { error } = await supabase
        .from("inventory_items")
        .update(payload)
        .eq("team_id", ctx.teamId)
        .eq("id", editId);

      if (error) throw error;

      if (formImageFile) {
        await uploadInventoryImage({
          itemId: editId,
          teamId: ctx.teamId,
          file: formImageFile,
          previousImagePath: currentItem?.image_path,
        });
      }

      closeItemForm();
      await load({ keepFeedback: true });
      setFeedback({ type: "success", message: "Articolo aggiornato correttamente." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Errore aggiornamento articolo: ${error.message}`
            : "Errore aggiornamento articolo.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveItem() {
    if (editId) {
      await updateItem();
      return;
    }

    await addItem();
  }

  async function confirmMovement() {
    if (!canEditInventory || movementSaving || !movementForm) return;
    setFeedback(null);

    const item = rows.find((row) => row.id === movementForm.itemId);
    if (!item) {
      setFeedback({ type: "error", message: "Articolo non trovato." });
      return;
    }

    const parsedQuantity = parseNumber(movementForm.quantity, Number.NaN);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFeedback({ type: "error", message: "Inserisci una quantità valida maggiore di zero." });
      return;
    }

    let quantityDelta = parsedQuantity;
    if (movementForm.movementType === "adjustment") {
      quantityDelta = parsedQuantity - Number(item.quantity ?? 0);
      if (quantityDelta === 0) {
        setFeedback({ type: "info", message: "La quantità finale è uguale alla giacenza attuale: nessuna rettifica necessaria." });
        return;
      }
    }

    setMovementSaving(true);

    try {
      await createMovement({
        itemId: movementForm.itemId,
        quantityDelta,
        movementType: movementForm.movementType,
        reason: movementForm.reason.trim() || getMovementTypeLabel(movementForm.movementType),
        unitCost: item.unit_cost,
        currency: item.currency,
        notes: movementForm.notes.trim() || null,
      });

      closeMovementForm();
      await load({ keepFeedback: true });
      setFeedback({
        type: "success",
        message: `${getMovementTypeLabel(movementForm.movementType)} registrato correttamente per ${item.name}.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Errore movimento magazzino: ${error.message}`
            : "Errore movimento magazzino.",
      });
    } finally {
      setMovementSaving(false);
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

  async function importMappedRecords(records: ImportRecord[], sourceFileName: string) {
    if (!canEditInventory || importing) return;
    setFeedback(null);
    setImporting(true);
    setImportProgress({
      total: records.length,
      done: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      movements: 0,
      current: "Preparazione import...",
    });

    const summary: ImportSummary = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      movements: 0,
      errors: [],
    };

    try {
      if (!records.length) {
        setFeedback({ type: "error", message: "Il file non contiene righe importabili." });
        return;
      }

      const ctx = await getCurrentTeamContext();

      for (const [index, record] of records.entries()) {
        const rowNumber = index + 2;
        const name = normalizeText(record.name);

        setImportProgress({
          total: records.length,
          done: index,
          inserted: summary.inserted,
          updated: summary.updated,
          skipped: summary.skipped,
          movements: summary.movements,
          current: `Importazione riga ${rowNumber} di ${records.length + 1}...`,
        });

        if (!name) {
          summary.skipped += 1;
          summary.errors.push(`Riga ${rowNumber}: manca il nome articolo.`);
          setImportProgress({
            total: records.length,
            done: index + 1,
            inserted: summary.inserted,
            updated: summary.updated,
            skipped: summary.skipped,
            movements: summary.movements,
            current: `Riga ${rowNumber} saltata: manca il nome articolo.`,
          });
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
                reason: "Rettifica quantità da import guidato",
                unitCost: payload.unit_cost,
                currency: payload.currency,
                notes: `Import file ${sourceFileName}`,
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
                reason: "Carico iniziale da import guidato",
                unitCost: payload.unit_cost,
                currency: payload.currency,
                notes: `Import file ${sourceFileName}`,
              });
              summary.movements += 1;
            }

            summary.inserted += 1;
          }
        } catch (error) {
          summary.skipped += 1;
          summary.errors.push(`Riga ${rowNumber}: ${formatSupabaseImportError(error)}`);
        }

        setImportProgress({
          total: records.length,
          done: index + 1,
          inserted: summary.inserted,
          updated: summary.updated,
          skipped: summary.skipped,
          movements: summary.movements,
          current: `Processate ${index + 1} righe su ${records.length}.`,
        });
      }

      const loadedCount = summary.inserted + summary.updated;
      const errorsCopy = summary.errors.length
        ? ` Dettagli: ${summary.errors.slice(0, 10).join(" | ")}${
            summary.errors.length > 10 ? " ..." : ""
          }`
        : "";

      if (loadedCount === 0) {
        setFeedback({
          type: "error",
          message: `Import non completato: nessun articolo caricato. Saltati: ${summary.skipped}.${errorsCopy}`,
        });
        return;
      }

      await load({ keepFeedback: true });
      setImportWizard(null);
      setFeedback({
        type: summary.errors.length ? "info" : "success",
        message: `Import completato. Creati: ${summary.inserted}. Aggiornati: ${summary.updated}. Saltati: ${summary.skipped}. Movimenti: ${summary.movements}.${errorsCopy}`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Import interrotto: ${error.message}`
            : "Import interrotto per un errore imprevisto.",
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  async function prepareImportWizard(file: File) {
    if (!canEditInventory || importing) return;
    setFeedback(null);

    try {
      const text = await file.text();
      const parsed = parseCsvForWizard(text);

      if (!parsed || !parsed.headers.length || !parsed.rows.length) {
        setFeedback({ type: "error", message: "Il file CSV è vuoto o non valido." });
        return;
      }

      setImportWizard({
        fileName: file.name,
        headers: parsed.headers,
        rows: parsed.rows,
        delimiter: parsed.delimiter,
        mapping: detectImportMapping(parsed.headers),
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? `Errore lettura file: ${error.message}`
            : "Errore lettura file CSV.",
      });
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void prepareImportWizard(file);
    event.currentTarget.value = "";
  }

  function updateImportMapping(columnIndex: number, value: ImportMappingValue) {
    setImportWizard((current) => {
      if (!current) return current;

      const nextMapping = { ...current.mapping };

      if (value !== "ignore") {
        Object.entries(nextMapping).forEach(([index, mappedValue]) => {
          if (Number(index) !== columnIndex && mappedValue === value) {
            nextMapping[Number(index)] = "ignore";
          }
        });
      }

      nextMapping[columnIndex] = value;
      return { ...current, mapping: nextMapping };
    });
  }

  async function confirmGuidedImport() {
    if (!importWizard || !importValidation) return;

    if (!mappedFields.includes("name")) {
      setFeedback({ type: "error", message: "Associa almeno una colonna al campo Nome articolo." });
      return;
    }

    if (importValidation.errors.length > 0) {
      setFeedback({
        type: "error",
        message: "Correggi gli errori di validazione prima di confermare l'import.",
      });
      return;
    }

    await importMappedRecords(importValidation.records, importWizard.fileName);
  }

  function moveColumn(column: InventoryTableColumnKey, direction: "left" | "right") {
    setColumnOrder((current) => {
      const index = current.indexOf(column);
      if (index === -1) return current;

      const nextIndex = direction === "left" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function resetColumnOrder() {
    setColumnOrder([...defaultTableColumnOrder]);
  }

  function renderInventoryCell(row: InventoryItem, column: InventoryTableColumnKey) {
    const quantity = Number(row.quantity ?? 0);
    const reserved = Number(row.reserved_quantity ?? 0);
    const available = Math.max(quantity - reserved, 0);
    const minimum = Number(row.minimum_quantity ?? 0);
    const lowStock = available <= minimum;

    switch (column) {
      case "photo": {
        const imageUrl = getInventoryImageUrl(row.image_path);
        const uploadingThisImage = imageUploadingId === row.id;

        return (
          <div className="w-28">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
              {imageUrl ? (
                <img src={imageUrl} alt={`Foto ${row.name}`} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={22} className="text-neutral-400" />
              )}
            </div>
            {canEditInventory ? (
              <div className="mt-2 flex flex-col gap-1">
                <label className="cursor-pointer rounded-lg bg-neutral-100 px-2 py-1 text-center text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200">
                  {uploadingThisImage ? "Carico..." : imageUrl ? "Sostituisci" : "Carica"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={Boolean(imageUploadingId)}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void handleRowImageChange(row, file);
                    }}
                  />
                </label>
                {imageUrl ? (
                  <button
                    type="button"
                    onClick={() => void removeInventoryImage(row)}
                    disabled={Boolean(imageUploadingId)}
                    className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={11} className="mr-1 inline" />
                    Rimuovi
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      }
      case "article":
        return (
          <div>
            <div className="font-semibold text-neutral-900">{row.name}</div>
            <div className="mt-1 text-xs text-neutral-500">
              {[row.brand, row.supplier_name].filter(Boolean).join(" · ") || "—"}
            </div>
            {row.notes ? (
              <div className="mt-1 max-w-md text-xs leading-5 text-neutral-500">{row.notes}</div>
            ) : null}
          </div>
        );
      case "codes":
        return (
          <div className="text-xs leading-5 text-neutral-600">
            <div>SKU: {row.sku || "—"}</div>
            <div>Forn.: {row.supplier_code || "—"}</div>
            <div>OEM: {row.manufacturer_code || "—"}</div>
            <div>EAN: {row.barcode || "—"}</div>
          </div>
        );
      case "category":
        return <span className="text-neutral-700">{row.category || "—"}</span>;
      case "available":
        return (
          <div>
            <span className={lowStock ? "font-semibold text-red-600" : "font-semibold text-neutral-900"}>
              {formatNumber(available)}
            </span>
            {available !== quantity ? (
              <div className="mt-1 text-xs text-neutral-500">Giacenza: {formatNumber(quantity)}</div>
            ) : null}
          </div>
        );
      case "minimum":
        return <span className="text-neutral-700">{formatNumber(minimum)}</span>;
      case "reserved":
        return <span className="text-neutral-700">{formatNumber(reserved)}</span>;
      case "unit":
        return <span className="text-neutral-700">{row.unit || "pz"}</span>;
      case "location":
        return <span className="text-neutral-700">{row.location || "—"}</span>;
      case "cost":
        return (
          <span className="text-neutral-700">
            {row.unit_cost !== null && row.unit_cost !== undefined
              ? `${formatNumber(row.unit_cost)} ${row.currency || "EUR"}`
              : "—"}
          </span>
        );
      case "actions":
        return canEditInventory ? (
          <div className="flex min-w-[220px] flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openEditItemForm(row)}
              className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-200"
            >
              <Pencil size={12} className="mr-1 inline" />
              Modifica
            </button>
            <button
              type="button"
              onClick={() => openMovementForm(row, "in")}
              className="rounded-lg bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
            >
              <Plus size={12} className="mr-1 inline" />
              Carico
            </button>
            <button
              type="button"
              onClick={() => openMovementForm(row, "out")}
              className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <Minus size={12} className="mr-1 inline" />
              Scarico
            </button>
            <button
              type="button"
              onClick={() => openMovementForm(row, "adjustment")}
              className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <RefreshCw size={12} className="mr-1 inline" />
              Rettifica
            </button>
            <button
              type="button"
              onClick={() => openMovementForm(row, "reserve")}
              className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              Impegna
            </button>
            {Number(row.reserved_quantity ?? 0) > 0 ? (
              <button
                type="button"
                onClick={() => openMovementForm(row, "release_reserve")}
                className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-200"
              >
                Rilascia
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void openMovementHistory(row)}
              className="rounded-lg bg-neutral-900 px-2 py-1 text-xs font-semibold text-white hover:bg-neutral-800"
            >
              <History size={12} className="mr-1 inline" />
              Storico
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void openMovementHistory(row)}
            className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-200"
          >
            Storico
          </button>
        );
      default:
        return null;
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Magazzino"
        subtitle="Articoli, scorte e import/export"
        icon={<Package size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Magazzino"
        subtitle="Articoli, scorte e import/export"
        icon={<Package size={22} />}
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
        icon={<Package size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo magazzino."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title="Magazzino"
        subtitle="Anagrafica articoli, scorte, foto, movimenti e import/export guidato."
        icon={<Package size={22} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEditInventory ? (
              <button
                type="button"
                onClick={openNewItemForm}
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-sm font-bold text-[var(--brand-on-accent)] hover:brightness-95"
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
              onClick={() => setColumnSettingsOpen(true)}
              className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-200"
            >
              <Settings2 size={16} className="mr-2 inline" />
              Colonne
            </button>
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

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Import/export e tracciabilità"
        subtitle="Caricamento guidato, movimenti di magazzino e storico quantità."
      >
        <InfoBlock>
        Il magazzino è pronto per un caricamento iniziale pulito: puoi usare il template CSV oppure
        importare file con intestazioni comuni italiane/inglesi. Dopo l’import puoi modificare
        l’anagrafica articolo, registrare carichi/scarichi, rettificare la giacenza e consultare
        lo storico movimenti.
        </InfoBlock>
      </SectionCard>

      <SectionCard
        title="Articoli a magazzino"
        subtitle="Consulta disponibilità, soglie minime, codici e materiali impegnati."
      >
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca per nome, SKU, marca, fornitore, posizione..."
            className={inputClassName}
          />
          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}
            className={inputClassName}
          >
            <option value="all">Tutti gli articoli</option>
            <option value="low">Sotto scorta minima</option>
            <option value="reserved">Con quantità impegnata</option>
            <option value="withPhoto">Con foto</option>
            <option value="withoutPhoto">Senza foto</option>
          </select>
        </div>
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
                    onClick={openNewItemForm}
                    className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-sm font-bold text-[var(--brand-on-accent)] hover:brightness-95"
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
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="Nessun articolo trovato"
            description="Modifica ricerca o filtro per visualizzare altri articoli."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 bg-white text-sm">
              <thead className="bg-neutral-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {columnOrder.map((column) => (
                    <th key={column} className="px-4 py-3">
                      {tableColumnLabels[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    {columnOrder.map((column) => (
                      <td key={column} className="px-4 py-3">
                        {renderInventoryCell(row, column)}
                      </td>
                    ))}
                  </tr>
                ))}
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
                <h3 className="text-xl font-bold text-neutral-900">{editId ? "Modifica articolo" : "Nuovo articolo"}</h3>
                <div className="mt-1 text-sm text-neutral-500">
                  {editId ? "Aggiorna anagrafica, codici, soglie e posizione. Le quantità si modificano dai movimenti." : "Inserisci anagrafica, codici standard e quantità iniziale."}
                </div>
              </div>
              <button
                type="button"
                onClick={closeItemForm}
                className="rounded-xl bg-neutral-100 px-3 py-2 font-semibold text-neutral-800 hover:bg-neutral-200"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Foto articolo" hint="Una foto principale aiuta a riconoscere rapidamente ricambi e componenti simili.">
                  <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                      {formImagePreview ? (
                        <img src={formImagePreview} alt="Anteprima foto articolo" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon size={28} className="text-neutral-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-neutral-900">
                        {formImageFile ? formImageFile.name : "Nessuna foto selezionata"}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-neutral-500">
                        Formati supportati: JPG, PNG, WEBP, GIF. Dimensione massima: 5 MB.
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <label className="cursor-pointer rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800">
                          <ImageIcon size={16} className="mr-2 inline" />
                          Seleziona foto
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleFormImageChange}
                          />
                        </label>
                        {formImageFile ? (
                          <button
                            type="button"
                            onClick={clearFormImage}
                            className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-200"
                          >
                            Rimuovi selezione
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Field>
              </div>

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

              <Field
                label={editId ? "Giacenza attuale" : "Quantità iniziale"}
                hint={editId ? "Per modificare la giacenza usa Carico, Scarico o Rettifica dalla tabella." : undefined}
              >
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                  disabled={Boolean(editId)}
                  className={`${inputClassName} ${editId ? "bg-neutral-100 text-neutral-500" : ""}`}
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

              <Field
                label="Impegnata / riservata"
                hint={editId ? "Per impegnare o rilasciare quantità usa i movimenti dalla tabella." : undefined}
              >
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.reserved_quantity}
                  onChange={(event) => setForm({ ...form, reserved_quantity: event.target.value })}
                  disabled={Boolean(editId)}
                  className={`${inputClassName} ${editId ? "bg-neutral-100 text-neutral-500" : ""}`}
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
                onClick={closeItemForm}
                className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-200"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={saveItem}
                disabled={saving}
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlusCircle size={16} className="mr-2 inline" />
                {saving ? "Salvataggio..." : editId ? "Salva modifiche" : "Aggiungi articolo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}


      {movementForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">
                  {getMovementTypeLabel(movementForm.movementType)} magazzino
                </h3>
                <div className="mt-1 text-sm text-neutral-500">
                  Articolo: <span className="font-semibold text-neutral-700">{movementForm.itemName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMovementForm}
                disabled={movementSaving}
                className="rounded-xl bg-neutral-100 px-3 py-2 font-semibold text-neutral-800 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <Field
                label={movementForm.movementType === "adjustment" ? "Quantità finale corretta" : "Quantità"}
                hint={
                  movementForm.movementType === "adjustment"
                    ? "Inserisci la giacenza finale reale dopo controllo inventario. Il sistema calcolerà la differenza."
                    : movementForm.movementType === "reserve"
                      ? "La quantità verrà impegnata ma resterà fisicamente in magazzino."
                      : movementForm.movementType === "release_reserve"
                        ? "La quantità verrà rimossa dagli impegni e tornerà disponibile."
                        : undefined
                }
              >
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={movementForm.quantity}
                  onChange={(event) =>
                    setMovementForm({ ...movementForm, quantity: event.target.value })
                  }
                  className={inputClassName}
                  autoFocus
                />
              </Field>

              <Field label="Motivo movimento">
                <input
                  value={movementForm.reason}
                  onChange={(event) =>
                    setMovementForm({ ...movementForm, reason: event.target.value })
                  }
                  placeholder="Es. Acquisto, utilizzo evento, rettifica inventario..."
                  className={inputClassName}
                />
              </Field>

              <Field label="Note">
                <textarea
                  value={movementForm.notes}
                  onChange={(event) =>
                    setMovementForm({ ...movementForm, notes: event.target.value })
                  }
                  placeholder="Eventuali dettagli aggiuntivi, documento, riferimento ordine, auto/evento collegato..."
                  className={textareaClassName}
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeMovementForm}
                disabled={movementSaving}
                className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void confirmMovement()}
                disabled={movementSaving}
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {movementSaving ? (
                  <Loader2 size={16} className="mr-2 inline animate-spin" />
                ) : (
                  <CheckCircle2 size={16} className="mr-2 inline" />
                )}
                {movementSaving ? "Registrazione..." : "Registra movimento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {movementHistoryItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Storico movimenti</h3>
                <div className="mt-1 text-sm text-neutral-500">
                  Articolo: <span className="font-semibold text-neutral-700">{movementHistoryItem.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMovementHistoryItem(null)}
                className="rounded-xl bg-neutral-100 px-3 py-2 font-semibold text-neutral-800 hover:bg-neutral-200"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200">
              {movementHistoryLoading ? (
                <div className="p-6 text-sm text-neutral-500">Caricamento movimenti...</div>
              ) : movementHistory.length === 0 ? (
                <div className="p-6 text-sm text-neutral-500">Nessun movimento registrato per questo articolo.</div>
              ) : (
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Delta</th>
                      <th className="px-4 py-3">Prima</th>
                      <th className="px-4 py-3">Dopo</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {movementHistory.map((movement) => (
                      <tr key={movement.id} className="align-top">
                        <td className="px-4 py-3 text-neutral-600">{formatDateTime(movement.created_at)}</td>
                        <td className="px-4 py-3 font-semibold text-neutral-900">
                          {getMovementTypeLabel(movement.movement_type)}
                        </td>
                        <td className={Number(movement.quantity_delta ?? 0) < 0 ? "px-4 py-3 font-semibold text-red-600" : "px-4 py-3 font-semibold text-green-700"}>
                          {Number(movement.quantity_delta ?? 0) > 0 ? "+" : ""}{formatNumber(movement.quantity_delta)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{formatNumber(movement.quantity_before)}</td>
                        <td className="px-4 py-3 text-neutral-600">{formatNumber(movement.quantity_after)}</td>
                        <td className="px-4 py-3 text-neutral-600">{movement.reason || "—"}</td>
                        <td className="px-4 py-3 text-neutral-600">{movement.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {columnSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Ordine colonne magazzino</h3>
                <div className="mt-1 text-sm text-neutral-500">
                  Sposta le colonne nella posizione che preferisci. L’ordine viene salvato sul browser.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setColumnSettingsOpen(false)}
                className="rounded-xl bg-neutral-100 px-3 py-2 font-semibold text-neutral-800 hover:bg-neutral-200"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-6 space-y-2">
              {columnOrder.map((column, index) => (
                <div
                  key={column}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div>
                    <div className="font-semibold text-neutral-900">{tableColumnLabels[column]}</div>
                    <div className="text-xs text-neutral-500">Posizione {index + 1}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveColumn(column, "left")}
                      disabled={index === 0}
                      className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Su
                    </button>
                    <button
                      type="button"
                      onClick={() => moveColumn(column, "right")}
                      disabled={index === columnOrder.length - 1}
                      className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Giù
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetColumnOrder}
                className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-200"
              >
                Ripristina ordine standard
              </button>
              <button
                type="button"
                onClick={() => setColumnSettingsOpen(false)}
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95"
              >
                Salva ordine
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importWizard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            {importing ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/85 p-6 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 text-center shadow-xl">
                  <Loader2 size={34} className="mx-auto animate-spin text-yellow-500" />
                  <div className="mt-4 text-lg font-black text-neutral-900">Importazione in corso</div>
                  <div className="mt-2 text-sm leading-6 text-neutral-600">
                    Non chiudere la finestra e non ricaricare la pagina. Attendi il messaggio finale.
                  </div>
                  <div className="mt-4 rounded-full bg-neutral-100 p-1">
                    <div
                      className="h-2 rounded-full bg-[var(--brand-accent)] transition-all"
                      style={{
                        width: `${Math.min(100, Math.round(((importProgress?.done ?? 0) / Math.max(importProgress?.total ?? 1, 1)) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-neutral-800">
                    {importProgress?.done ?? 0} / {importProgress?.total ?? 0} righe processate
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {importProgress?.current || "Preparazione..."}
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                    <div className="rounded-xl bg-neutral-50 p-2">
                      <div className="font-bold text-neutral-900">{importProgress?.inserted ?? 0}</div>
                      <div className="text-neutral-500">Creati</div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 p-2">
                      <div className="font-bold text-neutral-900">{importProgress?.updated ?? 0}</div>
                      <div className="text-neutral-500">Agg.</div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 p-2">
                      <div className="font-bold text-neutral-900">{importProgress?.skipped ?? 0}</div>
                      <div className="text-neutral-500">Saltati</div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 p-2">
                      <div className="font-bold text-neutral-900">{importProgress?.movements ?? 0}</div>
                      <div className="text-neutral-500">Mov.</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Import guidato magazzino</h3>
                <div className="mt-1 text-sm text-neutral-500">
                  File: <span className="font-semibold text-neutral-700">{importWizard.fileName}</span> ·
                  Righe lette: {importWizard.rows.length} · Separatore rilevato: {importWizard.delimiter === "\t" ? "TAB" : importWizard.delimiter}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportWizard(null)}
                disabled={importing}
                className="rounded-xl bg-neutral-100 px-3 py-2 font-semibold text-neutral-800 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Chiudi
              </button>
            </div>

            {feedback ? (
              <div className="mt-4">
                <FormStatusBanner type={feedback.type} message={feedback.message} />
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <CheckCircle2 size={16} />
                  Righe valide
                </div>
                <div className="mt-2 text-2xl font-black text-neutral-900">
                  {importValidation?.validRows ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <AlertTriangle size={16} />
                  Avvisi
                </div>
                <div className="mt-2 text-2xl font-black text-neutral-900">
                  {importValidation?.warnings.length ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <XCircle size={16} />
                  Errori
                </div>
                <div className="mt-2 text-2xl font-black text-neutral-900">
                  {importValidation?.errors.length ?? 0}
                </div>
              </div>
            </div>

            {!mappedFields.includes("name") ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                Per importare devi associare almeno una colonna al campo “Nome articolo”.
              </div>
            ) : null}

            <div className="mt-6">
              <h4 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
                Associazione colonne
              </h4>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200">
                <table className="min-w-full divide-y divide-neutral-200 bg-white text-sm">
                  <thead className="bg-neutral-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Colonna file</th>
                      <th className="px-4 py-3">Esempio dati</th>
                      <th className="px-4 py-3">Campo da importare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {importWizard.headers.map((header, index) => {
                      const exampleValues = importWizard.rows
                        .slice(0, 3)
                        .map((row) => row[index])
                        .filter(Boolean);

                      return (
                        <tr key={`${header}-${index}`} className="align-top">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-neutral-900">{header || `Colonna ${index + 1}`}</div>
                            <div className="mt-1 text-xs text-neutral-500">
                              Proposta: {getImportFieldLabel(importWizard.mapping[index] ?? "ignore")}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs leading-5 text-neutral-600">
                            {exampleValues.length ? exampleValues.join(" · ") : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={importWizard.mapping[index] ?? "ignore"}
                              onChange={(event) =>
                                updateImportMapping(index, event.target.value as ImportMappingValue)
                              }
                              className={inputClassName}
                            >
                              {importFieldOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                  {option.required ? " *" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <h4 className="font-bold text-neutral-900">Anteprima prime righe</h4>
                <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-neutral-200">
                  <table className="min-w-full divide-y divide-neutral-200 text-xs">
                    <thead className="bg-neutral-50">
                      <tr>
                        {templateHeaders
                          .filter((field) => mappedFields.includes(field))
                          .slice(0, 8)
                          .map((field) => (
                            <th key={field} className="px-3 py-2 text-left font-semibold text-neutral-500">
                              {getImportFieldLabel(field)}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {(importValidation?.records ?? []).slice(0, 5).map((record, index) => (
                        <tr key={index}>
                          {templateHeaders
                            .filter((field) => mappedFields.includes(field))
                            .slice(0, 8)
                            .map((field) => (
                              <td key={field} className="px-3 py-2 text-neutral-700">
                                {record[field] || "—"}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <h4 className="font-bold text-neutral-900">Validazione</h4>
                <div className="mt-3 space-y-3 text-sm">
                  {importValidation?.errors.length ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                      <div className="font-bold">Errori da correggere</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {importValidation.errors.slice(0, 6).map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                      {importValidation.errors.length > 6 ? (
                        <div className="mt-2 text-xs">Altri errori non mostrati: {importValidation.errors.length - 6}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-700">
                      Nessun errore bloccante rilevato.
                    </div>
                  )}

                  {importValidation?.warnings.length ? (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
                      <div className="font-bold">Avvisi</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {importValidation.warnings.slice(0, 5).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                      {importValidation.warnings.length > 5 ? (
                        <div className="mt-2 text-xs">Altri avvisi non mostrati: {importValidation.warnings.length - 5}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportWizard(null)}
                disabled={importing}
                className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmGuidedImport}
                disabled={
                  importing ||
                  !mappedFields.includes("name") ||
                  Boolean(importValidation?.errors.length) ||
                  !(importValidation?.records.length ?? 0)
                }
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload size={16} className="mr-2 inline" />
                {importing ? "Importazione..." : "Conferma e importa"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
