"use client";

import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
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
  PlusCircle,
  Search,
  ShieldCheck,
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

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

const inputClass = uiInputClassName;
const selectClass = `${uiInputClassName} bg-white`;
const textAreaClass = `${uiInputClassName} min-h-[84px]`;

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
  notes: string | null;
  created_at: string | null;
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

function getDriverName(driver: Driver) {
  return `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || "Pilota senza nome";
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
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    neutral: "border-neutral-200 bg-neutral-50 text-neutral-600",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>{children}</span>;
}

function ExpiryPill({ label, value }: { label: string; value: string | null | undefined }) {
  const tone = expiryTone(value);
  if (tone === "missing") return <StatusPill tone="neutral">{label}: non inserita</StatusPill>;
  if (tone === "expired") return <StatusPill tone="red">{label}: scaduta</StatusPill>;
  if (tone === "expiring") return <StatusPill tone="yellow">{label}: in scadenza</StatusPill>;
  return <StatusPill tone="green">{label}: valida</StatusPill>;
}

export default function DriversPage() {
  const access = usePermissionAccess();
  const canViewDrivers = access.hasPermission("drivers.view");
  const canEditDrivers = access.hasPermission("drivers.edit", ["owner", "admin"]);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "alerts">("all");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [driversRes, documentsRes] = await Promise.all([
        supabase.from("drivers").select("*").eq("team_id", ctx.teamId).order("last_name", { ascending: true }),
        supabase.from("driver_documents").select("*").eq("team_id", ctx.teamId).order("expires_at", { ascending: true, nullsFirst: false }),
      ]);
      if (driversRes.error) throw driversRes.error;
      if (documentsRes.error) throw documentsRes.error;
      setDrivers((driversRes.data || []) as Driver[]);
      setDocuments((documentsRes.data || []) as DriverDocument[]);
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "Errore caricamento piloti o documenti." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewDrivers) void load();
  }, [access.loading, canViewDrivers]);

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
          const { error } = await supabase.from("drivers").update({ photo_path: path }).eq("id", driverId).eq("team_id", ctx.teamId);
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
    if (!confirm("Rimuovere la foto del pilota?")) return;
    try {
      const ctx = await getCurrentTeamContext();
      await supabase.storage.from("driver-photos").remove([driver.photo_path]);
      const { error } = await supabase.from("drivers").update({ photo_path: null }).eq("team_id", ctx.teamId).eq("id", driver.id);
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
        const path = `${ctx.teamId}/${driver.id}/${data.id}_${safeFileName(docFile.name)}`;
        const upload = await supabase.storage.from("driver-documents").upload(path, docFile, { upsert: true });
        if (upload.error) throw upload.error;
        const update = await supabase.from("driver_documents").update({ file_path: path }).eq("team_id", ctx.teamId).eq("id", data.id);
        if (update.error) throw update.error;
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
    if (!doc.file_path) return;
    try {
      const { data, error } = await supabase.storage.from("driver-documents").createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error(error);
      setFeedback({ type: "error", message: error?.message || "Errore apertura documento." });
    }
  }

  async function deleteDocument(doc: DriverDocument) {
    if (!canEditDrivers) return;
    if (!confirm("Eliminare questo documento pilota?")) return;
    try {
      const ctx = await getCurrentTeamContext();
      if (doc.file_path) {
        await supabase.storage.from("driver-documents").remove([doc.file_path]);
      }
      const { error } = await supabase.from("driver_documents").delete().eq("team_id", ctx.teamId).eq("id", doc.id);
      if (error) throw error;
      await load();
      setFeedback({ type: "success", message: "Documento eliminato." });
    } catch (error: any) {
      console.error(error);
      setFeedback({ type: "error", message: error?.message || "Errore eliminazione documento." });
    }
  }

  const filteredDrivers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return drivers.filter((driver) => {
      const text = [
        driver.first_name,
        driver.last_name,
        driver.nickname,
        driver.email,
        driver.phone,
        driver.racing_number,
        driver.license_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !normalized || text.includes(normalized);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && driver.is_active !== false) ||
        (filter === "inactive" && driver.is_active === false) ||
        (filter === "alerts" && driverHasAlert(driver));
      return matchesSearch && matchesFilter;
    });
  }, [drivers, documents, query, filter]);

  const stats = useMemo(() => {
    const activeDrivers = drivers.filter((driver) => driver.is_active !== false).length;
    const expiredDocuments = documents.filter((doc) => expiryTone(doc.expires_at) === "expired").length;
    const expiringDocuments = documents.filter((doc) => expiryTone(doc.expires_at) === "expiring").length;
    const driversWithAlerts = drivers.filter((driver) => driverHasAlert(driver)).length;
    return [
      { label: "Piloti registrati", value: String(drivers.length), icon: <Users className="h-5 w-5" />, helper: "Anagrafiche disponibili nel team" },
      { label: "Piloti attivi", value: String(activeDrivers), icon: <ShieldCheck className="h-5 w-5" />, helper: "Piloti utilizzabili per eventi e turni" },
      { label: "Scadenze vicine", value: String(expiringDocuments), icon: <CalendarClock className="h-5 w-5" />, helper: "Documenti in scadenza entro 30 giorni" },
      { label: "Da verificare", value: String(driversWithAlerts + expiredDocuments), icon: <AlertTriangle className="h-5 w-5" />, helper: "Piloti o documenti con criticità" },
    ];
  }, [drivers, documents]);

  if (access.loading) return <PagePermissionState state="loading" />;
  if (access.error) return <PagePermissionState state="error" message={access.error} />;
  if (!canViewDrivers) {
    return (
      <PagePermissionState
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo piloti. Chiedi a un owner o admin di abilitare il permesso drivers.view."
      />
    );
  }

  return (
    <div className={`${audiowide.className} flex flex-col gap-6 p-6`}>
      <PageHeader
        title="Piloti"
        subtitle="Anagrafica, contatti, licenze, idoneità medica, documenti e scadenze operative."
        icon={<Users className="h-6 w-6" />}
        actions={
          canEditDrivers ? (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">
              <PlusCircle className="h-4 w-4" /> Nuovo pilota
            </button>
          ) : undefined
        }
      />

      {!canEditDrivers ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <StatsGrid items={stats} />

      <SectionCard title="Archivio piloti">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca per nome, nickname, numero, licenza..."
                className={`${inputClass} pl-10`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Tutti"],
                ["active", "Attivi"],
                ["inactive", "Non attivi"],
                ["alerts", "Con scadenze"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value as typeof filter)}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                    filter === value ? "border-black bg-black text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm font-semibold text-neutral-500">Caricamento piloti...</div>
          ) : filteredDrivers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-neutral-400" />
              <p className="text-base font-bold text-neutral-800">Nessun pilota trovato</p>
              <p className="mt-1 text-sm text-neutral-500">Crea il primo pilota o modifica i filtri di ricerca.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredDrivers.map((driver) => {
                const photoUrl = getPhotoUrl(driver.photo_path);
                const docs = documentsForDriver(driver.id);
                const expanded = expandedDriverId === driver.id;
                const alerts = driverHasAlert(driver);
                return (
                  <div key={driver.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                          {photoUrl ? <img src={photoUrl} alt={getDriverName(driver)} className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-neutral-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-black text-neutral-900">{getDriverName(driver)}</h3>
                            {driver.racing_number ? <StatusPill tone="blue">#{driver.racing_number}</StatusPill> : null}
                            {driver.is_active === false ? <StatusPill tone="neutral">Non attivo</StatusPill> : <StatusPill tone="green">Attivo</StatusPill>}
                            {alerts ? <StatusPill tone="yellow">Scadenze da verificare</StatusPill> : null}
                          </div>
                          <p className="mt-1 text-sm font-semibold text-neutral-500">{driver.nickname || "Nessun nickname"}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-neutral-600">
                            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1"><Mail className="h-3 w-3" /> {driver.email || "Email non inserita"}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1"><Phone className="h-3 w-3" /> {driver.phone || "Telefono non inserito"}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <ExpiryPill label="Licenza" value={driver.license_expires_at} />
                            <ExpiryPill label="Medica" value={driver.medical_expires_at} />
                            <ExpiryPill label="Assicurazione" value={driver.insurance_expires_at} />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link href={`/calendar?driver=${driver.id}`} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50">
                          Eventi
                        </Link>
                        <button
                          onClick={() => {
                            setExpandedDriverId(expanded ? null : driver.id);
                            setDocForm(emptyDocumentForm);
                            setDocFile(null);
                          }}
                          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Documenti ({docs.length})
                        </button>
                        {canEditDrivers ? (
                          <>
                            <button onClick={() => openEdit(driver)} className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-sm font-bold text-white hover:bg-neutral-800">
                              <Edit3 className="h-4 w-4" /> Modifica
                            </button>
                            {driver.photo_path ? (
                              <button onClick={() => removePhoto(driver)} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">
                                Rimuovi foto
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 md:grid-cols-4">
                      <InfoLine label="Nazionalità" value={driver.nationality} />
                      <InfoLine label="Licenza" value={[driver.license_category, driver.license_number].filter(Boolean).join(" · ") || null} />
                      <InfoLine label="Emergenza" value={[driver.emergency_contact_name, driver.emergency_contact_phone].filter(Boolean).join(" · ") || null} />
                      <InfoLine label="Taglie" value={[driver.suit_size && `Tuta ${driver.suit_size}`, driver.helmet_size && `Casco ${driver.helmet_size}`, driver.shoe_size && `Scarpe ${driver.shoe_size}`].filter(Boolean).join(" · ") || null} />
                    </div>

                    {expanded ? (
                      <div className="border-t border-neutral-200 bg-white p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-black text-neutral-900">Documenti e scadenze</h4>
                            <p className="text-sm font-semibold text-neutral-500">Licenze, certificati, liberatorie e file collegati al pilota.</p>
                          </div>
                        </div>

                        {docs.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Nessun documento registrato per questo pilota.</div>
                        ) : (
                          <div className="mb-4 grid gap-2">
                            {docs.map((doc) => {
                              const tone = expiryTone(doc.expires_at);
                              return (
                                <div key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <FileText className="h-4 w-4 text-neutral-500" />
                                      <span className="font-black text-neutral-900">{doc.title || getDocumentLabel(doc.document_type)}</span>
                                      <StatusPill tone={tone === "expired" ? "red" : tone === "expiring" ? "yellow" : tone === "ok" ? "green" : "neutral"}>
                                        {doc.expires_at ? `Scade ${formatDate(doc.expires_at)}` : "Senza scadenza"}
                                      </StatusPill>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold text-neutral-500">
                                      {getDocumentLabel(doc.document_type)} · {doc.document_number || "Numero non inserito"} · Emesso {formatDate(doc.issued_at)}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {doc.file_path ? (
                                      <button onClick={() => openDocument(doc)} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold hover:bg-neutral-50">
                                        <Eye className="h-4 w-4" /> Apri file
                                      </button>
                                    ) : null}
                                    {canEditDrivers ? (
                                      <button onClick={() => deleteDocument(doc)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" /> Elimina
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {canEditDrivers ? (
                          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                            <h5 className="mb-3 font-black text-neutral-900">Aggiungi documento</h5>
                            <div className="grid gap-3 md:grid-cols-3">
                              <UiField label="Tipo documento">
                                <select value={docForm.document_type} onChange={(e) => setDocForm((prev) => ({ ...prev, document_type: e.target.value }))} className={selectClass}>
                                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                </select>
                              </UiField>
                              <UiField label="Titolo">
                                <input value={docForm.title} onChange={(e) => setDocForm((prev) => ({ ...prev, title: e.target.value }))} className={inputClass} placeholder="Es. Licenza ACI 2026" />
                              </UiField>
                              <UiField label="Numero documento">
                                <input value={docForm.document_number} onChange={(e) => setDocForm((prev) => ({ ...prev, document_number: e.target.value }))} className={inputClass} placeholder="Numero / codice" />
                              </UiField>
                              <UiField label="Data emissione">
                                <input type="date" value={docForm.issued_at} onChange={(e) => setDocForm((prev) => ({ ...prev, issued_at: e.target.value }))} className={inputClass} />
                              </UiField>
                              <UiField label="Data scadenza">
                                <input type="date" value={docForm.expires_at} onChange={(e) => setDocForm((prev) => ({ ...prev, expires_at: e.target.value }))} className={inputClass} />
                              </UiField>
                              <UiField label="File PDF/immagine">
                                <input type="file" accept="application/pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className={inputClass} />
                              </UiField>
                              <UiField label="Note">
                                <textarea value={docForm.notes} onChange={(e) => setDocForm((prev) => ({ ...prev, notes: e.target.value }))} className={textAreaClass} placeholder="Note interne" />
                              </UiField>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button onClick={() => saveDocument(driver)} disabled={docSaving} className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:opacity-60">
                                <Upload className="h-4 w-4" /> {docSaving ? "Salvataggio..." : "Salva documento"}
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
        </div>
      </SectionCard>

      {open && canEditDrivers ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-neutral-900">{editId ? "Modifica pilota" : "Nuovo pilota"}</h2>
                <p className="mt-1 text-sm font-semibold text-neutral-500">Compila anagrafica, contatti, taglie e scadenze principali.</p>
              </div>
              <button onClick={resetDriverModal} className="rounded-full p-2 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                <UiField label="Nome">
                  <input value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} className={inputClass} placeholder="Nome" />
                </UiField>
                <UiField label="Cognome">
                  <input value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} className={inputClass} placeholder="Cognome" />
                </UiField>
                <UiField label="Nickname paddock">
                  <input value={form.nickname} onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))} className={inputClass} placeholder="Nickname" />
                </UiField>
                <UiField label="Numero gara">
                  <input value={form.racing_number} onChange={(e) => setForm((prev) => ({ ...prev, racing_number: e.target.value }))} className={inputClass} placeholder="Es. 27" />
                </UiField>
                <UiField label="Email">
                  <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className={inputClass} placeholder="email@team.com" />
                </UiField>
                <UiField label="Telefono">
                  <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className={inputClass} placeholder="Telefono" />
                </UiField>
                <UiField label="Data nascita">
                  <input type="date" value={form.date_of_birth} onChange={(e) => setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))} className={inputClass} />
                </UiField>
                <UiField label="Nazionalità">
                  <input value={form.nationality} onChange={(e) => setForm((prev) => ({ ...prev, nationality: e.target.value }))} className={inputClass} placeholder="Italia" />
                </UiField>
                <UiField label="Numero licenza">
                  <input value={form.license_number} onChange={(e) => setForm((prev) => ({ ...prev, license_number: e.target.value }))} className={inputClass} placeholder="Numero licenza" />
                </UiField>
                <UiField label="Categoria licenza">
                  <input value={form.license_category} onChange={(e) => setForm((prev) => ({ ...prev, license_category: e.target.value }))} className={inputClass} placeholder="Categoria" />
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
                  <input value={form.blood_type} onChange={(e) => setForm((prev) => ({ ...prev, blood_type: e.target.value }))} className={inputClass} placeholder="Es. 0+" />
                </UiField>
                <UiField label="Contatto emergenza">
                  <input value={form.emergency_contact_name} onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))} className={inputClass} placeholder="Nome contatto" />
                </UiField>
                <UiField label="Telefono emergenza">
                  <input value={form.emergency_contact_phone} onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))} className={inputClass} placeholder="Telefono emergenza" />
                </UiField>
                <UiField label="Taglia tuta">
                  <input value={form.suit_size} onChange={(e) => setForm((prev) => ({ ...prev, suit_size: e.target.value }))} className={inputClass} placeholder="Es. 52" />
                </UiField>
                <UiField label="Taglia casco">
                  <input value={form.helmet_size} onChange={(e) => setForm((prev) => ({ ...prev, helmet_size: e.target.value }))} className={inputClass} placeholder="Es. M" />
                </UiField>
                <UiField label="Numero scarpe">
                  <input value={form.shoe_size} onChange={(e) => setForm((prev) => ({ ...prev, shoe_size: e.target.value }))} className={inputClass} placeholder="Es. 42" />
                </UiField>
                <UiField label="Stato">
                  <select value={form.is_active ? "active" : "inactive"} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.value === "active" }))} className={selectClass}>
                    <option value="active">Attivo</option>
                    <option value="inactive">Non attivo</option>
                  </select>
                </UiField>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="mb-3 text-sm font-black text-neutral-800">Foto pilota</p>
                  <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                    {photoPreview ? <img src={photoPreview} alt="Anteprima pilota" className="h-full w-full object-cover" /> : <UserRound className="h-12 w-12 text-neutral-300" />}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setPhotoFile(file);
                      setPhotoPreview(file ? URL.createObjectURL(file) : null);
                    }}
                    className={inputClass}
                  />
                </div>
                <UiField label="Indirizzo">
                  <textarea value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className={textAreaClass} placeholder="Indirizzo / residenza" />
                </UiField>
                <UiField label="Note sportive/interne">
                  <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className={textAreaClass} placeholder="Note interne" />
                </UiField>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={resetDriverModal} className="rounded-xl border border-neutral-200 px-4 py-2 font-bold hover:bg-neutral-50">Annulla</button>
              <button onClick={saveDriver} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-2 font-bold text-black hover:bg-yellow-500 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> {saving ? "Salvataggio..." : editId ? "Salva modifiche" : "Crea pilota"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 truncate font-bold text-neutral-800">{value || "—"}</p>
    </div>
  );
}
