"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import PrintLetterhead from "@/components/PrintLetterhead";
import PrintDocumentFooter from "@/components/PrintDocumentFooter";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function DriverPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [driver, setDriver] = useState<any>(null);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [safetyItems, setSafetyItems] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const ctx = await getCurrentTeamContext();
      const [driverRes, licensesRes, documentsRes, safetyRes] = await Promise.all([
        supabase.from("drivers").select("*").eq("team_id", ctx.teamId).eq("id", id).single(),
        supabase
          .from("driver_licenses")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("driver_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("driver_documents")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("driver_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("driver_safety_items")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("driver_id", id)
          .order("created_at", { ascending: true }),
      ]);

      setDriver(driverRes.data || null);
      setLicenses(licensesRes.data || []);
      setDocuments(documentsRes.data || []);
      setSafetyItems(safetyRes.data || []);
    }

    void load();
  }, [id]);

  const driverName = useMemo(
    () => `${driver?.first_name || ""} ${driver?.last_name || ""}`.trim(),
    [driver]
  );

  if (!driver) {
    return <div className="p-6 text-neutral-500">Caricamento scheda pilota...</div>;
  }

  return (
    <div className={`bg-[var(--surface-page)] p-4 md:p-6 print:bg-white print:p-0 ${audiowide.className}`}>
      <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
        <div className="print:hidden">
          <PageHeader
            title={`Stampa scheda · ${driverName || "Pilota"}`}
            subtitle="Versione stampabile del pilota con layout coerente al nuovo standard."
            icon={<UserRound size={22} />}
            actions={
              <>
                <button
                  onClick={() => window.print()}
                  className="rounded-xl px-4 py-2 font-bold"
                  style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent)" }}
                >
                  <Printer size={16} className="mr-2 inline" />
                  Stampa
                </button>
                <Link
                  href={`/drivers/${id}`}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-semibold text-[var(--text-primary)]"
                >
                  <ArrowLeft size={16} className="mr-2 inline" />
                  Scheda pilota
                </Link>
              </>
            }
          />
        </div>

        <div className="mx-auto flex max-w-5xl flex-col gap-6 print:min-h-[257mm] print:gap-4">
          <PrintLetterhead
            title="Scheda pilota"
            subtitle={driverName || "Anagrafica pilota"}
            rightMeta={[
              { label: "Pilota", value: driverName || "—" },
              { label: "Email", value: driver.email || "—" },
            ]}
          />

          <SectionCard
            title="Dati anagrafici"
            subtitle="Informazioni principali del pilota."
            className="print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none"
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
              <div className="rounded-2xl border border-[var(--border-default)] p-5">
                {driver.photo_url ? (
                  <img
                    src={driver.photo_url}
                    alt={driverName || "Profilo pilota"}
                    className="h-52 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-5xl font-bold text-neutral-400">
                    {(driver.first_name?.[0] || "") + (driver.last_name?.[0] || "") || "P"}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Meta label="Nome" value={driver.first_name || "—"} />
                <Meta label="Cognome" value={driver.last_name || "—"} />
                <Meta label="Nickname" value={driver.nickname || "—"} />
                <Meta label="Nazione" value={driver.nationality || "—"} />
                <Meta
                  label="Data di nascita"
                  value={
                    driver.birth_date
                      ? new Date(driver.birth_date).toLocaleDateString("it-IT")
                      : "—"
                  }
                />
                <Meta label="Telefono" value={driver.phone || "—"} />
                <Meta
                  label="Contatto emergenza"
                  value={driver.emergency_contact || "—"}
                />
                <Meta label="Stato" value={driver.is_active ? "Attivo" : "Non attivo"} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Checklist sicurezza"
            subtitle="Dotazioni e stato documentale di sicurezza."
            className="print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none"
          >
            {safetyItems.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)]">
                Nessun elemento sicurezza registrato.
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="py-2 text-left font-semibold text-[var(--text-primary)]">Elemento</th>
                    <th className="py-2 text-left font-semibold text-[var(--text-primary)]">Omologazione</th>
                    <th className="py-2 text-left font-semibold text-[var(--text-primary)]">Scadenza</th>
                    <th className="py-2 text-left font-semibold text-[var(--text-primary)]">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {safetyItems.map((item) => (
                    <tr key={item.id} className="border-b border-neutral-100">
                      <td className="py-2">{item.item_name || "—"}</td>
                      <td className="py-2">{item.homologation || "—"}</td>
                      <td className="py-2">
                        {item.expiry_date
                          ? new Date(item.expiry_date).toLocaleDateString("it-IT")
                          : "—"}
                      </td>
                      <td className="py-2">{item.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Licenze"
              subtitle="Storico licenze registrate."
              className="print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none"
            >
              {licenses.length === 0 ? (
                <div className="text-sm text-[var(--text-secondary)]">Nessuna licenza registrata.</div>
              ) : (
                <div className="space-y-3">
                  {licenses.map((row) => (
                    <div key={row.id} className="rounded-xl border border-[var(--border-default)] p-3">
                      <div className="font-semibold text-[var(--text-primary)]">{row.license_type}</div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">
                        {row.license_number || "Numero non inserito"}
                        {row.issued_by ? ` · ${row.issued_by}` : ""}
                        {row.expiry_date
                          ? ` · scade il ${new Date(row.expiry_date).toLocaleDateString("it-IT")}`
                          : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Documenti"
              subtitle="Documenti collegati al pilota."
              className="print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none"
            >
              {documents.length === 0 ? (
                <div className="text-sm text-[var(--text-secondary)]">Nessun documento registrato.</div>
              ) : (
                <div className="space-y-3">
                  {documents.map((row) => (
                    <div key={row.id} className="rounded-xl border border-[var(--border-default)] p-3">
                      <div className="font-semibold text-[var(--text-primary)]">
                        {row.title || row.document_type || "Documento pilota"}
                      </div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">
                        {row.expires_at
                          ? `Scadenza ${new Date(row.expires_at).toLocaleDateString("it-IT")}`
                          : "Nessuna scadenza"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Note"
            subtitle="Annotazioni operative del pilota."
            className="print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none"
          >
            <div className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
              {driver.notes || "Nessuna nota pilota"}
            </div>
          </SectionCard>

          <div className="pt-2 print:mt-auto print:pt-6">
            <PrintDocumentFooter />
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
