"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlusCircle, Users, Search, Activity } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

type DriverRow = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean | null;
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");
        const { data, error } = await supabase
          .from("drivers")
          .select("id, first_name, last_name, nickname, email, phone, is_active")
          .order("last_name", { ascending: true });

        if (error) throw error;
        setDrivers((data || []) as DriverRow[]);
      } catch (error: any) {
        console.error(error);
        setDrivers([]);
        setErrorMessage(
          "La tabella piloti non è ancora disponibile oppure non è accessibile. Esegui prima la migrazione SQL dedicata."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredDrivers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drivers;
    return drivers.filter((driver) => {
      const label = `${driver.first_name} ${driver.last_name} ${driver.nickname || ""} ${driver.email || ""}`.toLowerCase();
      return label.includes(term);
    });
  }, [drivers, search]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Piloti"
        subtitle="Archivio piloti, anagrafica e accesso alle performance"
        icon={<Users size={22} />}
        actions={
          <>
            <Link href="/drivers/new" className="btn-primary">
              <PlusCircle size={16} />
              Nuovo pilota
            </Link>
          </>
        }
      />

      <SectionCard title="Ricerca" subtitle="Trova rapidamente un pilota">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
          <input
            className="input-base pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, cognome, nickname o email"
          />
        </div>
      </SectionCard>

      <SectionCard title="Archivio piloti" subtitle="Schede pilota e accesso ai moduli collegati">
        {loading ? (
          <div className="text-sm text-neutral-500">Caricamento...</div>
        ) : errorMessage ? (
          <EmptyState title="Modulo piloti non ancora attivo" description={errorMessage} />
        ) : filteredDrivers.length === 0 ? (
          <EmptyState title="Nessun pilota registrato" description="Aggiungi il primo pilota per iniziare a costruire lo storico sportivo e documentale." />
        ) : (
          <div className="space-y-3">
            {filteredDrivers.map((driver) => (
              <div key={driver.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-bold text-neutral-900">
                      {driver.first_name} {driver.last_name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                      {driver.nickname ? <StatusBadge label={driver.nickname} tone="purple" /> : null}
                      <StatusBadge label={driver.is_active === false ? "Non attivo" : "Attivo"} tone={driver.is_active === false ? "neutral" : "green"} />
                      {driver.email ? <span>{driver.email}</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/drivers/${driver.id}`} className="btn-secondary">
                      Scheda pilota
                    </Link>
                    <Link href={`/drivers/${driver.id}/performance`} className="btn-primary">
                      <Activity size={16} />
                      Performance
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
