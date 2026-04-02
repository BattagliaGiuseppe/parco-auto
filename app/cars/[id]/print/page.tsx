"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";

export default function CarPrintPage() {
  const params = useParams();
  const carId = params?.id as string;
  const [car, setCar] = useState<any>(null);

  useEffect(() => {
    supabase.from("cars").select("id, name, chassis_number, hours").eq("id", carId).single().then(({ data }) => setCar(data));
  }, [carId]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Stampa scheda auto" subtitle="Versione pulita per esportazione o stampa PDF" icon={<Printer size={22} />} actions={<><button onClick={() => window.print()} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Stampa</button><Link href={`/cars/${carId}`} className="rounded-xl bg-neutral-100 px-4 py-2"><ArrowLeft size={16} className="inline mr-2" />Scheda auto</Link></>} />
      <SectionCard>{car ? <div className="space-y-2"><div><b>Nome:</b> {car.name}</div><div><b>Telaio:</b> {car.chassis_number || '—'}</div><div><b>Ore:</b> {car.hours || 0}</div></div> : 'Caricamento...'}</SectionCard>
    </div>
  );
}
