"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Wrench, FileText } from "lucide-react";
import { Audiowide } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import PrintLetterhead from "@/components/PrintLetterhead";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function CarPrintPage() {
  const params = useParams();
  const carId = params?.id as string;
  const [car, setCar] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const ctx = await getCurrentTeamContext();
      const [{ data: carData }, { data: docsData }] = await Promise.all([
        supabase
          .from("cars")
          .select(
            "id,name,chassis_number,hours,notes,components(id,type,identifier,expiry_date,hours)"
          )
          .eq("team_id", ctx.teamId)
          .eq("id", carId)
          .single(),
        supabase
          .from("documents")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("car_id", carId)
          .order("uploaded_at", { ascending: false }),
      ]);
      setCar(carData);
      setDocuments(docsData || []);
    }
    if (carId) void load();
  }, [carId]);

  if (!car) {
    return (
      <div className={`min-h-screen bg-[var(--surface-page)] p-6 ${audiowide.className}`}>
        <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-5 text-sm text-neutral-500 shadow-sm">
          Caricamento scheda mezzo...
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[var(--surface-page)] p-4 md:p-6 print:bg-white print:p-0 ${audiowide.className}`}>
      <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
        <div className="print:hidden">
          <PageHeader
            title={`Scheda mezzo · ${car.name}`}
            subtitle="Versione stampabile della scheda tecnica del mezzo."
            icon={<Printer size={22} />}
            actions={
              <>
                <button
                  onClick={() => window.print()}
                  className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)]"
                >
                  Stampa
                </button>
                <Link
                  href={`/cars/${carId}`}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <ArrowLeft size={16} className="mr-2 inline" />
                  Scheda mezzo
                </Link>
              </>
            }
          />
        </div>

        <PrintLetterhead
          title="Scheda tecnica mezzo"
          subtitle={car.name || "Mezzo"}
          rightMeta={[
            { label: "Mezzo", value: car.name || "—" },
            { label: "Telaio", value: car.chassis_number || "—" },
          ]}
        />

        <SectionCard title="Panoramica mezzo" subtitle="Dati principali pronti per la stampa operativa.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <InfoCard label="Nome mezzo" value={car.name || "—"} />
            <InfoCard label="Telaio" value={car.chassis_number || "—"} />
            <InfoCard label="Ore vettura" value={`${Number(car.hours || 0).toFixed(1)} h`} />
          </div>
          {car.notes ? (
            <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              {car.notes}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Componenti montati" subtitle="Componenti attualmente installati sul mezzo.">
          {(car.components || []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
              Nessun componente montato.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(car.components || []).map((component: any) => (
                <div
                  key={component.id}
                  className="break-inside-avoid rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
                      <Wrench size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-neutral-900">
                        {component.type} · {component.identifier}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        Ore {Number(component.hours || 0).toFixed(1)}
                        {component.expiry_date
                          ? ` · Scadenza ${new Date(component.expiry_date).toLocaleDateString("it-IT")}`
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Documenti collegati" subtitle="Riferimenti utili allegati alla scheda mezzo.">
          {documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
              Nessun documento collegato.
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900">
                        {doc.title || doc.type || "Documento"}
                      </div>
                      <div className="mt-1 text-neutral-500">
                        {doc.file_name || doc.file_url || "Nessun riferimento file"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-base font-bold text-neutral-900">{value}</div>
    </div>
  );
}
