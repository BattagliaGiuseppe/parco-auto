"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserRound, ShieldCheck, FileText, Activity } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params?.id as string;
  const [driver, setDriver] = useState<any>(null);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const ctx = await getCurrentTeamContext();
      const [{ data: driverData }, { data: licensesData }, { data: documentsData }] = await Promise.all([
        supabase.from("drivers").select("*").eq("team_id", ctx.teamId).eq("id", driverId).single(),
        supabase.from("driver_licenses").select("*").eq("team_id", ctx.teamId).eq("driver_id", driverId),
        supabase.from("driver_documents").select("*").eq("team_id", ctx.teamId).eq("driver_id", driverId),
      ]);
      setDriver(driverData);
      setLicenses(licensesData || []);
      setDocuments(documentsData || []);
    }
    if (driverId) load();
  }, [driverId]);

  if (!driver) return <div className="p-6 text-neutral-500">Caricamento pilota...</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={`${driver.first_name} ${driver.last_name}`} subtitle="Scheda pilota" icon={<UserRound size={22} />} actions={<><Link href={`/drivers/${driver.id}/performance`} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Performance</Link><Link href="/drivers" className="rounded-xl bg-neutral-100 px-4 py-2"> <ArrowLeft size={16} className="inline mr-2" />Indietro</Link></>} />
      <SectionCard>
        <StatsGrid items={[
          { label: 'Licenze', value: String(licenses.length), icon: <ShieldCheck size={18} /> },
          { label: 'Documenti', value: String(documents.length), icon: <FileText size={18} /> },
          { label: 'Email', value: driver.email || '—' },
          { label: 'Telefono', value: driver.phone || '—' },
        ]} />
      </SectionCard>
      <SectionCard title="Note">{driver.notes ? <div className="whitespace-pre-wrap text-sm text-neutral-700">{driver.notes}</div> : <EmptyState title="Nessuna nota pilota" />}</SectionCard>
    </div>
  );
}
