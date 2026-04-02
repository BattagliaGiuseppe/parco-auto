"use client";

import Link from "next/link";
import { Layers3, ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";

export default function InstallationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Installazioni"
        subtitle="Questa area è stata superata dal modulo Montaggi, più completo e tracciabile."
        icon={<Layers3 size={22} />}
      />
      <SectionCard title="Modulo sostituito" subtitle="Usa Montaggi per montare, smontare e tracciare l'operatore, la data e lo storico.">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-neutral-700">
          Il vecchio flusso Installazioni non è più il punto centrale del sistema. Per il controllo configurazione del mezzo usa il modulo <b>Montaggi</b>, che registra attore, motivo, storico e stato attuale dei componenti.
        </div>
        <div className="mt-4">
          <Link href="/mounts" className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">
            <ArrowRight size={16} className="mr-2 inline" />Apri Montaggi
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
