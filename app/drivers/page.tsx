"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  Mail,
  Phone,
  Printer,
  PlusCircle,
  Save,
  Search,
  ShieldCheck,
  TimerReset,
  Trophy,
  Gauge,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import StatsGrid from "@/components/StatsGrid";
import { UiField, uiInputClassName } from "@/components/UiField";
import ViewModeToggle from "@/components/ViewModeToggle";
import { usePersistedViewMode } from "@/lib/usePersistedViewMode";
import { useLanguage } from "@/components/providers/LanguageProvider";
import LocalizedText from "@/components/LocalizedText";
import {
  hasDriverDocumentFile,
  removeDriverDocumentFile,
  resolveDriverDocumentUrl,
  uploadDriverDocumentFile,
} from "@/lib/driverDocumentStorage";

const inputClass = uiInputClassName;
const selectClass = uiInputClassName;
const textAreaClass = `${uiInputClassName} min-h-[84px]`;

const DRIVER_PAGE_SIZE = 50;

const DOCUMENT_TYPES = [
  { value: "license", label: "Licenza" },
  { value: "medical", label: "Idoneità medica" },
  { value: "insurance", label: "Assicurazione" },
  { value: "identity", label: "Documento identità" },
  { value: "release", label: "Liberatoria" },
  { value: "contract", label: "Contratto" },
  { value: "other", label: "Altro" },
];

type Driver = {
  id: string;
  team_id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  date_of_birth: string | null;
  nationality: string | null;
  racing_number: string | null;
  license_number: string | null;
  license_category: string | null;
  license_expires_at: string | null;
  medical_expires_at: string | null;
  insurance_expires_at: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  blood_type: string | null;
  suit_size: string | null;
  helmet_size: string | null;
  shoe_size: string | null;
  address: string | null;
  photo_path: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string | null;
};

type DriverDocument = {
  id: string;
  team_id: string;
  driver_id: string;
  document_type: string | null;
  title: string | null;
  document_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  file_path: string | null;
  file_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string | null;
};

type DriverPerformanceSummary = {
  driver_id: string;
  events_count: number;
  turns_count: number;
  total_minutes: number;
  total_hours: number;
  total_laps: number;
  best_lap_ms: number | null;
  avg_lap_ms: number | null;
  last_turn_at: string | null;
  last_event_name: string | null;
  last_car_name: string | null;
};

type DriverPerformanceDetail = {
  id: string;
  driver_id: string;
  event_name: string;
  car_name: string;
  recorded_at: string | null;
  minutes: number;
  laps: number;
  best_lap_ms: number | null;
  avg_lap_ms: number | null;
};

type DriverForm = {
  first_name: string;
  last_name: string;
  nickname: string;
  email: string;
  phone: string;
  is_active: boolean;
  date_of_birth: string;
  nationality: string;
  racing_number: string;
  license_number: string;
  license_category: string;
  license_expires_at: string;
  medical_expires_at: string;
  insurance_expires_at: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  blood_type: string;
  suit_size: string;
  helmet_size: string;
  shoe_size: string;
  address: string;
  notes: string;
};

type DocumentForm = {
  document_type: string;
  title: string;
  document_number: string;
  issued_at: string;
  expires_at: string;
  notes: string;
};

const emptyDriverForm: DriverForm = {
  first_name: "",
  last_name: "",
  nickname: "",
  email: "",
  phone: "",
  is_active: true,
  date_of_birth: "",
  nationality: "",
  racing_number: "",
  license_number: "",
  license_category: "",
  license_expires_at: "",
  medical_expires_at: "",
  insurance_expires_at: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  blood_type: "",
  suit_size: "",
  helmet_size: "",
  shoe_size: "",
  address: "",
  notes: "",
};

const emptyDocumentForm: DocumentForm = {
  document_type: "license",
  title: "",
  document_number: "",
  issued_at: "",
  expires_at: "",
  notes: "",
};

