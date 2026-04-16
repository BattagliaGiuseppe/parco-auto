"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  FileText,
  Pencil,
  PlusCircle,
  Printer,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { uploadTeamFile } from "@/lib/storage";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";

type SafetyItem = {
  id?: string;
  item_name: string;
  homologation: string;
  expiry_date: string;
  note: string;
  is_present: boolean;
};

const DEFAULT_SAFETY_ITEMS: SafetyItem[] = [
  { item_name: "Casco", homologation: "", expiry_date: "", note: "", is_present: true },
  { item_name: "HANS / FHR", homologation: "", expiry_date: "", note: "", is_present: true },
  { item_name: "Tuta", homologation: "", expiry_date: "", note: "", is_present: true },
  { item_name: "Intimo ignifugo", homologation: "", expiry_date: "", note: "", is_present: true },
  { item_name: "Guanti", homologation: "", expiry_date: "", note: "", is_present: true },
  { item_name: "Scarpe", homologation: "", expiry_date: "", note: "", is_present: true },
];

function EmptySafetyState({ onPrefill }: { onPrefill?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
      Nessuna checklist sicurezza registrata.
      {onPrefill ? (
        <button
          onClick={onPrefill}
          className="ml-3 inline-flex rounded-xl bg-yellow-400 px-3 py-2 font-semibold text-black hover:bg-yellow-500"
        >
          Carica checklist base
        </button>
      ) : null}
    </div>
  );
}

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params?.id as string;

  const access = usePermissionAccess();
  const canViewDrivers = access.hasPermission("drivers.view");
  const canEditDrivers = access.hasPermission("drivers.edit", ["owner", "admin"]);

  const [driver, setDriver] = useState<any>(null);
  const [driverForm, setDriverForm] = useState<any>(null);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [safetyItems, setSafetyItems] = useState<SafetyItem[]>([]);
  const [licenseForm, setLicenseForm] = useState({
    license_type: "",
    license_number: "",
    expiry_date: "",
    issued_by: "",
  });
  const [documentForm, setDocumentForm] = useState({
    title: "",
    document_type: "",
    expires_at: "",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSafety, setSavingSafety] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [licenseDraft, setLicenseDraft] = useState({
    license_type: "",
    license_number: "",
    expiry_date: "",
    issued_by: "",
  });

  async function load() {
    const ctx = await getCurrentTeamContext();
    const [driverRes, licensesRes, documentsRes, safetyRes] = await Promise.all([
      supabase
        .from("drivers")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("id", driverId)
        .single(),
      supabase
        .from("driver_licenses")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false }),
      supabase
        .from("driver_documents")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false }),
      supabase
        .from("driver_safety_items")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("driver_id", driverId)
        .order("created_at", { ascending: true }),
    ]);

    const loadedDriver = driverRes.data;
    setDriver(loadedDriver);
    setDriverForm(loadedDriver);
    setLicenses(licensesRes.data || []);
    setDocuments(documentsRes.data || []);
    setSafetyItems(
      (safetyRes.data || []).map((row: any) => ({
        id: row.id,
        item_name: row.item_name || "",
        homologation: row.homologation || "",
        expiry_date: row.expiry_date || "",
        note: row.note || "",
        is_present: row.is_present ?? true,
      }))
    );
  }

  useEffect(() => {
    if (driverId && !access.loading && canViewDrivers) {
      void load();
    }
  }, [driverId, access.loading, canViewDrivers]);

  function showFeedback(type: "success" | "error" | "info", message: string) {
    setFeedback({ type, message });
  }

  const activeSafetyItems = useMemo(
    () => safetyItems.filter((item) => item.is_present),
    [safetyItems]
  );

