"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import {
  UserRound,
  PlusCircle,
  Search,
  IdCard,
  FileText,
  TriangleAlert,
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
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

type DriverLicenseRow = {
  id: string;
  driver_id: string;
  license_type: string;
  license_number: string | null;
  expiry_date: string | null;
  issued_by: string | null;
};

type DriverDocumentRow = {
  id: string;
  driver_id: string;
  document_type: string;
  title: string | null;
  expires_at: string | null;
  signed_at: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;

  const today = new Date();
  const target = new Date(value);

  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  const end = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();

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

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [licenses, setLicenses] = useState<DriverLicenseRow[]>([]);
  const [documents, setDocuments] = useState<DriverDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const ctx = await getCurrentTeamContext();

      const [
        { data: driversData, error: driversError },
        { data: licensesData, error: licensesError },
        { data: documentsData, error: documentsError },
      ] = await Promise.all([
        supabase
          .from("drivers")
          .select("*")
          .eq("team_id", ctx.teamId)
          .order("last_name", { ascending: true }),
        supabase
          .from("driver_licenses")
          .select("id, driver_id, license_type, license_number, expiry_date, issued_by")
          .eq("team_id", ctx.teamId)
          .order("expiry_date", { ascending: true }),
        supabase
          .from("driver_documents")
          .select("id, driver_id, document_type, title, expires_at, signed_at")
          .eq("team_id", ctx.teamId)
          .order("expires_at", { ascending: true }),
      ]);

      if (driversError) throw driversError;
      if (licensesError) throw licensesError;
      if (documentsError) throw documentsError;

      setDrivers((driversData || []) as DriverRow[]);
      setLicenses((licensesData || []) as DriverLicenseRow[]);
      setDocuments((documentsData || []) as DriverDocumentRow[]);
    } catch (error) {
      console.error("Errore caricamento piloti:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const driversWithMeta = useMemo(() => {
    return drivers.map((driver) => {
      const driverLicenses = licenses.filter((item) => item.driver_id === driver.id);
      const driverDocuments = documents.filter((item) => item.driver_id === driver.id);

      const nearestLicense = [...driverLicenses]
        .filter((item) => item.expiry_date)
        .sort(
          (a, b) =>
            new Date(a.expiry_date || "").getTime() -
            new Date(b.expiry_date || "").getTime()
        )[0] || null;

      const nearestDocument = [...driverDocuments]
        .filter((item) => item.expires_at)
        .sort(
          (a, b) =>
            new Date(a.expires_at || "").getTime() -
            new Date(b.expires_at || "").getTime()
        )[0] || null;

      const mostCriticalSeverity = Math.max(
        nearestLicense ? getExpiryTone(nearestLicense.expiry_date).severity : 1,
        nearestDocument ? getExpiryTone(nearestDocument.expires_at).severity : 1
      ) as 1 | 2 | 3;

      return {
        ...driver,
        licensesCount: driverLicenses.length,
        documentsCount: driverDocuments.length,
        nearestLicense,
        nearestDocument,
        severity: mostCriticalSeverity,
      };
    });
  }, [drivers, licenses, documents]);

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return driversWithMeta.filter((driver) => {
      if (!q) return true;

      const fullName = `${driver.first_name} ${driver.last_name}`.toLowerCase();
      const reverseName = `${driver.last_name} ${driver.first_name}`.toLowerCase();

      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        (driver.nickname || "").toLowerCase().includes(q) ||
        (driver.email || "").toLowerCase().includes(q) ||
        (driver.phone || "").toLowerCase().includes(q) ||
        (driver.nationality || "").toLowerCase().includes(q)
      );
    });
  }, [driversWithMeta, search]);

  const stats = useMemo(() => {
    const total = driversWithMeta.length;
    const active = driversWithMeta.filter((item) => item.is_active).length;
    const warning = driversWithMeta.filter((item) => item.severity === 2).length;
    const critical = driversWithMeta.filter((item) => item.severity === 3).length;

    return { total, active, warning, critical };
  }, [driversWithMeta]);

  if (loading) {
    return (
      <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
        Caricamento piloti...
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <UserRound size={14} />
                Driver Management
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Piloti
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Anagrafiche piloti, licenze, documenti, scadenze e stato amministrativo
                del team.
              </p>
            </div>

            <Link href="/drivers/new" className="btn-primary">
              <PlusCircle size={18} /> Nuovo pilota
            </Link>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<UserRound size={18} className="text-yellow-600" />}
              label="Piloti totali"
              value={String(stats.total)}
            />
            <SummaryCard
              icon={<ShieldCheck size={18} className="text-yellow-600" />}
              label="Attivi"
              value={String(stats.active)}
              valueClassName="text-green-700"
            />
            <SummaryCard
              icon={<TriangleAlert size={18} className="text-yellow-600" />}
              label="In attenzione"
              value={String(stats.warning)}
              valueClassName={stats.warning > 0 ? "text-yellow-700" : "text-green-700"}
            />
            <SummaryCard
              icon={<ShieldAlert size={18} className="text-yellow-600" />}
              label="Critici"
              value={String(stats.critical)}
              valueClassName={stats.critical > 0 ? "text-red-700" : "text-green-700"}
            />
          </div>
        </div>
      </section>

      <section className="card-base p-5">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Search className="text-yellow-500" size={18} />
            <h2 className="text-lg font-bold text-neutral-800">Ricerca piloti</h2>
          </div>

          <div className="text-sm text-neutral-500">
            {filteredDrivers.length} piloti mostrati
          </div>
        </div>

        <div className="mt-4 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, cognome, nickname, email, telefono..."
            className="input-base pl-10"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4">
        {filteredDrivers.length === 0 ? (
          <div className="card-base p-10 text-center text-neutral-500">
            Nessun pilota trovato.
          </div>
        ) : (
          filteredDrivers.map((driver) => {
            const licenseTone = driver.nearestLicense
              ? getExpiryTone(driver.nearestLicense.expiry_date)
              : null;

            const documentTone = driver.nearestDocument
              ? getExpiryTone(driver.nearestDocument.expires_at)
              : null;

            return (
              <article
                key={driver.id}
                className="card-base p-5 md:p-6"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900">
                          {driver.first_name} {driver.last_name}
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {driver.nickname ? (
                            <span className="rounded-full bg-neutral-200 text-neutral-700 px-2.5 py-1 font-semibold">
                              {driver.nickname}
                            </span>
                          ) : null}

                          <span
                            className={`rounded-full px-2.5 py-1 font-semibold ${
                              driver.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-neutral-200 text-neutral-600"
                            }`}
                          >
                            {driver.is_active ? "Attivo" : "Non attivo"}
                          </span>

                          {licenseTone ? (
                            <span
                              className={`rounded-full px-2.5 py-1 font-semibold ${licenseTone.className}`}
                            >
                              Licenza: {licenseTone.label}
                            </span>
                          ) : null}

                          {documentTone ? (
                            <span
                              className={`rounded-full px-2.5 py-1 font-semibold ${documentTone.className}`}
                            >
                              Documenti: {documentTone.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <InfoBox
                        icon={<Mail size={16} className="text-yellow-600" />}
                        label="Email"
                        value={driver.email || "—"}
                      />
                      <InfoBox
                        icon={<Phone size={16} className="text-yellow-600" />}
                        label="Telefono"
                        value={driver.phone || "—"}
                      />
                      <InfoBox
                        icon={<IdCard size={16} className="text-yellow-600" />}
                        label="Nazionalità"
                        value={driver.nationality || "—"}
                      />
                      <InfoBox
                        icon={<UserRound size={16} className="text-yellow-600" />}
                        label="Data nascita"
                        value={formatDate(driver.birth_date)}
                      />
                    </div>
                  </div>

                  <div className="xl:w-[360px] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                    <InfoBox
                      icon={<ShieldCheck size={16} className="text-yellow-600" />}
                      label="Licenze"
                      value={String(driver.licensesCount)}
                      subvalue={
                        driver.nearestLicense
                          ? `Scadenza ${formatDate(driver.nearestLicense.expiry_date)}`
                          : "Nessuna licenza registrata"
                      }
                    />

                    <InfoBox
                      icon={<FileText size={16} className="text-yellow-600" />}
                      label="Documenti"
                      value={String(driver.documentsCount)}
                      subvalue={
                        driver.nearestDocument
                          ? `Scadenza ${formatDate(driver.nearestDocument.expires_at)}`
                          : "Nessun documento registrato"
                      }
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Link
                    href={`/drivers/${driver.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 font-semibold px-4 py-2"
                  >
                    Apri scheda pilota <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
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

function InfoBox({
  icon,
  label,
  value,
  subvalue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-bold text-neutral-900 break-words">{value}</div>
      {subvalue ? <div className="text-xs text-neutral-500 mt-1">{subvalue}</div> : null}
    </div>
  );
}