"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound, Mail, Phone, FileText, Activity } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

type DriverRow = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active?: boolean | null;
};

type LicenseRow = {
  id: string;
  license_type: string;
  license_number: string | null;
  expiry_date: string | null;
};

type DocumentRow = {
  id: string;
  title: string | null;
  document_type: string | null;
  expires_at: string | null;
  file_url: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params?.id as string;

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");

        const [{ data: driverData, error: driverError }, licensesRes, documentsRes] = await Promise.all([
          supabase.from("drivers").select("*").eq("id", driverId).single(),
          supabase.from("driver_licenses").select("id, license_type, license_number, expiry_date").eq("driver_id", driverId).order("expiry_date", { ascending: true }),
          supabase.from("driver_documents").select("id, title, document_type, expires_at, file_url").eq("driver_id", driverId).order("expires_at", { ascending: true }),
        ]);

        if (driverError) throw driverError;

        setDriver(driverData as DriverRow);
        setLicenses(licensesRes.error ? [] : ((licensesRes.data || []) as LicenseRow[]));
        setDocuments(documentsRes.error ? [] : ((documentsRes.data || []) as DocumentRow[]));
      } catch (error: any) {
        console.error(error);
        setErrorMessage(
          "La scheda pilota richiede le tabelle drivers, driver_licenses e driver_documents. Esegui prima la migrazione SQL del modulo piloti."
        );
      } finally {
        setLoading(false);
      }
    }

    if (driverId) loadData();
  }, [driverId]);

  const stats: StatItem[] = useMemo(
    () => [
      { label: "Licenze", value: String(licenses.length), icon: <FileText size={18} /> },
      { label: "Documenti", value: String(documents.length), icon: <FileText size={18} /> },
      { label: "Stato", value: driver?.is_active === false ? "Non attivo" : "Attivo", icon: <UserRound size={18} /> },
      { label: "Scheda performance", value: "Disponibile", icon: <Activity size={18} /> },
    ],
    [driver, licenses.length, documents.length]
  );

  if (loading) return <div className="card-base p-10 text-center text-neutral-500">Caricamento pilota...</div>;
  if (errorMessage) return <EmptyState title="Modulo piloti non disponibile" description={errorMessage} />;
  if (!driver) return <div className="card-base p-10 text-center text-red-600">Pilota non trovato.</div>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${driver.first_name} ${driver.last_name}`}
        subtitle="Scheda pilota"
        icon={<UserRound size={22} />}
        actions={
          <>
            <Link href={`/drivers/${driver.id}/performance`} className="btn-primary">
              <Activity size={16} />
              Performance
            </Link>
            <Link href="/drivers" className="btn-secondary">
              <ArrowLeft size={16} />
              Torna ai piloti
            </Link>
          </>
        }
      />

      <SectionCard>
        <div className="flex flex-wrap gap-2">
          {driver.nickname ? <StatusBadge label={driver.nickname} tone="purple" /> : null}
          <StatusBadge label={driver.is_active === false ? "Non attivo" : "Attivo"} tone={driver.is_active === false ? "neutral" : "green"} />
        </div>
        <div className="mt-5">
          <StatsGrid items={stats} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Anagrafica" subtitle="Dati principali del pilota" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoCard icon={<Mail size={16} />} title="Email" value={driver.email || "—"} />
            <InfoCard icon={<Phone size={16} />} title="Telefono" value={driver.phone || "—"} />
            <InfoCard icon={<UserRound size={16} />} title="Nickname" value={driver.nickname || "—"} />
            <InfoCard icon={<Activity size={16} />} title="Stato" value={driver.is_active === false ? "Non attivo" : "Attivo"} />
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs text-neutral-500">Note</div>
            <div className="mt-2 whitespace-pre-line text-sm text-neutral-800">{driver.notes?.trim() || "Nessuna nota inserita"}</div>
          </div>
        </SectionCard>

        <SectionCard title="Scadenze" subtitle="Panoramica rapida">
          <div className="space-y-3 text-sm">
            <StatusLine label="Prossima licenza" value={licenses[0] ? `${licenses[0].license_type} • ${formatDate(licenses[0].expiry_date)}` : "Nessuna licenza"} />
            <StatusLine label="Primo documento" value={documents[0] ? `${documents[0].title || documents[0].document_type || "Documento"} • ${formatDate(documents[0].expires_at)}` : "Nessun documento"} />
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Licenze" subtitle="Archivio licenze pilota">
          {licenses.length === 0 ? (
            <EmptyState title="Nessuna licenza registrata" />
          ) : (
            <div className="space-y-3">
              {licenses.map((license) => (
                <div key={license.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="font-bold text-neutral-900">{license.license_type}</div>
                  <div className="mt-1 text-sm text-neutral-500">{license.license_number || "Numero non inserito"}</div>
                  <div className="mt-3 text-sm text-neutral-700">Scadenza: {formatDate(license.expiry_date)}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Documenti" subtitle="Documenti e allegati disponibili">
          {documents.length === 0 ? (
            <EmptyState title="Nessun documento registrato" />
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <div key={document.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="font-bold text-neutral-900">{document.title || document.document_type || "Documento"}</div>
                  <div className="mt-1 text-sm text-neutral-500">Scadenza: {formatDate(document.expires_at)}</div>
                  {document.file_url ? (
                    <div className="mt-3">
                      <a href={document.file_url} target="_blank" rel="noreferrer" className="btn-secondary">
                        Apri documento
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        <span className="text-yellow-600">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="mt-2 break-words text-base font-bold text-neutral-900">{value}</div>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm text-neutral-600">{label}</div>
      <div className="mt-2 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