async function saveProfile() {
  if (!canEditDrivers || !driverForm) return;
  setSavingProfile(true);
  setFeedback(null);
  try {
    const ctx = await getCurrentTeamContext();
    let photoUrl = driverForm.photo_url || null;

    if (profilePhotoFile) {
      setUploadingPhoto(true);
      const upload = await uploadTeamFile({
        file: profilePhotoFile,
        area: "driver-profile",
        recordId: driverId,
      });
      photoUrl = upload.publicUrl;
    }

    const payload = {
      first_name: driverForm.first_name?.trim() || "",
      last_name: driverForm.last_name?.trim() || "",
      nickname: driverForm.nickname || null,
      birth_date: driverForm.birth_date || null,
      nationality: driverForm.nationality || null,
      email: driverForm.email || null,
      phone: driverForm.phone || null,
      emergency_contact: driverForm.emergency_contact || null,
      notes: driverForm.notes || null,
      is_active: driverForm.is_active ?? true,
      photo_url: photoUrl,
    };

    const { error } = await supabase
      .from("drivers")
      .update(payload)
      .eq("team_id", ctx.teamId)
      .eq("id", driverId);

    if (error) throw error;
    setProfilePhotoFile(null);
    await load();
    showFeedback("success", "Scheda pilota aggiornata correttamente.");
  } catch (error: any) {
    console.error(error);
    showFeedback("error", error?.message || "Errore aggiornamento pilota");
  } finally {
    setUploadingPhoto(false);
    setSavingProfile(false);
  }
}

async function addLicense() {
  if (!canEditDrivers) return;
  const ctx = await getCurrentTeamContext();
  setFeedback(null);
  if (!licenseForm.license_type.trim()) {
    showFeedback("error", "Inserisci almeno il tipo licenza.");
    return;
  }

  const { error } = await supabase.from("driver_licenses").insert([
    {
      team_id: ctx.teamId,
      driver_id: driverId,
      ...licenseForm,
    },
  ]);

  if (error) {
    showFeedback("error", error.message);
    return;
  }

  setLicenseForm({
    license_type: "",
    license_number: "",
    expiry_date: "",
    issued_by: "",
  });
  await load();
  showFeedback("success", "Licenza aggiunta correttamente.");
}

