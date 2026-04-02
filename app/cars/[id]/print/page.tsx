"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";

export default function CarPrintPage() {
  const params = useParams();
  const carId = params?.id as string;
  const [car, setCar] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const ctx = await getCurrentTeamContext();
      const [{ data: carData }, { data: docsData }] = await Promise.all([
        supabase.from('cars').select('id,name,chassis_number,hours,notes,components(id,type,identifier,expiry_date,hours)').eq('team_id', ctx.teamId).eq('id', carId).single(),
        supabase.from('documents').select('*').eq('team_id', ctx.teamId).eq('car_id', carId).order('uploaded_at', { ascending: false }),
      ]);
      setCar(carData);
      setDocuments(docsData || []);
    }
    if (carId) void load();
  }, [carId]);

  if (!car) return <div className="p-6 text-neutral-500">Caricamento...</div>;

  return (
    <div className="flex flex-col gap-6 p-6 print:p-0">
      <PageHeader title={`Scheda tecnica · ${car.name}`} subtitle="Versione stampabile del mezzo" icon={<Printer size={22} />} actions={<><button onClick={() => window.print()} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Stampa</button><Link href={`/cars/${carId}`} className="rounded-xl bg-neutral-100 px-4 py-2"><ArrowLeft size={16} className="mr-2 inline" />Scheda mezzo</Link></>} />
      <SectionCard title="Dati mezzo">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Info label="Nome" value={car.name} />
          <Info label="Telaio" value={car.chassis_number || '—'} />
          <Info label="Ore" value={`${Number(car.hours || 0).toFixed(1)} h`} />
        </div>
        {car.notes ? <div className="mt-4 whitespace-pre-wrap text-sm text-neutral-700">{car.notes}</div> : null}
      </SectionCard>
      <SectionCard title="Componenti montati">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(car.components || []).map((component: any) => <div key={component.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="font-bold text-neutral-900">{component.type} · {component.identifier}</div><div className="mt-1 text-sm text-neutral-500">Ore {Number(component.hours || 0).toFixed(1)}{component.expiry_date ? ` · Scadenza ${new Date(component.expiry_date).toLocaleDateString('it-IT')}` : ''}</div></div>)}
        </div>
      </SectionCard>
      <SectionCard title="Documenti collegati">
        <div className="space-y-2">
          {documents.length === 0 ? <div className="text-neutral-500">Nessun documento collegato.</div> : documents.map((doc) => <div key={doc.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">{doc.title || doc.type || 'Documento'}{doc.file_url ? ` · ${doc.file_url}` : ''}</div>)}
        </div>
      </SectionCard>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-sm text-neutral-500">{label}</div><div className="mt-1 text-lg font-bold text-neutral-900">{value}</div></div>;
}
