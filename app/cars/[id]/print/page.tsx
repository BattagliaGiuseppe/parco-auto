"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CarFront, Printer } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import PrintLetterhead from "@/components/PrintLetterhead";
import PrintDocumentFooter from "@/components/PrintDocumentFooter";

type CarComponent = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  hours: number | null;
};

type CarDocument = {
  id: string;
  title: string | null;
  type: string | null;
  file_url: string | null;
};

type CarRow = {
  id: string;
  name: string;
  chassis_number: string | null;
  hours: number | null;
  notes: string | null;
  components?: CarComponent[] | null;
};

function formatHours(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(1)} h`;
}

export default function CarPrintPage() {
  const params = useParams();
  const carId = params?.id as string;
  const [car, setCar] = useState<CarRow | null>(null);
  const [documents, setDocuments] = useState<CarDocument[]>([]);

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
          .select("id,title,type,file_url")
          .eq("team_id", ctx.teamId)
          .eq("car_id", carId)
          .order("uploaded_at", { ascending: false }),
      ]);

      setCar((carData || null) as CarRow | null);
      setDocuments((docsData || []) as CarDocument[]);
    }

    if (carId) void load();
  }, [carId]);

  const componentCount = useMemo(() => car?.components?.length || 0, [car]);

  if (!car) {
    return <div className="p-6 text-neutral-500">Caricamento mezzo...</div>;
  }

  return (
    <div className={`bg-[var(--surface-page)] p-4 md:p-6 print:bg-white print:p-0`}>
      <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
        <div className="print:hidden">
          <PageHeader
            title={`Stampa scheda · ${car.name}`}
            subtitle="Versione stampabile del mezzo con layout allineato al nuovo standard."
            icon={<CarFront size={22} />}
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
                  href={`/cars/${carId}`}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 font-semibold text-[var(--text-primary)]"
                >
                  <ArrowLeft size={16} className="mr-2 inline" />
                  Scheda mezzo
                </Link>
              </>
            }
          />
        </div>

        <div className="mx-auto flex max-w-5xl flex-col gap-6 print:min-h-[257mm] print:gap-4">
          <PrintLetterhead
            title="Scheda tecnica mezzo"
            subtitle="Documento stampabile su carta intestata team"
            rightMeta={[
              { label: "Mezzo", value: car.name || "—" },
              { label: "Telaio", value: car.chassis_number || "—" },
            ]}
          />

          <SectionCard
            title="Panoramica mezzo"
            subtitle="Dati essenziali del mezzo e informazioni operative."
            className="print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InfoCard label="Nome mezzo" value={car.name} />
              <InfoCard label="Telaio" value={car.chassis_number || "—"} />
              <InfoCard label="Ore mezzo" value={formatHours(car.hours)} />
            </div>
            {car.notes ? (
              <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-secondary)]">
                {car.notes}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Componenti montati"
            subtitle="Componenti installati sul mezzo al momento della stampa."
            className="print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none"
          >
            {componentCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--text-secondary)]">
                Nessun componente montato.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(car.components || []).map((component) => (
                  <div
                    key={component.id}
                    className="break-inside-avoid rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4"
                  >
                    <div className="font-bold text-[var(--text-primary)]">
                      {component.type} · {component.identifier}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">
                      Ore {formatHours(component.hours)}
                      {component.expiry_date
                        ? ` · Scadenza ${new Date(component.expiry_date).toLocaleDateString("it-IT")}`
                        : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Documenti collegati"
            subtitle="Documenti associati al mezzo."
            className="print:rounded-none print:border print:border-[var(--border-default)] print:shadow-none"
          >
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--text-secondary)]">
                Nessun documento collegato.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-3 text-sm"
                  >
                    <div className="font-semibold text-[var(--text-primary)]">
                      {doc.title || doc.type || "Documento"}
                    </div>
                    {doc.file_url ? (
                      <div className="mt-1 break-all text-xs text-[var(--text-secondary)]">
                        {doc.file_url}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="pt-2 print:mt-auto print:pt-6">
            <PrintDocumentFooter />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
      <div className="text-sm text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