async function addDocument() {
  if (!canEditDrivers) return;
  const ctx = await getCurrentTeamContext();
  setFeedback(null);

  if (!documentForm.title.trim() && !documentForm.document_type.trim() && !documentFile) {
    showFeedback("error", "Inserisci almeno titolo o tipo documento, oppure carica un file.");
    return;
  }

  let payload: any = {
    team_id: ctx.teamId,
    driver_id: driverId,
    title: documentForm.title || documentForm.document_type || "Documento pilota",
    document_type: documentForm.document_type || null,
    expires_at: documentForm.expires_at || null,
    uploaded_by_team_user_id: ctx.teamUserId,
  };

  if (documentFile) {
    const upload = await uploadTeamFile({
      file: documentFile,
      area: "driver-documents",
      recordId: driverId,
    });
    payload = {
      ...payload,
      file_url: upload.publicUrl,
      file_name: upload.fileName,
      storage_path: upload.path,
      mime_type: upload.mimeType,
      size_bytes: upload.sizeBytes,
    };
  }

  const { error } = await supabase.from("driver_documents").insert([payload]);
  if (error) {
    showFeedback("error", error.message);
    return;
  }

  setDocumentForm({ title: "", document_type: "", expires_at: "" });
  setDocumentFile(null);
  await load();
  showFeedback("success", "Documento aggiunto correttamente.");
}

  function seedDefaultSafetyItems() {
    setSafetyItems(DEFAULT_SAFETY_ITEMS.map((item) => ({ ...item })));
  }

  function updateSafetyItem(index: number, patch: Partial<SafetyItem>) {
    setSafetyItems((prev) =>
      prev.map((item, currentIndex) =>
        currentIndex === index ? { ...item, ...patch } : item
      )
    );
  }

  function addSafetyItemRow() {
    setSafetyItems((prev) => [
      ...prev,
      {
        item_name: "",
        homologation: "",
        expiry_date: "",
        note: "",
        is_present: true,
      },
    ]);
  }

  function removeSafetyItemRow(index: number) {
    setSafetyItems((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  function startEditLicense(row: any) {
    setEditingLicenseId(row.id);
    setLicenseDraft({
      license_type: row.license_type || "",
      license_number: row.license_number || "",
      expiry_date: row.expiry_date || "",
      issued_by: row.issued_by || "",
    });
    setFeedback(null);
  }

  function cancelEditLicense() {
    setEditingLicenseId(null);
    setLicenseDraft({
      license_type: "",
      license_number: "",
      expiry_date: "",
      issued_by: "",
    });
  }

  async function saveEditedLicense() {
    if (!canEditDrivers || !editingLicenseId) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);

    if (!licenseDraft.license_type.trim()) {
      showFeedback("error", "Inserisci almeno il tipo licenza.");
      return;
    }

    const { error } = await supabase
      .from("driver_licenses")
      .update({
        license_type: licenseDraft.license_type,
        license_number: licenseDraft.license_number || null,
        expiry_date: licenseDraft.expiry_date || null,
        issued_by: licenseDraft.issued_by || null,
      })
      .eq("team_id", ctx.teamId)
      .eq("id", editingLicenseId);

    if (error) {
      showFeedback("error", error.message);
      return;
    }

    cancelEditLicense();
    await load();
    showFeedback("success", "Licenza aggiornata correttamente.");
  }

  async function deleteLicense(licenseId: string) {
    if (!canEditDrivers) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const { error } = await supabase
      .from("driver_licenses")
      .delete()
      .eq("team_id", ctx.teamId)
      .eq("id", licenseId);

    if (error) {
      showFeedback("error", error.message);
      return;
    }

    if (editingLicenseId === licenseId) {
      cancelEditLicense();
    }

    await load();
    showFeedback("success", "Licenza eliminata.");
  }

  async function deleteDocument(documentId: string) {
    if (!canEditDrivers) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const { error } = await supabase
      .from("driver_documents")
      .delete()
      .eq("team_id", ctx.teamId)
      .eq("id", documentId);

    if (error) {
      showFeedback("error", error.message);
      return;
    }

    await load();
    showFeedback("success", "Documento eliminato.");
  }

  async function saveSafetyItems() {
    if (!canEditDrivers) return;
    setSavingSafety(true);
    setFeedback(null);
    try {
      const ctx = await getCurrentTeamContext();
      const normalized = safetyItems
        .map((item) => ({
          item_name: item.item_name.trim(),
          homologation: item.homologation.trim(),
          expiry_date: item.expiry_date || null,
          note: item.note.trim() || null,
          is_present: item.is_present,
        }))
        .filter((item) => item.item_name.length > 0);

      const { error: deleteError } = await supabase
        .from("driver_safety_items")
        .delete()
        .eq("team_id", ctx.teamId)
        .eq("driver_id", driverId);

      if (deleteError) throw deleteError;

      if (normalized.length > 0) {
        const { error: insertError } = await supabase.from("driver_safety_items").insert(
          normalized.map((item) => ({
            team_id: ctx.teamId,
            driver_id: driverId,
            ...item,
          }))
        );
        if (insertError) throw insertError;
      }

      await load();
      showFeedback("success", "Checklist sicurezza aggiornata correttamente.");
    } catch (error: any) {
      console.error(error);
      showFeedback("error", error?.message || "Errore salvataggio checklist sicurezza");
    } finally {
      setSavingSafety(false);
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Scheda pilota"
        subtitle="Dati anagrafici, sicurezza, documenti e stampa"
        icon={<UserRound size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Scheda pilota"
        subtitle="Dati anagrafici, sicurezza, documenti e stampa"
        icon={<UserRound size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewDrivers) {
    return (
      <PagePermissionState
        title="Scheda pilota"
        subtitle="Dati anagrafici, sicurezza, documenti e stampa"
        icon={<UserRound size={22} />}
        state="denied"
        message="Il tuo ruolo non può aprire la scheda pilota."
      />
    );
  }

  if (!driver || !driverForm) {
    return <div className="p-6 text-neutral-500">Caricamento pilota...</div>;
  }

  const driverFullName = `${driver.first_name || ""} ${driver.last_name || ""}`.trim();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={driverFullName || "Scheda pilota"}
        subtitle="Anagrafica completa, dotazione sicurezza, documenti e stampa"
        icon={<UserRound size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/drivers/${driver.id}/performance`}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
            >
              Performance
            </Link>
            <Link
              href={`/drivers/${driver.id}/print`}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <Printer size={16} className="mr-2 inline" />
              Stampa scheda
            </Link>
            <Link
              href="/drivers"
              className="rounded-xl bg-neutral-100 px-4 py-2 text-neutral-700 hover:bg-neutral-200"
            >
              <ArrowLeft size={16} className="mr-2 inline" />
              Indietro
            </Link>
          </div>
        }
      />

      {!canEditDrivers ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura alla scheda pilota.
        </div>
      ) : null}

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard>
        <StatsGrid
          items={[
            { label: "Licenze", value: String(licenses.length), icon: <ShieldCheck size={18} /> },
            { label: "Documenti", value: String(documents.length), icon: <FileText size={18} /> },
            {
              label: "Dotazione sicurezza",
              value: String(activeSafetyItems.length),
              icon: <ShieldCheck size={18} />,
            },
            { label: "Email", value: driver.email || "—" },
          ]}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <SectionCard
          title="Profilo pilota"
          subtitle="Dati anagrafici principali, note e foto profilo"
        >
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            {driverForm.photo_url ? (
              <img
                src={driverForm.photo_url}
                alt={driverFullName || "Profilo pilota"}
                className="h-36 w-36 rounded-full object-cover ring-4 ring-white shadow-sm"
              />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-full bg-neutral-200 text-4xl font-bold text-neutral-500">
                {(driver.first_name?.[0] || "") + (driver.last_name?.[0] || "") || "P"}
              </div>
            )}
            {canEditDrivers ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
                <Camera size={16} />
                {uploadingPhoto ? "Caricamento foto..." : "Seleziona foto profilo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setProfilePhotoFile(e.target.files?.[0] || null)}
                />
              </label>
            ) : null}
            {profilePhotoFile ? (
              <div className="text-xs text-neutral-500">{profilePhotoFile.name}</div>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Nome"
              value={driverForm.first_name || ""}
              disabled={!canEditDrivers}
              onChange={(value) => setDriverForm({ ...driverForm, first_name: value })}
            />
            <Field
              label="Cognome"
              value={driverForm.last_name || ""}
              disabled={!canEditDrivers}
              onChange={(value) => setDriverForm({ ...driverForm, last_name: value })}
            />
            <Field
              label="Nickname"
              value={driverForm.nickname || ""}
              disabled={!canEditDrivers}
              onChange={(value) => setDriverForm({ ...driverForm, nickname: value })}
            />
            <Field
              label="Nazione"
              value={driverForm.nationality || ""}
              disabled={!canEditDrivers}
              onChange={(value) => setDriverForm({ ...driverForm, nationality: value })}
            />
            <Field
              label="Email"
              type="email"
              value={driverForm.email || ""}
              disabled={!canEditDrivers}
              onChange={(value) => setDriverForm({ ...driverForm, email: value })}
            />
            <Field
              label="Telefono"
              value={driverForm.phone || ""}
              disabled={!canEditDrivers}
              onChange={(value) => setDriverForm({ ...driverForm, phone: value })}
            />
            <Field
              label="Data di nascita"
              type="date"
              value={driverForm.birth_date || ""}
              disabled={!canEditDrivers}
              onChange={(value) => setDriverForm({ ...driverForm, birth_date: value })}
            />
            <Field
              label="Contatto emergenza"
              value={driverForm.emergency_contact || ""}
              disabled={!canEditDrivers}
              onChange={(value) =>
                setDriverForm({ ...driverForm, emergency_contact: value })
              }
            />
          </div>

          <div className="mt-4">
            <Label>Note</Label>
            <textarea
              disabled={!canEditDrivers}
              className={`min-h-32 w-full rounded-xl border px-4 py-3 ${
                !canEditDrivers ? "bg-neutral-100 text-neutral-500" : "bg-white"
              }`}
              value={driverForm.notes || ""}
              onChange={(e) => setDriverForm({ ...driverForm, notes: e.target.value })}
              placeholder="Note tecniche, preferenze, taglia sedile, contatti paddock..."
            />
          </div>

          {canEditDrivers ? (
            <div className="mt-4 flex justify-end">
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:opacity-60"
              >
                <Save size={16} className="mr-2 inline" />
                {savingProfile ? "Salvataggio..." : "Salva scheda pilota"}
              </button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Checklist sicurezza pilota"
          subtitle="Indumenti e dispositivi con omologazione, scadenza e note"
        >
          {safetyItems.length === 0 ? (
            <EmptySafetyState onPrefill={canEditDrivers ? seedDefaultSafetyItems : undefined} />
          ) : (
            <div className="space-y-3">
              {safetyItems.map((item, index) => (
                <div
                  key={`${item.id || "new"}-${index}`}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr_180px_1.2fr_56px]">
                    <Field
                      label="Elemento"
                      value={item.item_name}
                      disabled={!canEditDrivers}
                      onChange={(value) => updateSafetyItem(index, { item_name: value })}
                    />
                    <Field
                      label="Omologazione"
                      value={item.homologation}
                      disabled={!canEditDrivers}
                      onChange={(value) => updateSafetyItem(index, { homologation: value })}
                    />
                    <Field
                      label="Scadenza"
                      type="date"
                      value={item.expiry_date || ""}
                      disabled={!canEditDrivers}
                      onChange={(value) => updateSafetyItem(index, { expiry_date: value })}
                    />
                    <div>
                      <Label>Nota tecnica</Label>
                      <textarea
                        disabled={!canEditDrivers}
                        className={`min-h-12 w-full rounded-xl border px-4 py-3 ${
                          !canEditDrivers ? "bg-neutral-100 text-neutral-500" : "bg-white"
                        }`}
                        value={item.note}
                        onChange={(e) => updateSafetyItem(index, { note: e.target.value })}
                        placeholder="Taglia, stato, rilievo tecnico..."
                      />
                    </div>
                    <div className="flex flex-col justify-between gap-2">
                      <label className="mt-7 flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-700">
                        <input
                          type="checkbox"
                          disabled={!canEditDrivers}
                          checked={item.is_present}
                          onChange={(e) =>
                            updateSafetyItem(index, { is_present: e.target.checked })
                          }
                        />
                        OK
                      </label>
                      {canEditDrivers ? (
                        <button
                          onClick={() => removeSafetyItemRow(index)}
                          className="inline-flex items-center justify-center rounded-xl bg-red-50 px-3 py-3 text-red-600 hover:bg-red-100"
                          title="Rimuovi riga"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canEditDrivers ? (
            <div className="mt-4 flex flex-wrap justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={addSafetyItemRow}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <PlusCircle size={16} className="mr-2 inline" />
                  Aggiungi elemento
                </button>
                <button
                  onClick={seedDefaultSafetyItems}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Carica checklist base
                </button>
              </div>
              <button
                onClick={saveSafetyItems}
                disabled={savingSafety}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:opacity-60"
              >
                <Save size={16} className="mr-2 inline" />
                {savingSafety ? "Salvataggio..." : "Salva checklist sicurezza"}
              </button>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Licenze" subtitle="Storico e scadenze">
          {canEditDrivers ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Field
                  label="Tipo licenza"
                  value={licenseForm.license_type}
                  onChange={(value) =>
                    setLicenseForm({ ...licenseForm, license_type: value })
                  }
                />
                <Field
                  label="Numero"
                  value={licenseForm.license_number}
                  onChange={(value) =>
                    setLicenseForm({ ...licenseForm, license_number: value })
                  }
                />
                <Field
                  label="Ente"
                  value={licenseForm.issued_by}
                  onChange={(value) => setLicenseForm({ ...licenseForm, issued_by: value })}
                />
                <Field
                  label="Scadenza"
                  type="date"
                  value={licenseForm.expiry_date}
                  onChange={(value) =>
                    setLicenseForm({ ...licenseForm, expiry_date: value })
                  }
                />
              </div>
              <div className="mt-3">
                <button
                  onClick={addLicense}
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                >
                  <PlusCircle size={16} className="mr-2 inline" />
                  Aggiungi licenza
                </button>
              </div>
            </>
          ) : null}
<div className="mt-4 space-y-3">
  {licenses.length === 0 ? (
    <EmptyState title="Nessuna licenza registrata" />
  ) : (
    licenses.map((row) => {
      const isEditing = editingLicenseId === row.id;
      return (
        <div
          key={row.id}
          className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
        >
          {isEditing ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Field
                  label="Tipo licenza"
                  value={licenseDraft.license_type}
                  onChange={(value) =>
                    setLicenseDraft({ ...licenseDraft, license_type: value })
                  }
                />
                <Field
                  label="Numero"
                  value={licenseDraft.license_number}
                  onChange={(value) =>
                    setLicenseDraft({ ...licenseDraft, license_number: value })
                  }
                />
                <Field
                  label="Ente"
                  value={licenseDraft.issued_by}
                  onChange={(value) =>
                    setLicenseDraft({ ...licenseDraft, issued_by: value })
                  }
                />
                <Field
                  label="Scadenza"
                  type="date"
                  value={licenseDraft.expiry_date}
                  onChange={(value) =>
                    setLicenseDraft({ ...licenseDraft, expiry_date: value })
                  }
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  onClick={cancelEditLicense}
                  className="inline-flex rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <X size={15} className="mr-2 inline" />
                  Annulla
                </button>
                <button
                  onClick={saveEditedLicense}
                  className="inline-flex rounded-xl bg-yellow-400 px-3 py-2 text-sm font-bold text-black hover:bg-yellow-500"
                >
                  <Save size={15} className="mr-2 inline" />
                  Salva licenza
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-bold text-neutral-900">{row.license_type}</div>
                <div className="mt-1 text-sm text-neutral-500">
                  {row.license_number || "Numero non inserito"}
                  {row.issued_by ? ` · ${row.issued_by}` : ""}
                  {row.expiry_date
                    ? ` · scade il ${new Date(row.expiry_date).toLocaleDateString("it-IT")}`
                    : ""}
                </div>
              </div>
              {canEditDrivers ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => startEditLicense(row)}
                    className="inline-flex rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <Pencil size={15} className="mr-2 inline" />
                    Modifica
                  </button>
                  <button
                    onClick={() => deleteLicense(row.id)}
                    className="inline-flex rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                  >
                    <Trash2 size={15} className="mr-2 inline" />
                    Elimina
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      );
    })
  )}
</div>
        </SectionCard>

        <SectionCard title="Documenti" subtitle="File pilota, certificati e allegati">
          {canEditDrivers ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field
                  label="Titolo"
                  value={documentForm.title}
                  onChange={(value) => setDocumentForm({ ...documentForm, title: value })}
                />
                <Field
                  label="Tipo documento"
                  value={documentForm.document_type}
                  onChange={(value) =>
                    setDocumentForm({ ...documentForm, document_type: value })
                  }
                />
                <Field
                  label="Scadenza"
                  type="date"
                  value={documentForm.expires_at}
                  onChange={(value) =>
                    setDocumentForm({ ...documentForm, expires_at: value })
                  }
                />
                <div className="md:col-span-3">
                  <Label>File</Label>
                  <input
                    className="w-full rounded-xl border px-4 py-3"
                    type="file"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={addDocument}
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                >
                  <PlusCircle size={16} className="mr-2 inline" />
                  Aggiungi documento
                </button>
              </div>
            </>
          ) : null}
<div className="mt-4 space-y-3">
  {documents.length === 0 ? (
    <EmptyState title="Nessun documento registrato" />
  ) : (
    documents.map((row) => (
      <div
        key={row.id}
        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-bold text-neutral-900">
              {row.title || row.document_type || "Documento pilota"}
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              {row.expires_at
                ? `Scadenza ${new Date(row.expires_at).toLocaleDateString("it-IT")}`
                : "Nessuna scadenza"}
              {row.file_name ? ` · ${row.file_name}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.file_url ? (
              <a
                href={row.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Apri file
              </a>
            ) : null}
            {canEditDrivers ? (
              <button
                onClick={() => deleteDocument(row.id)}
                className="inline-flex rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                <Trash2 size={15} className="mr-2 inline" />
                Elimina
              </button>
            ) : null}
          </div>
        </div>
      </div>
    ))
  )}
</div>
        </SectionCard>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-semibold text-neutral-700">
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        disabled={disabled}
        className={`w-full rounded-xl border px-4 py-3 ${
          disabled ? "bg-neutral-100 text-neutral-500" : "bg-white"
        }`}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