function nullable(value: string) {
  const clean = value.trim();
  return clean ? clean : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("it-IT");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT");
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function formatHours(minutes: number) {
  return `${round1(minutes / 60)} h`;
}

function formatLapTime(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const totalMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  return `${seconds}.${String(millis).padStart(3, "0")}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function expiryTone(value: string | null | undefined) {
  const days = daysUntil(value);
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "ok";
}

function getDriverName(driver: Driver, fallback = "Pilota senza nome") {
  return `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || fallback;
}

function getDocumentLabel(type: string | null | undefined) {
  return DOCUMENT_TYPES.find((entry) => entry.value === type)?.label || "Documento";
}

function getPhotoUrl(path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from("driver-photos").getPublicUrl(path).data.publicUrl;
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function StatusPill({ tone, children }: { tone: "green" | "yellow" | "red" | "neutral" | "blue"; children: React.ReactNode }) {
  const classes = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    yellow: "border-yellow-400/25 bg-yellow-500/10 text-[var(--brand-accent)]",
    red: "border-red-400/30 bg-red-500/10 text-red-200",
    blue: "border-sky-400/30 bg-sky-500/10 text-sky-200",
    neutral: "border-white/10 bg-white/[0.045] text-[var(--text-secondary)]",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>{children}</span>;
}

function ExpiryPill({ label, labelKey, value }: { label: string; labelKey?: string; value: string | null | undefined }) {
  const { t } = useLanguage();
  const translatedLabel = labelKey ? t(labelKey, label) : t(`ui.${label}`, label);
  const tone = expiryTone(value);
  if (tone === "missing") return <StatusPill tone="neutral">{translatedLabel}: {t("drivers.expiry.notEntered", "non inserita")}</StatusPill>;
  if (tone === "expired") return <StatusPill tone="red">{translatedLabel}: {t("drivers.expiry.expired", "scaduta")}</StatusPill>;
  if (tone === "expiring") return <StatusPill tone="yellow">{translatedLabel}: {t("drivers.expiry.expiring", "in scadenza")}</StatusPill>;
  return <StatusPill tone="green">{translatedLabel}: {t("drivers.expiry.valid", "valida")}</StatusPill>;
}

export default function DriversPage() {
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
  const access = usePermissionAccess();
  const canViewDrivers = access.hasPermission("drivers.view");
  const canEditDrivers = access.hasPermission("drivers.edit", ["owner", "admin"]);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [performanceByDriver, setPerformanceByDriver] = useState<Record<string, DriverPerformanceSummary>>({});
  const [performanceDetailsByDriver, setPerformanceDetailsByDriver] = useState<Record<string, DriverPerformanceDetail[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyDriverForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState<DocumentForm>(emptyDocumentForm);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docSaving, setDocSaving] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentEditForm, setDocumentEditForm] = useState<DocumentForm>(emptyDocumentForm);
  const [documentReplacementFile, setDocumentReplacementFile] = useState<File | null>(null);
  const [documentEditSaving, setDocumentEditSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "alerts">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [driverStats, setDriverStats] = useState({ total_drivers: 0, active_drivers: 0, expired_documents: 0, expiring_documents: 0, drivers_with_alerts: 0 });
  const [viewMode, setViewMode] = usePersistedViewMode("drivers-view-mode");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { data, error } = await supabase.rpc("drivers_archive_page", {
        p_team_id: ctx.teamId,
        p_page: page,
        p_page_size: DRIVER_PAGE_SIZE,
        p_search: debouncedQuery || null,
        p_filter: filter,
      });
      if (error) throw error;

      const payload = (data || {}) as any;
      const rows = Array.isArray(payload.items) ? payload.items : [];
      setDrivers(rows as Driver[]);
      setTotal(Number(payload.total || 0));
      setDriverStats({
        total_drivers: Number(payload.stats?.total_drivers || 0),
        active_drivers: Number(payload.stats?.active_drivers || 0),
        expired_documents: Number(payload.stats?.expired_documents || 0),
        expiring_documents: Number(payload.stats?.expiring_documents || 0),
        drivers_with_alerts: Number(payload.stats?.drivers_with_alerts || 0),
      });

      const allDocuments: DriverDocument[] = [];
      const summaries: Record<string, DriverPerformanceSummary> = {};
      const details: Record<string, DriverPerformanceDetail[]> = {};
      for (const row of rows) {
        const driverId = String(row.id);
        const rowDocuments = Array.isArray(row.documents) ? row.documents : [];
        allDocuments.push(...(rowDocuments as DriverDocument[]));
        if (row.performance) summaries[driverId] = row.performance as DriverPerformanceSummary;
        details[driverId] = Array.isArray(row.recent_performance) ? row.recent_performance as DriverPerformanceDetail[] : [];
      }
      setDocuments(allDocuments);
      setPerformanceByDriver(summaries);
      setPerformanceDetailsByDriver(details);
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "Errore caricamento piloti o documenti." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!access.loading && canViewDrivers) void load();
  }, [access.loading, canViewDrivers, page, debouncedQuery, filter]);

  function resetDriverModal() {
    setOpen(false);
    setEditId(null);
    setForm(emptyDriverForm);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyDriverForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setOpen(true);
  }

  function openEdit(driver: Driver) {
    setEditId(driver.id);
    setForm({
      first_name: driver.first_name || "",
      last_name: driver.last_name || "",
      nickname: driver.nickname || "",
      email: driver.email || "",
      phone: driver.phone || "",
      is_active: driver.is_active !== false,
      date_of_birth: driver.date_of_birth || "",
      nationality: driver.nationality || "",
      racing_number: driver.racing_number || "",
      license_number: driver.license_number || "",
      license_category: driver.license_category || "",
      license_expires_at: driver.license_expires_at || "",
      medical_expires_at: driver.medical_expires_at || "",
      insurance_expires_at: driver.insurance_expires_at || "",
      emergency_contact_name: driver.emergency_contact_name || "",
      emergency_contact_phone: driver.emergency_contact_phone || "",
      blood_type: driver.blood_type || "",
      suit_size: driver.suit_size || "",
      helmet_size: driver.helmet_size || "",
      shoe_size: driver.shoe_size || "",
      address: driver.address || "",
      notes: driver.notes || "",
    });
    setPhotoFile(null);
    setPhotoPreview(getPhotoUrl(driver.photo_path));
    setOpen(true);
  }

  async function uploadDriverPhoto(teamId: string, driverId: string, currentPath?: string | null) {
    if (!photoFile) return null;
    const ext = photoFile.name.split(".").pop() || "jpg";
    const path = `${teamId}/${driverId}/${Date.now()}_${safeFileName(photoFile.name || `foto.${ext}`)}`;
    const { error } = await supabase.storage.from("driver-photos").upload(path, photoFile, { upsert: true });
    if (error) throw error;
    if (currentPath) {
      await supabase.storage.from("driver-photos").remove([currentPath]);
    }
    return path;
  }

  async function saveDriver() {
    if (!canEditDrivers) return;
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFeedback({ type: "error", message: "Nome e cognome sono obbligatori." });
      return;
    }

    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        nickname: nullable(form.nickname),
        email: nullable(form.email),
        phone: nullable(form.phone),
        is_active: form.is_active,
        date_of_birth: form.date_of_birth || null,
        nationality: nullable(form.nationality),
        racing_number: nullable(form.racing_number),
        license_number: nullable(form.license_number),
        license_category: nullable(form.license_category),
        license_expires_at: form.license_expires_at || null,
        medical_expires_at: form.medical_expires_at || null,
        insurance_expires_at: form.insurance_expires_at || null,
        emergency_contact_name: nullable(form.emergency_contact_name),
        emergency_contact_phone: nullable(form.emergency_contact_phone),
        blood_type: nullable(form.blood_type),
        suit_size: nullable(form.suit_size),
        helmet_size: nullable(form.helmet_size),
        shoe_size: nullable(form.shoe_size),
        address: nullable(form.address),
        notes: nullable(form.notes),
      };

      let driverId = editId;
      let currentPhotoPath: string | null = null;

      if (editId) {
        const existing = drivers.find((driver) => driver.id === editId);
        currentPhotoPath = existing?.photo_path || null;
        const { error } = await supabase.from("drivers").update(payload).eq("id", editId).eq("team_id", ctx.teamId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("drivers")
          .insert([{ ...payload, team_id: ctx.teamId }])
          .select("id")
          .single();
        if (error) throw error;
        driverId = data?.id;
      }

      if (driverId && photoFile) {
        const path = await uploadDriverPhoto(ctx.teamId, driverId, currentPhotoPath);
        if (path) {
          const { error } = await supabase.from("drivers").update({ photo_path: path, photo_url: null }).eq("id", driverId).eq("team_id", ctx.teamId);
          if (error) throw error;
        }
      }

      resetDriverModal();
      await load();
      setFeedback({ type: "success", message: editId ? "Pilota aggiornato correttamente." : "Pilota creato correttamente." });
    } catch (error: any) {
      console.error(error);
      setFeedback({ type: "error", message: error?.message || "Errore salvataggio pilota." });
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto(driver: Driver) {
    if (!canEditDrivers || !driver.photo_path) return;
    if (!confirm(tr("Rimuovere la foto del pilota?"))) return;
    try {
      const ctx = await getCurrentTeamContext();
      await supabase.storage.from("driver-photos").remove([driver.photo_path]);
      const { error } = await supabase.from("drivers").update({ photo_path: null, photo_url: null }).eq("team_id", ctx.teamId).eq("id", driver.id);
      if (error) throw error;
      await load();
      setFeedback({ type: "success", message: "Foto pilota rimossa." });
    } catch (error: any) {
      console.error(error);
      setFeedback({ type: "error", message: error?.message || "Errore rimozione foto." });
    }
  }

  function documentsForDriver(driverId: string) {
    return documents.filter((doc) => doc.driver_id === driverId);
  }

  function driverHasAlert(driver: Driver) {
    const ownExpiries = [driver.license_expires_at, driver.medical_expires_at, driver.insurance_expires_at];
    const ownAlert = ownExpiries.some((date) => ["expired", "expiring"].includes(expiryTone(date)));
    const docAlert = documentsForDriver(driver.id).some((doc) => ["expired", "expiring"].includes(expiryTone(doc.expires_at)));
    return ownAlert || docAlert;
  }

  async function saveDocument(driver: Driver) {
    if (!canEditDrivers) return;
    if (!docForm.title.trim()) {
      setFeedback({ type: "error", message: "Inserisci il titolo del documento." });
      return;
    }

    setDocSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { data, error } = await supabase
        .from("driver_documents")
        .insert([
          {
            team_id: ctx.teamId,
            driver_id: driver.id,
            document_type: docForm.document_type,
            title: docForm.title.trim(),
            document_number: nullable(docForm.document_number),
            issued_at: docForm.issued_at || null,
            expires_at: docForm.expires_at || null,
            notes: nullable(docForm.notes),
            created_by_team_user_id: ctx.teamUserId,
          },
        ])
        .select("id")
        .single();
      if (error) throw error;

      if (docFile && data?.id) {
        const upload = await uploadDriverDocumentFile({
          driverId: driver.id,
          documentId: data.id,
          file: docFile,
        });
        const update = await supabase
          .from("driver_documents")
          .update({
            file_path: upload.path,
            file_url: null,
            storage_path: null,
            file_name: upload.fileName,
            mime_type: upload.mimeType,
            size_bytes: upload.sizeBytes,
          })
          .eq("team_id", ctx.teamId)
          .eq("id", data.id);
        if (update.error) {
          await removeDriverDocumentFile({ file_path: upload.path }).catch(() => undefined);
          throw update.error;
        }
      }

      setDocForm(emptyDocumentForm);
      setDocFile(null);
      await load();
      setFeedback({ type: "success", message: "Documento pilota salvato." });
    } catch (error: any) {
      console.error(error);
      setFeedback({ type: "error", message: error?.message || "Errore salvataggio documento." });
    } finally {
      setDocSaving(false);
    }
  }

  async function openDocument(doc: DriverDocument) {
    try {
      const url = await resolveDriverDocumentUrl(doc);
      if (!url) throw new Error("File non disponibile.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error(error);
      setFeedback({ type: "error", message: error?.message || "Errore apertura documento." });
    }
  }

  function startDocumentEdit(doc: DriverDocument) {
    setEditingDocumentId(doc.id);
    setDocumentEditForm({
      document_type: doc.document_type || "other",
      title: doc.title || "",
      document_number: doc.document_number || "",
      issued_at: doc.issued_at || "",
      expires_at: doc.expires_at || "",
      notes: doc.notes || "",
    });
    setDocumentReplacementFile(null);
  }

  function cancelDocumentEdit() {
    setEditingDocumentId(null);
    setDocumentEditForm(emptyDocumentForm);
    setDocumentReplacementFile(null);
  }

  async function saveDocumentEdit(doc: DriverDocument) {
    if (!canEditDrivers || editingDocumentId !== doc.id) return;
    if (!documentEditForm.title.trim()) {
      setFeedback({ type: "error", message: "Inserisci il titolo del documento." });
      return;
    }

    setDocumentEditSaving(true);
    let uploadedPath: string | null = null;

    try {
      const ctx = await getCurrentTeamContext();
      const payload: Record<string, unknown> = {
        document_type: documentEditForm.document_type || null,
        title: documentEditForm.title.trim(),
        document_number: nullable(documentEditForm.document_number),
        issued_at: documentEditForm.issued_at || null,
        expires_at: documentEditForm.expires_at || null,
        notes: nullable(documentEditForm.notes),
        updated_at: new Date().toISOString(),
      };

      if (documentReplacementFile) {
        const upload = await uploadDriverDocumentFile({
          driverId: doc.driver_id,
          documentId: doc.id,
          file: documentReplacementFile,
        });
        uploadedPath = upload.path;
        Object.assign(payload, {
          file_path: upload.path,
          file_url: null,
          storage_path: null,
          file_name: upload.fileName,
          mime_type: upload.mimeType,
          size_bytes: upload.sizeBytes,
        });
      }

      const { error } = await supabase
        .from("driver_documents")
        .update(payload)
        .eq("team_id", ctx.teamId)
        .eq("id", doc.id);
      if (error) throw error;

      if (documentReplacementFile) {
        await removeDriverDocumentFile(doc).catch((storageError) => {
          console.warn("Impossibile rimuovere il vecchio file documento", storageError);
        });
      }

      cancelDocumentEdit();
      await load();
      setFeedback({ type: "success", message: "Documento aggiornato correttamente." });
    } catch (error: any) {
      console.error(error);
      if (uploadedPath) {
        await removeDriverDocumentFile({ file_path: uploadedPath }).catch(() => undefined);
      }
      setFeedback({ type: "error", message: error?.message || "Errore aggiornamento documento." });
    } finally {
      setDocumentEditSaving(false);
    }
  }

  async function deleteDocument(doc: DriverDocument) {
    if (!canEditDrivers) return;
    if (!confirm(tr("Eliminare questo documento pilota?"))) return;
    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase
        .from("driver_documents")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("id", doc.id);
      if (error) throw error;

      await removeDriverDocumentFile(doc).catch((storageError) => {
        console.warn("Documento eliminato dal database ma file non rimosso dallo storage", storageError);
      });

      await load();
      setFeedback({ type: "success", message: "Documento eliminato." });
    } catch (error: any) {
      console.error(error);
      setFeedback({ type: "error", message: error?.message || "Errore eliminazione documento." });
    }
  }

  function printDriverCard(driver: Driver) {
    const docs = documentsForDriver(driver.id);
    const performance = performanceByDriver[driver.id];
    const recentPerformance = performanceDetailsByDriver[driver.id] || [];
    const photoUrl = getPhotoUrl(driver.photo_path);
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Scheda pilota - ${escapeHtml(getDriverName(driver, t("drivers.unnamed", "Pilota senza nome")))}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 28px; color: #111827; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #111827; padding-bottom: 18px; margin-bottom: 20px; }
    .title { font-size: 28px; font-weight: 900; margin: 0; }
    .subtitle { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
    .photo { width: 120px; height: 120px; border: 1px solid #d1d5db; border-radius: 16px; object-fit: cover; background: #f3f4f6; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
    .box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; break-inside: avoid; }
    .label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: .06em; font-weight: 700; }
    .value { margin-top: 4px; font-size: 14px; font-weight: 800; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; margin: 22px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; font-size: 10px; text-transform: uppercase; color: #4b5563; }
    .notes { white-space: pre-wrap; line-height: 1.45; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; }
    @media print { body { padding: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${escapeHtml(getDriverName(driver, t("drivers.unnamed", "Pilota senza nome")))}</h1>
      <p class="subtitle">${escapeHtml(tr("Scheda pilota generata il"))} ${escapeHtml(new Date().toLocaleDateString("it-IT"))}</p>
      <p class="subtitle">${escapeHtml(driver.nickname || t("drivers.noNickname", "Nessun nickname"))} ${driver.racing_number ? ` · #${escapeHtml(driver.racing_number)}` : ""}</p>
    </div>
    ${photoUrl ? `<img class="photo" src="${escapeHtml(photoUrl)}" />` : `<div class="photo"></div>`}
  </div>

  <h2>${escapeHtml(tr("Anagrafica e contatti"))}</h2>
  <div class="grid">
    <div class="box"><div class="label">${escapeHtml(tr("Email"))}</div><div class="value">${escapeHtml(driver.email || "—")}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Telefono"))}</div><div class="value">${escapeHtml(driver.phone || "—")}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Nazionalità"))}</div><div class="value">${escapeHtml(driver.nationality || "—")}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Data nascita"))}</div><div class="value">${escapeHtml(formatDate(driver.date_of_birth))}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Gruppo sanguigno"))}</div><div class="value">${escapeHtml(driver.blood_type || "—")}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Stato"))}</div><div class="value">${escapeHtml(driver.is_active === false ? tr("Non attivo") : tr("Attivo"))}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Emergenza"))}</div><div class="value">${escapeHtml([driver.emergency_contact_name, driver.emergency_contact_phone].filter(Boolean).join(" · ") || "—")}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Taglie"))}</div><div class="value">${escapeHtml([driver.suit_size && `${tr("Tuta")} ${driver.suit_size}`, driver.helmet_size && `${tr("Casco")} ${driver.helmet_size}`, driver.shoe_size && `${tr("Scarpe")} ${driver.shoe_size}`].filter(Boolean).join(" · ") || "—")}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Indirizzo"))}</div><div class="value">${escapeHtml(driver.address || "—")}</div></div>
  </div>

  <h2>${escapeHtml(tr("Licenze e scadenze"))}</h2>
  <div class="grid">
    <div class="box"><div class="label">${escapeHtml(tr("Licenza"))}</div><div class="value">${escapeHtml([driver.license_category, driver.license_number].filter(Boolean).join(" · ") || "—")}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Scadenza licenza"))}</div><div class="value">${escapeHtml(formatDate(driver.license_expires_at))}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Idoneità medica"))}</div><div class="value">${escapeHtml(formatDate(driver.medical_expires_at))}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Assicurazione"))}</div><div class="value">${escapeHtml(formatDate(driver.insurance_expires_at))}</div></div>
  </div>

  <h2>${escapeHtml(tr("Performance eventi"))}</h2>
  <div class="grid">
    <div class="box"><div class="label">${escapeHtml(tr("Eventi"))}</div><div class="value">${performance?.events_count ?? 0}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Turni"))}</div><div class="value">${performance?.turns_count ?? 0}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Ore guida"))}</div><div class="value">${performance ? escapeHtml(`${performance.total_hours} h`) : "0 h"}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Giri"))}</div><div class="value">${performance?.total_laps ?? 0}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Best lap"))}</div><div class="value">${escapeHtml(formatLapTime(performance?.best_lap_ms))}</div></div>
    <div class="box"><div class="label">${escapeHtml(tr("Ultimo evento"))}</div><div class="value">${escapeHtml(performance?.last_event_name || "—")}</div></div>
  </div>
  <table>
    <thead><tr><th>${escapeHtml(tr("Data"))}</th><th>${escapeHtml(tr("Evento"))}</th><th>${escapeHtml(tr("Auto"))}</th><th>${escapeHtml(tr("Minuti"))}</th><th>${escapeHtml(tr("Giri"))}</th><th>${escapeHtml(tr("Best lap"))}</th><th>${escapeHtml(tr("Avg lap"))}</th></tr></thead>
    <tbody>
      ${recentPerformance.length ? recentPerformance.map((row) => `<tr><td>${escapeHtml(formatDateTime(row.recorded_at))}</td><td>${escapeHtml(row.event_name)}</td><td>${escapeHtml(row.car_name)}</td><td>${row.minutes}</td><td>${row.laps}</td><td>${escapeHtml(formatLapTime(row.best_lap_ms))}</td><td>${escapeHtml(formatLapTime(row.avg_lap_ms))}</td></tr>`).join("") : `<tr><td colspan="7">${escapeHtml(tr("Nessun turno/evento collegato al pilota."))}</td></tr>`}
    </tbody>
  </table>

  <h2>${escapeHtml(tr("Documenti"))}</h2>
  <table>
    <thead><tr><th>${escapeHtml(tr("Tipo"))}</th><th>${escapeHtml(tr("Titolo"))}</th><th>${escapeHtml(tr("Numero"))}</th><th>${escapeHtml(tr("Emissione"))}</th><th>${escapeHtml(tr("Scadenza"))}</th></tr></thead>
    <tbody>
      ${docs.length ? docs.map((doc) => `<tr><td>${escapeHtml(tr(getDocumentLabel(doc.document_type)))}</td><td>${escapeHtml(doc.title || "—")}</td><td>${escapeHtml(doc.document_number || "—")}</td><td>${escapeHtml(formatDate(doc.issued_at))}</td><td>${escapeHtml(formatDate(doc.expires_at))}</td></tr>`).join("") : `<tr><td colspan="5">${escapeHtml(tr("Nessun documento registrato."))}</td></tr>`}
    </tbody>
  </table>

  <h2>${escapeHtml(tr("Note"))}</h2>
  <div class="box notes">${escapeHtml(driver.notes || "—")}</div>
  <div class="footer">${escapeHtml(tr("Scheda generata da"))} Battaglia Racing Car · WebApp Motorsport</div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
    const printWindow = window.open("", "_blank", "width=1000,height=900");
    if (!printWindow) {
      setFeedback({ type: "error", message: "Impossibile aprire la finestra di stampa. Controlla il blocco popup del browser." });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  const filteredDrivers = drivers;

  const stats = useMemo(() => [
    { label: "Piloti registrati", value: String(driverStats.total_drivers), icon: <Users className="h-5 w-5" />, helper: "Anagrafiche disponibili nel team" },
    { label: "Piloti attivi", value: String(driverStats.active_drivers), icon: <ShieldCheck className="h-5 w-5" />, helper: "Piloti utilizzabili per eventi e turni" },
    { label: "Scadenze vicine", value: String(driverStats.expiring_documents), icon: <CalendarClock className="h-5 w-5" />, helper: "Documenti in scadenza entro 30 giorni" },
    { label: "Da verificare", value: String(driverStats.drivers_with_alerts + driverStats.expired_documents), icon: <AlertTriangle className="h-5 w-5" />, helper: "Piloti o documenti con criticità" },
  ], [driverStats]);

  const totalPages = Math.max(1, Math.ceil(total / DRIVER_PAGE_SIZE));

  if (access.loading) {
    return (
      <PagePermissionState
        title={tr("Piloti")}
        subtitle={tr("Anagrafica, licenze, documenti e scadenze operative")}
        icon={<Users className="h-6 w-6" />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title={tr("Piloti")}
        subtitle={tr("Anagrafica, licenze, documenti e scadenze operative")}
        icon={<Users className="h-6 w-6" />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewDrivers) {
    return (
      <PagePermissionState
        title={tr("Piloti")}
        subtitle={tr("Anagrafica, licenze, documenti e scadenze operative")}
        icon={<Users className="h-6 w-6" />}
        state="denied"
        message={tr("Il tuo ruolo non ha accesso al modulo piloti. Chiedi a un owner o admin di abilitare il permesso drivers.view.")}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title={tr("Piloti")}
        subtitle={tr("Anagrafica, contatti, licenze, idoneità medica, documenti e scadenze operative.")}
        icon={<Users className="h-6 w-6" />}
        actions={
          canEditDrivers ? (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95">
              <PlusCircle className="h-4 w-4" /> <LocalizedText text="Nuovo pilota" />
            </button>
          ) : undefined
        }
      />

      {!canEditDrivers ? (
        <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200">
          {tr("Hai accesso in sola lettura a questo modulo.")}
        </div>
      ) : null}

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <StatsGrid items={stats} />

      <SectionCard title={tr("Archivio piloti")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tr("Cerca per nome, nickname, numero, licenza...")}
                className={`${inputClass} pl-10`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              {[
                { value: "all", label: t("drivers.archive.filter.all", "Tutti") },
                { value: "active", label: t("drivers.archive.filter.active", "Attivi") },
                { value: "inactive", label: t("drivers.archive.filter.inactive", "Non attivi") },
                { value: "alerts", label: t("drivers.archive.filter.withExpiries", "Con scadenze") },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setFilter(value as typeof filter); setPage(1); }}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                    filter === value ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-on-accent)]" : "border-white/10 bg-white/[0.045] text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] p-6 text-sm font-semibold text-[var(--text-muted)]"><LocalizedText text="Caricamento piloti..." /></div>
          ) : filteredDrivers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.045] p-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
              <p className="text-base font-bold text-[var(--text-primary)]"><LocalizedText text="Nessun pilota trovato" /></p>
              <p className="mt-1 text-sm text-[var(--text-muted)]"><LocalizedText text="Crea il primo pilota o modifica i filtri di ricerca." /></p>
            </div>
          ) : viewMode === "compact" ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_120px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)] max-xl:hidden">
                <span><LocalizedText text="Pilota" /></span>
                <span><LocalizedText text="Contatti" /></span>
                <span><LocalizedText text="Scadenze" /></span>
                <span><LocalizedText text="Performance" /></span>
                <span><LocalizedText text="Stato" /></span>
                <span><LocalizedText text="Azioni" /></span>
              </div>
              <div className="divide-y divide-white/10">
                {filteredDrivers.map((driver) => {
                  const performance = performanceByDriver[driver.id];
                  const alerts = driverHasAlert(driver);
                  const docs = documentsForDriver(driver.id);
                  return (
                    <div key={driver.id} className="grid gap-3 px-4 py-3 text-sm xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_120px] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-black text-[var(--text-primary)]">{getDriverName(driver, t("drivers.unnamed", "Pilota senza nome"))}</span>
                          {driver.racing_number ? <StatusPill tone="blue">#{driver.racing_number}</StatusPill> : null}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{driver.nickname || driver.nationality || t("drivers.profileFallback", "Profilo pilota")}</div>
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">
                        <div className="truncate">{driver.email || t("drivers.emailNotEntered", "Email non inserita")}</div>
                        <div className="truncate text-[var(--text-muted)]">{driver.phone || t("drivers.phoneNotEntered", "Telefono non inserito")}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <ExpiryPill label="Licenza" labelKey="drivers.licenseLabel" value={driver.license_expires_at} />
                        <ExpiryPill label="Medica" labelKey="drivers.medicalLabel" value={driver.medical_expires_at} />
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">
                        <span className="font-black text-[var(--text-primary)]">{performance ? performance.turns_count : 0}</span> {t("drivers.sessionsUnit", "turni")} · <span className="font-black text-[var(--text-primary)]">{performance ? performance.total_hours : 0}</span> <LocalizedText text="h" />
                        <div className="text-[var(--text-muted)]">{t("drivers.bestLabel", "Best")}: {formatLapTime(performance?.best_lap_ms)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {driver.is_active === false ? <StatusPill tone="neutral">{t("drivers.status.inactive", "Non attivo")}</StatusPill> : <StatusPill tone="green">{t("drivers.status.active", "Attivo")}</StatusPill>}
                        {alerts || docs.some((doc) => ["expired", "expiring"].includes(expiryTone(doc.expires_at))) ? <StatusPill tone="yellow">{t("drivers.status.toVerify", "Da verificare")}</StatusPill> : null}
                      </div>
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <button onClick={() => setExpandedDriverId(expandedDriverId === driver.id ? null : driver.id)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-white/10">
                          {expandedDriverId === driver.id ? t("common.close", "Chiudi") : t("common.open", "Apri")}
                        </button>
                        <Link href={`/drivers/${driver.id}`} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-white/10">
                          {tr("Scheda profilo")}
                        </Link>
                        {canEditDrivers ? (
                          <button onClick={() => openEdit(driver)} className="rounded-xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 px-3 py-2 text-xs font-bold text-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/18">
                            {tr("Modifica profilo")}
                          </button>
                        ) : null}
                      </div>
                      {expandedDriverId === driver.id ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 xl:col-span-6">
                          <div className="grid gap-3 md:grid-cols-4">
                            <PerformanceBox label="Eventi" value={performance ? String(performance.events_count) : "0"} />
                            <PerformanceBox label="Turni" value={performance ? String(performance.turns_count) : "0"} />
                            <PerformanceBox label="Ore guida" value={performance ? `${performance.total_hours} h` : "0 h"} />
                            <PerformanceBox label="Documenti" value={String(docs.length)} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredDrivers.map((driver) => {
                const photoUrl = getPhotoUrl(driver.photo_path);
                const docs = documentsForDriver(driver.id);
                const expanded = expandedDriverId === driver.id;
                const alerts = driverHasAlert(driver);
                const performance = performanceByDriver[driver.id];
                const recentPerformance = performanceDetailsByDriver[driver.id] || [];
                return (
                  <div key={driver.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)] shadow-sm">
                    <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.075]">
                          {photoUrl ? <img src={photoUrl} alt={getDriverName(driver, t("drivers.unnamed", "Pilota senza nome"))} className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-[var(--text-muted)]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-black text-[var(--text-primary)]">{getDriverName(driver, t("drivers.unnamed", "Pilota senza nome"))}</h3>
                            {driver.racing_number ? <StatusPill tone="blue">#{driver.racing_number}</StatusPill> : null}
                            {driver.is_active === false ? <StatusPill tone="neutral">{t("drivers.status.inactive", "Non attivo")}</StatusPill> : <StatusPill tone="green">{t("drivers.status.active", "Attivo")}</StatusPill>}
                            {alerts ? <StatusPill tone="yellow">{t("drivers.status.expiriesToVerify", "Scadenze da verificare")}</StatusPill> : null}
                          </div>
                          <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">{driver.nickname || t("drivers.noNickname", "Nessun nickname")}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.075] px-2.5 py-1"><Mail className="h-3 w-3" /> {driver.email || t("drivers.emailNotEntered", "Email non inserita")}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.075] px-2.5 py-1"><Phone className="h-3 w-3" /> {driver.phone || t("drivers.phoneNotEntered", "Telefono non inserito")}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <ExpiryPill label="Licenza" labelKey="drivers.licenseLabel" value={driver.license_expires_at} />
                            <ExpiryPill label="Medica" labelKey="drivers.medicalLabel" value={driver.medical_expires_at} />
                            <ExpiryPill label="Assicurazione" value={driver.insurance_expires_at} />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link href={`/drivers/${driver.id}`} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-white/[0.045]">
                          {tr("Scheda profilo")}
                        </Link>
                        <Link href={`/calendar?driver=${driver.id}`} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-white/[0.045]">
                          {t("module.events", "Eventi")}
                        </Link>
                        <button onClick={() => printDriverCard(driver)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-white/[0.045]">
                          <Printer className="h-4 w-4" /> {t("ui.Stampa", "Stampa")}
                        </button>
                        <button
                          onClick={() => {
                            setExpandedDriverId(expanded ? null : driver.id);
                            setDocForm(emptyDocumentForm);
                            setDocFile(null);
                            cancelDocumentEdit();
                          }}
                          className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-white/[0.045]"
                        >
                          {t("ui.Dettaglio", "Dettaglio")} ({docs.length} {t("ui.doc", "doc")})
                        </button>
                        {canEditDrivers ? (
                          <>
                            <button onClick={() => openEdit(driver)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-accent)] px-3 py-2 text-sm font-bold text-[var(--brand-on-accent)] hover:brightness-95">
                              <Edit3 className="h-4 w-4" /> {tr("Modifica profilo")}
                            </button>
                            {driver.photo_path ? (
                              <button onClick={() => removePhoto(driver)} className="rounded-xl border border-red-400/30 px-3 py-2 text-sm font-bold text-red-200 hover:bg-red-500/10">
                                <LocalizedText text="Rimuovi foto" />
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 border-t border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-[var(--text-secondary)] md:grid-cols-4">
                      <InfoLine label="Nazionalità" value={driver.nationality} />
                      <InfoLine label="Licenza" value={[driver.license_category, driver.license_number].filter(Boolean).join(" · ") || null} />
                      <InfoLine label="Emergenza" value={[driver.emergency_contact_name, driver.emergency_contact_phone].filter(Boolean).join(" · ") || null} />
                      <InfoLine label="Taglie" value={[driver.suit_size && `${tr("Tuta")} ${driver.suit_size}`, driver.helmet_size && `${tr("Casco")} ${driver.helmet_size}`, driver.shoe_size && `${tr("Scarpe")} ${driver.shoe_size}`].filter(Boolean).join(" · ") || null} />
                    </div>

                    <div className="grid gap-3 border-t border-white/10 bg-[rgba(16,23,31,0.96)] px-4 py-3 text-sm text-[var(--text-secondary)] md:grid-cols-5">
                      <PerformanceMini label="Eventi" value={performance ? String(performance.events_count) : "0"} icon={<Trophy className="h-4 w-4" />} />
                      <PerformanceMini label="Turni" value={performance ? String(performance.turns_count) : "0"} icon={<TimerReset className="h-4 w-4" />} />
                      <PerformanceMini label="Ore guida" value={performance ? `${performance.total_hours} h` : "0 h"} icon={<CalendarClock className="h-4 w-4" />} />
                      <PerformanceMini label="Giri" value={performance ? String(performance.total_laps) : "0"} icon={<Gauge className="h-4 w-4" />} />
                      <PerformanceMini label="Best lap" value={formatLapTime(performance?.best_lap_ms)} icon={<ShieldCheck className="h-4 w-4" />} />
                    </div>

                    {expanded ? (
                      <div className="border-t border-white/10 bg-[rgba(16,23,31,0.96)] p-4">
                        <div className="mb-4 grid gap-4">
                          <div>
                            <h4 className="font-black text-[var(--text-primary)]"><LocalizedText text="Performance eventi" /></h4>
                            <p className="text-sm font-semibold text-[var(--text-muted)]"><LocalizedText text="Dati calcolati dai turni/eventi collegati al pilota." /></p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-4">
                            <PerformanceBox label="Eventi disputati" value={performance ? String(performance.events_count) : "0"} />
                            <PerformanceBox label="Turni registrati" value={performance ? String(performance.turns_count) : "0"} />
                            <PerformanceBox label="Ore guida" value={performance ? `${performance.total_hours} h` : "0 h"} />
                            <PerformanceBox label="Best lap" value={formatLapTime(performance?.best_lap_ms)} />
                          </div>
                          {recentPerformance.length > 0 ? (
                            <div className="overflow-hidden rounded-2xl border border-white/10">
                              <div className="grid grid-cols-6 gap-2 bg-white/[0.045] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                                <span><LocalizedText text="Data" /></span>
                                <span className="col-span-2"><LocalizedText text="Evento" /></span>
                                <span><LocalizedText text="Auto" /></span>
                                <span><LocalizedText text="Giri" /></span>
                                <span>{t("drivers.bestLabel", "Best")}</span>
                              </div>
                              {recentPerformance.map((row) => (
                                <div key={row.id} className="grid grid-cols-6 gap-2 border-t border-white/10 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                                  <span>{formatDateTime(row.recorded_at)}</span>
                                  <span className="col-span-2 truncate">{row.event_name}</span>
                                  <span className="truncate">{row.car_name}</span>
                                  <span>{row.laps}</span>
                                  <span>{formatLapTime(row.best_lap_ms)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.045] p-4 text-sm font-semibold text-[var(--text-muted)]">
                              <LocalizedText text="Nessun turno/evento ancora collegato a questo pilota." />
                            </div>
                          )}
                        </div>

                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-black text-[var(--text-primary)]"><LocalizedText text="Documenti e scadenze" /></h4>
                            <p className="text-sm font-semibold text-[var(--text-muted)]"><LocalizedText text="Licenze, certificati, liberatorie e file collegati al pilota." /></p>
                          </div>
                        </div>

                        {docs.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.045] p-4 text-sm font-semibold text-[var(--text-muted)]"><LocalizedText text="Nessun documento registrato per questo pilota." /></div>
                        ) : (
                          <div className="mb-4 grid gap-2">
                            {docs.map((doc) => {
                              const tone = expiryTone(doc.expires_at);
                              return (
                                <div key={doc.id} className="rounded-2xl border border-white/10 p-3">
                                  {editingDocumentId === doc.id ? (
                                    <div className="space-y-4">
                                      <div className="grid gap-3 md:grid-cols-3">
                                        <UiField label="Tipo documento">
                                          <select value={documentEditForm.document_type} onChange={(e) => setDocumentEditForm((prev) => ({ ...prev, document_type: e.target.value }))} className={selectClass}>
                                            {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{tr(type.label)}</option>)}
                                          </select>
                                        </UiField>
                                        <UiField label="Titolo">
                                          <input value={documentEditForm.title} onChange={(e) => setDocumentEditForm((prev) => ({ ...prev, title: e.target.value }))} className={inputClass} />
                                        </UiField>
                                        <UiField label="Numero documento">
                                          <input value={documentEditForm.document_number} onChange={(e) => setDocumentEditForm((prev) => ({ ...prev, document_number: e.target.value }))} className={inputClass} />
                                        </UiField>
                                        <UiField label="Data emissione">
                                          <input type="date" value={documentEditForm.issued_at} onChange={(e) => setDocumentEditForm((prev) => ({ ...prev, issued_at: e.target.value }))} className={inputClass} />
                                        </UiField>
                                        <UiField label="Data scadenza">
                                          <input type="date" value={documentEditForm.expires_at} onChange={(e) => setDocumentEditForm((prev) => ({ ...prev, expires_at: e.target.value }))} className={inputClass} />
                                        </UiField>
                                        <UiField label="Sostituisci file">
                                          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2">
                                            <label htmlFor={`driver-doc-replace-${doc.id}`} className="inline-flex cursor-pointer items-center rounded-xl bg-[var(--brand-accent)] px-3 py-2 text-xs font-black text-[var(--brand-on-accent)] hover:brightness-95">
                                              {tr("Scegli file")}
                                            </label>
                                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-secondary)]">{documentReplacementFile?.name || doc.file_name || tr("Mantieni il file attuale")}</span>
                                            <input id={`driver-doc-replace-${doc.id}`} type="file" accept="application/pdf,image/*" onChange={(e) => setDocumentReplacementFile(e.target.files?.[0] || null)} className="sr-only" />
                                          </div>
                                        </UiField>
                                        <div className="md:col-span-3">
                                          <UiField label="Note">
                                            <textarea value={documentEditForm.notes} onChange={(e) => setDocumentEditForm((prev) => ({ ...prev, notes: e.target.value }))} className={textAreaClass} />
                                          </UiField>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap justify-end gap-2">
                                        <button onClick={cancelDocumentEdit} disabled={documentEditSaving} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-white/[0.045] disabled:opacity-60">
                                          <X className="h-4 w-4" /> {tr("Annulla")}
                                        </button>
                                        <button onClick={() => saveDocumentEdit(doc)} disabled={documentEditSaving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-accent)] px-3 py-2 text-xs font-black text-[var(--brand-on-accent)] hover:brightness-95 disabled:opacity-60">
                                          <Save className="h-4 w-4" /> {documentEditSaving ? tr("Salvataggio...") : tr("Salva modifiche")}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <FileText className="h-4 w-4 text-[var(--text-muted)]" />
                                          <span className="font-black text-[var(--text-primary)]">{doc.title || getDocumentLabel(doc.document_type)}</span>
                                          <StatusPill tone={tone === "expired" ? "red" : tone === "expiring" ? "yellow" : tone === "ok" ? "green" : "neutral"}>
                                            {doc.expires_at ? `${tr("Scade")} ${formatDate(doc.expires_at)}` : tr("Senza scadenza")}
                                          </StatusPill>
                                        </div>
                                        <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                                          {tr(getDocumentLabel(doc.document_type))} · {doc.document_number || tr("Numero non inserito")} · {tr("Emesso")} {formatDate(doc.issued_at)}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {hasDriverDocumentFile(doc) ? (
                                          <button onClick={() => openDocument(doc)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/[0.045]">
                                            <Eye className="h-4 w-4" /> <LocalizedText text="Apri file" />
                                          </button>
                                        ) : null}
                                        {canEditDrivers ? (
                                          <>
                                            <button
                                              onClick={() => startDocumentEdit(doc)}
                                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/[0.045]"
                                            >
                                              <Edit3 className="h-4 w-4" /> <LocalizedText text="Modifica" />
                                            </button>
                                            <button onClick={() => deleteDocument(doc)} className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10">
                                              <Trash2 className="h-4 w-4" /> <LocalizedText text="Elimina" />
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {canEditDrivers ? (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                            <h5 className="mb-3 font-black text-[var(--text-primary)]"><LocalizedText text="Aggiungi documento" /></h5>
                            <div className="grid gap-3 md:grid-cols-3">
                              <UiField label="Tipo documento">
                                <select value={docForm.document_type} onChange={(e) => setDocForm((prev) => ({ ...prev, document_type: e.target.value }))} className={selectClass}>
                                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{tr(type.label)}</option>)}
                                </select>
                              </UiField>
                              <UiField label="Titolo">
                                <input value={docForm.title} onChange={(e) => setDocForm((prev) => ({ ...prev, title: e.target.value }))} className={inputClass} placeholder={tr("Es. Licenza ACI 2026")} />
                              </UiField>
                              <UiField label="Numero documento">
                                <input value={docForm.document_number} onChange={(e) => setDocForm((prev) => ({ ...prev, document_number: e.target.value }))} className={inputClass} placeholder={tr("Numero / codice")} />
                              </UiField>
                              <UiField label="Data emissione">
                                <input type="date" value={docForm.issued_at} onChange={(e) => setDocForm((prev) => ({ ...prev, issued_at: e.target.value }))} className={inputClass} />
                              </UiField>
                              <UiField label="Data scadenza">
                                <input type="date" value={docForm.expires_at} onChange={(e) => setDocForm((prev) => ({ ...prev, expires_at: e.target.value }))} className={inputClass} />
                              </UiField>
                              <UiField label="File PDF/immagine">
                                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2">
                                  <label htmlFor={`driver-doc-file-${driver.id}`} className="inline-flex cursor-pointer items-center rounded-xl bg-[var(--brand-accent)] px-3 py-2 text-xs font-black text-[var(--brand-on-accent)] hover:brightness-95">
                                    {tr("Scegli file")}
                                  </label>
                                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-secondary)]">{docFile?.name || tr("Nessun file selezionato")}</span>
                                  <input id={`driver-doc-file-${driver.id}`} type="file" accept="application/pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="sr-only" />
                                </div>
                              </UiField>
                              <UiField label="Note">
                                <textarea value={docForm.notes} onChange={(e) => setDocForm((prev) => ({ ...prev, notes: e.target.value }))} className={textAreaClass} placeholder={tr("Note interne")} />
                              </UiField>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button onClick={() => saveDocument(driver)} disabled={docSaving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:opacity-60">
                                <Upload className="h-4 w-4" /> {docSaving ? tr("Salvataggio...") : tr("Salva documento")}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="text-sm font-semibold text-[var(--text-muted)]">
                {tr("Pagina")} {page} / {totalPages} · {total} {tr("piloti")}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="race-action-secondary px-4 py-2 text-sm disabled:opacity-40">
                  {tr("Precedente")}
                </button>
                <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="race-action-secondary px-4 py-2 text-sm disabled:opacity-40">
                  {tr("Successiva")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {open && canEditDrivers ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl modal-panel p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[var(--text-primary)]">{editId ? tr("Modifica pilota") : tr("Nuovo pilota")}</h2>
                <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]"><LocalizedText text="Compila anagrafica, contatti, taglie e scadenze principali." /></p>
              </div>
              <button onClick={resetDriverModal} className="rounded-full p-2 hover:bg-white/[0.075]" aria-label={t("common.close", "Chiudi")}><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                <UiField label="Nome">
                  <input value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} className={inputClass} placeholder={tr("Nome")} />
                </UiField>
                <UiField label="Cognome">
                  <input value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} className={inputClass} placeholder={tr("Cognome")} />
                </UiField>
                <UiField label="Nickname paddock">
                  <input value={form.nickname} onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))} className={inputClass} placeholder={tr("Nickname")} />
                </UiField>
                <UiField label="Numero gara">
                  <input value={form.racing_number} onChange={(e) => setForm((prev) => ({ ...prev, racing_number: e.target.value }))} className={inputClass} placeholder={tr("Es. 27")} />
                </UiField>
                <UiField label="Email">
                  <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className={inputClass} placeholder={tr("email@team.com")} />
                </UiField>
                <UiField label="Telefono">
                  <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className={inputClass} placeholder={tr("Telefono")} />
                </UiField>
                <UiField label="Data nascita">
                  <input type="date" value={form.date_of_birth} onChange={(e) => setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))} className={inputClass} />
                </UiField>
                <UiField label="Nazionalità">
                  <input value={form.nationality} onChange={(e) => setForm((prev) => ({ ...prev, nationality: e.target.value }))} className={inputClass} placeholder={tr("Italia")} />
                </UiField>
                <UiField label="Numero licenza">
                  <input value={form.license_number} onChange={(e) => setForm((prev) => ({ ...prev, license_number: e.target.value }))} className={inputClass} placeholder={tr("Numero licenza")} />
                </UiField>
                <UiField label="Categoria licenza">
                  <input value={form.license_category} onChange={(e) => setForm((prev) => ({ ...prev, license_category: e.target.value }))} className={inputClass} placeholder={tr("Categoria")} />
                </UiField>
                <UiField label="Scadenza licenza">
                  <input type="date" value={form.license_expires_at} onChange={(e) => setForm((prev) => ({ ...prev, license_expires_at: e.target.value }))} className={inputClass} />
                </UiField>
                <UiField label="Scadenza idoneità medica">
                  <input type="date" value={form.medical_expires_at} onChange={(e) => setForm((prev) => ({ ...prev, medical_expires_at: e.target.value }))} className={inputClass} />
                </UiField>
                <UiField label="Scadenza assicurazione">
                  <input type="date" value={form.insurance_expires_at} onChange={(e) => setForm((prev) => ({ ...prev, insurance_expires_at: e.target.value }))} className={inputClass} />
                </UiField>
                <UiField label="Gruppo sanguigno">
                  <input value={form.blood_type} onChange={(e) => setForm((prev) => ({ ...prev, blood_type: e.target.value }))} className={inputClass} placeholder={tr("Es. 0+")} />
                </UiField>
                <UiField label="Contatto emergenza">
                  <input value={form.emergency_contact_name} onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))} className={inputClass} placeholder={tr("Nome contatto")} />
                </UiField>
                <UiField label="Telefono emergenza">
                  <input value={form.emergency_contact_phone} onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))} className={inputClass} placeholder={tr("Telefono emergenza")} />
                </UiField>
                <UiField label="Taglia tuta">
                  <input value={form.suit_size} onChange={(e) => setForm((prev) => ({ ...prev, suit_size: e.target.value }))} className={inputClass} placeholder={tr("Es. 52")} />
                </UiField>
                <UiField label="Taglia casco">
                  <input value={form.helmet_size} onChange={(e) => setForm((prev) => ({ ...prev, helmet_size: e.target.value }))} className={inputClass} placeholder={tr("Es. M")} />
                </UiField>
                <UiField label="Numero scarpe">
                  <input value={form.shoe_size} onChange={(e) => setForm((prev) => ({ ...prev, shoe_size: e.target.value }))} className={inputClass} placeholder={tr("Es. 42")} />
                </UiField>
                <UiField label="Stato">
                  <select value={form.is_active ? "active" : "inactive"} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.value === "active" }))} className={selectClass}>
                    <option value="active">{tr("Attivo")}</option>
                    <option value="inactive">{tr("Non attivo")}</option>
                  </select>
                </UiField>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <p className="mb-3 text-sm font-black text-[var(--text-primary)]"><LocalizedText text="Foto pilota" /></p>
                  <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[rgba(16,23,31,0.96)]">
                    {photoPreview ? <img src={photoPreview} alt={tr("Anteprima pilota")} className="h-full w-full object-cover" /> : <UserRound className="h-12 w-12 text-neutral-300" />}
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2">
                    <label
                      htmlFor="driver-photo-input"
                      className="inline-flex cursor-pointer items-center rounded-xl bg-[var(--brand-accent)] px-3 py-2 text-xs font-black text-[var(--brand-on-accent)] hover:brightness-95"
                    >
                      <LocalizedText text="Scegli file" />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-secondary)]">
                      {photoFile?.name || tr("Nessun file selezionato")}
                    </span>
                    <input
                      id="driver-photo-input"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setPhotoFile(file);
                        setPhotoPreview(file ? URL.createObjectURL(file) : null);
                      }}
                      className="sr-only"
                    />
                  </div>
                </div>
                <UiField label="Indirizzo">
                  <textarea value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className={textAreaClass} placeholder={tr("Indirizzo / residenza")} />
                </UiField>
                <UiField label="Note sportive/interne">
                  <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className={textAreaClass} placeholder={tr("Note interne")} />
                </UiField>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={resetDriverModal} className="rounded-xl border border-white/10 px-4 py-2 font-bold hover:bg-white/[0.045]"><LocalizedText text="Annulla" /></button>
              <button onClick={saveDriver} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] px-5 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> {saving ? tr("Salvataggio...") : editId ? tr("Salva modifiche") : tr("Crea pilota")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  const { t } = useLanguage();
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t(`ui.${label}`, label)}</p>
      <p className="mt-1 truncate font-bold text-[var(--text-primary)]">{value ? t(`ui.${value}`, value) : "—"}</p>
    </div>
  );
}

function PerformanceMini({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <span className="text-[var(--text-muted)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{t(`ui.${label}`, label)}</p>
        <p className="truncate font-black text-[var(--text-primary)]">{t(`ui.${value}`, value)}</p>
      </div>
    </div>
  );
}

function PerformanceBox({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t(`ui.${label}`, label)}</p>
      <p className="mt-1 text-lg font-black text-[var(--text-primary)]">{t(`ui.${value}`, value)}</p>
    </div>
  );
}
