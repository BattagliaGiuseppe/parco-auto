"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Audiowide } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import PrintLetterhead from "@/components/PrintLetterhead";

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
    return (
      <div className={`min-h-screen bg-[var(--surface-page)] p-6 ${audiowide.className}`}>
        <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-5 text-sm text-neutral-500 shadow-sm">
          Caricamento scheda pilota...
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[var(--surface-page)] p-4 md:p-6 print:bg-white print:p-0 ${audiowide.className}`}>
      <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
        <div className="print:hidden">
          <PageHeader
            title={`Scheda pilota · ${driverName || "Pilota"}`}
            subtitle="Versione stampabile della scheda pilota."
            icon={<Printer size={22} />}
            actions={
              <>
                <button
                  onClick={() => window.print()}
                  className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)]"
                >
                  <Printer size={16} className="mr-2 inline" />
                  Stampa
                </button>
                <Link
                  href={`/drivers/${id}`}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <ArrowLeft size={16} className="mr-2 inline" />
                  Scheda pilota
                </Link>
              </>
            }
          />
        </div>

        <PrintLetterhead
          title="Scheda pilota"
          subtitle={driverName || "Anagrafica pilota"}
          rightMeta={[
            { label: "Pilota", value: driverName || "—" },
            { label: "Email", value: driver.email || "—" },
          ]}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <SectionCard title="Profilo" subtitle="Foto e identificazione rapida del pilota.">
            {driver.photo_url ? (
              <img
                src={driver.photo_url}
                alt={driverName || "Profilo pilota"}
                className="h-56 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-56 items-center justify-center rounded-2xl bg-neutral-100 text-5xl font-bold text-neutral-400">
                {(driver.first_name?.[0] || "") + (driver.last_name?.[0] || "") || "P"}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Dati anagrafici" subtitle="Riepilogo principale del profilo pilota.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Meta label="Nome" value={driver.first_name || "—"} />
              <Meta label="Cognome" value={driver.last_name || "—"} />
              <Meta label="Nickname" value={driver.nickname || "—"} />
              <Meta label="Nazione" value={driver.nationality || "—"} />
              <Meta label="Data di nascita" value={driver.birth_date ? new Date(driver.birth_date).toLocaleDateString("it-IT") : "—"} />
              <Meta label="Telefono" value={driver.phone || "—"} />
              <Meta label="Contatto emergenza" value={driver.emergency_contact || "—"} />
              <Meta label="Stato" value={driver.is_active ? "Attivo" : "Non attivo"} />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Checklist sicurezza" subtitle="Dotazione pilota e omologazioni registrate.">
          {safetyItems.length === 0 ? (
            <div className="text-sm text-neutral-500">Nessun elemento sicurezza registrato.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="py-2 text-left font-semibold text-neutral-700">Elemento</th>
                    <th className="py-2 text-left font-semibold text-neutral-700">Omologazione</th>
                    <th className="py-2 text-left font-semibold text-neutral-700">Scadenza</th>
                    <th className="py-2 text-left font-semibold text-neutral-700">Nota</th>
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
            </div>
          )}
        </SectionCard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Licenze" subtitle="Storico licenze e riferimenti principali.">
            {licenses.length === 0 ? (
              <div className="text-sm text-neutral-500">Nessuna licenza registrata.</div>
            ) : (
              <div className="space-y-3">
                {licenses.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="font-semibold text-neutral-900">{row.license_type}</div>
                    <div className="mt-1 text-sm text-neutral-600">
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

          <SectionCard title="Documenti" subtitle="Allegati e certificati collegati alla scheda pilota.">
            {documents.length === 0 ? (
              <div className="text-sm text-neutral-500">Nessun documento registrato.</div>
            ) : (
              <div className="space-y-3">
                {documents.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="font-semibold text-neutral-900">
                      {row.title || row.document_type || "Documento pilota"}
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">
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

        <SectionCard title="Note" subtitle="Annotazioni operative collegate alla scheda pilota.">
          <div className="whitespace-pre-wrap text-sm text-neutral-700">
            {driver.notes || "Nessuna nota pilota"}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-neutral-800">{value}</div>
    </div>
  );
}
