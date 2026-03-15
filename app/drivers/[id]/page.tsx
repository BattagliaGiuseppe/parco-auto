"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import {
  ArrowLeft,
  UserRound,
  Mail,
  Phone,
  IdCard,
  ShieldCheck,
  FileText,
  PlusCircle,
  CalendarDays,
  TriangleAlert,
  Save,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type DriverRow = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  birth_date: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  emergency_contact: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type LicenseRow = {
  id: string;
  driver_id: string;
  license_type: string;
  license_number: string | null;
  issued_by: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  file_url: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  driver_id: string;
  document_type: string;
  title: string | null;
  file_url: string;
  signed_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};

type EventEntryRow = {
  id: string;
  event_id: string;
  car_id: string | null;
  driver_id: string;
  role: string;
  notes: string | null;
  eventName: string;
  carName: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;

  const today = new Date();
  const target = new Date(value);

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();

  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function getExpiryTone(value: string | null | undefined) {
  const days = daysUntil(value);

  if (days === null) {
    return {
      label: "Nessuna scadenza",
      className: "bg-neutral-100 text-neutral-600",
      severity: 1 as const,
    };
  }

  if (days < 0) {
    return {
      label: "Scaduto",
      className: "bg-red-100 text-red-700",
      severity: 3 as const,
    };
  }

  if (days <= 30) {
    return {
      label: "In scadenza",
      className: "bg-yellow-100 text-yellow-700",
      severity: 2 as const,
    };
  }

  return {
    label: "Valido",
    className: "bg-green-100 text-green-700",
    severity: 1 as const,
  };
}

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params?.id as string;

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [entries, setEntries] = useState<EventEntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [savingLicense, setSavingLicense] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);

  const [licenseType, setLicenseType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [licenseExpiryDate, setLicenseExpiryDate] = useState("");
  const [licenseNotes, setLicenseNotes] = useState("");
  const [licenseFileUrl, setLicenseFileUrl] = useState("");

  const [documentType, setDocumentType] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFileUrl, setDocumentFileUrl] = useState("");
  const [documentSignedAt, setDocumentSignedAt] = useState("");
  const [documentExpiresAt, setDocumentExpiresAt] = useState("");
  const [documentNotes, setDocumentNotes] = useState("");

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const loadData = async () => {
    if (!driverId) return;

    try {
      setLoading(true);
      const ctx = await getCurrentTeamContext();

      const [
        { data: driverData, error: driverError },
        { data: licensesData, error: licensesError },
        { data: documentsData, error: documentsError },
        { data: entriesData, error: entriesError },
        { data: eventsData, error: eventsError },
        { data: carsData, error: carsError },
      ] = await Promise.all([
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
          .order("expiry_date", { ascending: true }),
        supabase
          .from("driver_documents")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("driver_id", driverId)
          .order("expires_at", { ascending: true }),
        supabase
          .from("driver_event_entries")
          .select("id, event_id, car_id, driver_id, role, notes")
          .eq("team_id", ctx.teamId)
          .eq("driver_id", driverId)
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, name")
          .eq("team_id", ctx.teamId),
        supabase
          .from("cars")
          .select("id, name")
          .eq("team_id", ctx.teamId),
      ]);

      if (driverError) throw driverError;
      if (licensesError) throw licensesError;
      if (documentsError) throw documentsError;
      if (entriesError) throw entriesError;
      if (eventsError) throw eventsError;
      if (carsError) throw carsError;

      const eventsMap = new Map((eventsData || []).map((row: any) => [row.id, row.name]));
      const carsMap = new Map((carsData || []).map((row: any) => [row.id, row.name]));

      setDriver(driverData as DriverRow);
      setLicenses((licensesData || []) as LicenseRow[]);
      setDocuments((documentsData || []) as DocumentRow[]);
      setEntries(
        ((entriesData || []) as any[]).map((row) => ({
          ...row,
          eventName: eventsMap.get(row.event_id) || "Evento",
          carName: row.car_id ? carsMap.get(row.car_id) || "Auto" : "—",
        }))
      );
    } catch (error: any) {
      console.error("Errore caricamento pilota:", error);
      showToast(error.message || "Errore caricamento pilota", "error");
      setDriver(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [driverId]);

  const nearestLicense = useMemo(() => {
    return [...licenses]
      .filter((item) => item.expiry_date)
      .sort(
        (a, b) =>
          new Date(a.expiry_date || "").getTime() -
          new Date(b.expiry_date || "").getTime()
      )[0] || null;
  }, [licenses]);

  const nearestDocument = useMemo(() => {
    return [...documents]
      .filter((item) => item.expires_at)
      .sort(
        (a, b) =>
          new Date(a.expires_at || "").getTime() -
          new Date(b.expires_at || "").getTime()
      )[0] || null;
  }, [documents]);

  const addLicense = async () => {
    if (!driverId || !licenseType.trim()) {
      showToast("Compila almeno il tipo licenza", "error");
      return;
    }

    try {
      setSavingLicense(true);
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.from("driver_licenses").insert([
        {
          team_id: ctx.teamId,
          driver_id: driverId,
          license_type: licenseType.trim(),
          license_number: licenseNumber.trim() || null,
          issued_by: issuedBy.trim() || null,
          issue_date: issueDate || null,
          expiry_date: licenseExpiryDate || null,
          notes: licenseNotes.trim() || null,
          file_url: licenseFileUrl.trim() || null,
        },
      ]);

      if (error) throw error;

      setLicenseType("");
      setLicenseNumber("");
      setIssuedBy("");
      setIssueDate("");
      setLicenseExpiryDate("");
      setLicenseNotes("");
      setLicenseFileUrl("");

      showToast("Licenza aggiunta correttamente");
      await loadData();
    } catch (error: any) {
      console.error("Errore inserimento licenza:", error);
      showToast(error.message || "Errore inserimento licenza", "error");
    } finally {
      setSavingLicense(false);
    }
  };

  const addDocument = async () => {
    if (!driverId || !documentType.trim() || !documentFileUrl.trim()) {
      showToast("Compila tipo documento e file URL", "error");
      return;
    }

    try {
      setSavingDocument(true);
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.from("driver_documents").insert([
        {
          team_id: ctx.teamId,
          driver_id: driverId,
          document_type: documentType.trim(),
          title: documentTitle.trim() || null,
          file_url: documentFileUrl.trim(),
          signed_at: documentSignedAt || null,
          expires_at: documentExpiresAt || null,
          notes: documentNotes.trim() || null,
        },
      ]);

      if (error) throw error;

      setDocumentType("");
      setDocumentTitle("");
      setDocumentFileUrl("");
      setDocumentSignedAt("");
      setDocumentExpiresAt("");
      setDocumentNotes("");

      showToast("Documento aggiunto correttamente");
      await loadData();
    } catch (error: any) {
      console.error("Errore inserimento documento:", error);
      showToast(error.message || "Errore inserimento documento", "error");
    } finally {
      setSavingDocument(false);
    }
  };

  if (loading) {
    return (
      <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
        Caricamento pilota...
      </div>
    );
  }

  if (!driver) {
    return (
      <div className={`card-base p-10 text-center ${audiowide.className}`}>
        <p className="text-red-600 font-semibold">Pilota non trovato.</p>
      </div>
    );
  }

  const licenseTone = nearestLicense ? getExpiryTone(nearestLicense.expiry_date) : null;
  const documentTone = nearestDocument ? getExpiryTone(nearestDocument.expires_at) : null;

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <UserRound size={14} />
                Scheda pilota
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                {driver.first_name} {driver.last_name}
              </h1>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {driver.nickname ? (
                  <span className="rounded-full px-3 py-1 font-semibold bg-white/10 text-yellow-100">
                    {driver.nickname}
                  </span>
                ) : null}

                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    driver.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {driver.is_active ? "Attivo" : "Non attivo"}
                </span>

                {licenseTone ? (
                  <span className={`rounded-full px-3 py-1 font-semibold ${licenseTone.className}`}>
                    Licenza: {licenseTone.label}
                  </span>
                ) : null}

                {documentTone ? (
                  <span className={`rounded-full px-3 py-1 font-semibold ${documentTone.className}`}>
                    Documenti: {documentTone.label}
                  </span>
                ) : null}
              </div>
            </div>

            <Link
              href="/drivers"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-yellow-400 font-semibold"
            >
              <ArrowLeft size={16} /> Torna ai piloti
            </Link>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<ShieldCheck size={18} className="text-yellow-600" />}
              label="Licenze"
              value={String(licenses.length)}
            />
            <SummaryCard
              icon={<FileText size={18} className="text-yellow-600" />}
              label="Documenti"
              value={String(documents.length)}
            />
            <SummaryCard
              icon={<CalendarDays size={18} className="text-yellow-600" />}
              label="Eventi collegati"
              value={String(entries.length)}
            />
            <SummaryCard
              icon={<TriangleAlert size={18} className="text-yellow-600" />}
              label="Stato scadenze"
              value={
                licenseTone?.severity === 3 || documentTone?.severity === 3
                  ? "Critico"
                  : licenseTone?.severity === 2 || documentTone?.severity === 2
                  ? "Attenzione"
                  : "OK"
              }
              valueClassName={
                licenseTone?.severity === 3 || documentTone?.severity === 3
                  ? "text-red-700"
                  : licenseTone?.severity === 2 || documentTone?.severity === 2
                  ? "text-yellow-700"
                  : "text-green-700"
              }
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card-base p-5 md:p-6 xl:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <UserRound className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Dati anagrafici</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <InfoCard
              icon={<Mail size={16} className="text-yellow-600" />}
              title="Email"
              value={driver.email || "—"}
            />
            <InfoCard
              icon={<Phone size={16} className="text-yellow-600" />}
              title="Telefono"
              value={driver.phone || "—"}
            />
            <InfoCard
              icon={<IdCard size={16} className="text-yellow-600" />}
              title="Nazionalità"
              value={driver.nationality || "—"}
            />
            <InfoCard
              icon={<CalendarDays size={16} className="text-yellow-600" />}
              title="Data nascita"
              value={formatDate(driver.birth_date)}
            />
            <InfoCard
              icon={<Phone size={16} className="text-yellow-600" />}
              title="Contatto emergenza"
              value={driver.emergency_contact || "—"}
            />
            <InfoCard
              icon={<UserRound size={16} className="text-yellow-600" />}
              title="Nickname"
              value={driver.nickname || "—"}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs text-neutral-500">Note</div>
            <div className="mt-2 text-sm text-neutral-800 whitespace-pre-line">
              {driver.notes?.trim() || "Nessuna nota inserita"}
            </div>
          </div>
        </div>

        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <TriangleAlert className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Scadenze</h2>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <StatusBox
              label="Licenza più vicina"
              badge={
                nearestLicense
                  ? `${licenseTone?.label} • ${formatDate(nearestLicense.expiry_date)}`
                  : "Nessuna licenza"
              }
              className={licenseTone?.className || "bg-neutral-100 text-neutral-600"}
            />

            <StatusBox
              label="Documento più vicino"
              badge={
                nearestDocument
                  ? `${documentTone?.label} • ${formatDate(nearestDocument.expires_at)}`
                  : "Nessun documento"
              }
              className={documentTone?.className || "bg-neutral-100 text-neutral-600"}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={18} className="text-yellow-600" />
            <h2 className="text-lg font-bold text-neutral-800">Licenze</h2>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input-base"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                placeholder="Tipo licenza *"
              />
              <input
                className="input-base"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="Numero licenza"
              />
              <input
                className="input-base"
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                placeholder="Ente emittente"
              />
              <input
                type="date"
                className="input-base"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
              <input
                type="date"
                className="input-base"
                value={licenseExpiryDate}
                onChange={(e) => setLicenseExpiryDate(e.target.value)}
              />
              <input
                className="input-base"
                value={licenseFileUrl}
                onChange={(e) => setLicenseFileUrl(e.target.value)}
                placeholder="URL file"
              />
            </div>

            <textarea
              className="input-base min-h-[110px]"
              value={licenseNotes}
              onChange={(e) => setLicenseNotes(e.target.value)}
              placeholder="Note licenza..."
            />

            <button onClick={addLicense} disabled={savingLicense} className="btn-primary self-start">
              <Save size={18} />
              {savingLicense ? "Salvataggio..." : "Aggiungi licenza"}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {licenses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 text-center">
                Nessuna licenza registrata.
              </div>
            ) : (
              licenses.map((license) => {
                const tone = getExpiryTone(license.expiry_date);

                return (
                  <div key={license.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-neutral-900">{license.license_type}</div>
                        <div className="text-sm text-neutral-500 mt-1">
                          {license.license_number || "Numero non inserito"}
                        </div>
                      </div>

                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.className}`}>
                        {tone.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <MiniInfoCard label="Ente" value={license.issued_by || "—"} />
                      <MiniInfoCard label="Emissione" value={formatDate(license.issue_date)} />
                      <MiniInfoCard label="Scadenza" value={formatDate(license.expiry_date)} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card-base p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-yellow-600" />
            <h2 className="text-lg font-bold text-neutral-800">Documenti</h2>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input-base"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                placeholder="Tipo documento *"
              />
              <input
                className="input-base"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Titolo"
              />
              <input
                className="input-base md:col-span-2"
                value={documentFileUrl}
                onChange={(e) => setDocumentFileUrl(e.target.value)}
                placeholder="URL file *"
              />
              <input
                type="datetime-local"
                className="input-base"
                value={documentSignedAt}
                onChange={(e) => setDocumentSignedAt(e.target.value)}
              />
              <input
                type="date"
                className="input-base"
                value={documentExpiresAt}
                onChange={(e) => setDocumentExpiresAt(e.target.value)}
              />
            </div>

            <textarea
              className="input-base min-h-[110px]"
              value={documentNotes}
              onChange={(e) => setDocumentNotes(e.target.value)}
              placeholder="Note documento..."
            />

            <button onClick={addDocument} disabled={savingDocument} className="btn-primary self-start">
              <PlusCircle size={18} />
              {savingDocument ? "Salvataggio..." : "Aggiungi documento"}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 text-center">
                Nessun documento registrato.
              </div>
            ) : (
              documents.map((document) => {
                const tone = getExpiryTone(document.expires_at);

                return (
                  <div key={document.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-neutral-900">
                          {document.title || document.document_type}
                        </div>
                        <div className="text-sm text-neutral-500 mt-1">
                          {document.document_type}
                        </div>
                      </div>

                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.className}`}>
                        {tone.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <MiniInfoCard label="Firmato" value={formatDate(document.signed_at)} />
                      <MiniInfoCard label="Scadenza" value={formatDate(document.expires_at)} />
                      <MiniInfoCard
                        label="File"
                        value={document.file_url ? "Disponibile" : "—"}
                      />
                    </div>

                    {document.file_url ? (
                      <div className="mt-3">
                        <a
                          href={document.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                        >
                          Apri documento
                        </a>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="card-base p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={18} className="text-yellow-600" />
          <h2 className="text-lg font-bold text-neutral-800">Eventi collegati</h2>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 text-center">
            Nessun evento collegato al pilota.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="p-3 text-left">Evento</th>
                  <th className="p-3 text-left">Auto</th>
                  <th className="p-3 text-left">Ruolo</th>
                  <th className="p-3 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-neutral-200">
                    <td className="p-3">{entry.eventName}</td>
                    <td className="p-3">{entry.carName}</td>
                    <td className="p-3">{entry.role}</td>
                    <td className="p-3">{entry.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-lg font-semibold ${
            toast.type === "success"
              ? "bg-yellow-400 text-black"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="border rounded-xl p-4 bg-neutral-50">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{title}</span>
      </div>
      <div className="text-base font-bold text-neutral-900 mt-2 break-words">{value}</div>
    </div>
  );
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900 break-words">{value}</div>
    </div>
  );
}

function StatusBox({
  label,
  badge,
  className,
}: {
  label: string;
  badge: string;
  className: string;
}) {
  return (
    <div className="border rounded-xl p-4 bg-neutral-50">
      <div className="text-sm text-neutral-600 mb-2">{label}</div>
      <span className={`inline-flex items-center rounded-full px-3 py-1 font-semibold text-sm ${className}`}>
        {badge}
      </span>
    </div>
  );
}
