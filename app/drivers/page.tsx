"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";

export default function DriversPage() {
  const access = usePermissionAccess();
  const canViewDrivers = access.hasPermission("drivers.view");
  const canEditDrivers = access.hasPermission("drivers.edit", ["owner", "admin"]);

  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", nickname: "", email: "", phone: "" });
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { data } = await supabase.from("drivers").select("*").eq("team_id", ctx.teamId).order("last_name");
      setDrivers(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewDrivers) {
      void load();
    }
  }, [access.loading, canViewDrivers]);

  async function save() {
    if (!canEditDrivers) return;

    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { error } = await supabase.from("drivers").insert([{ ...form, team_id: ctx.teamId }]);
      if (error) throw error;
      setOpen(false);
      setForm({ first_name: "", last_name: "", nickname: "", email: "", phone: "" });
      await load();
      setFeedback({ type: "success", message: "Pilota creato correttamente." });
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Errore salvataggio pilota" });
    } finally {
      setSaving(false);
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Piloti"
        subtitle="Anagrafica, documenti, licenze e collegamento agli eventi"
        icon={<Users size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Piloti"
        subtitle="Anagrafica, documenti, licenze e collegamento agli eventi"
        icon={<Users size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewDrivers) {
    return (
      <PagePermissionState
        title="Piloti"
        subtitle="Anagrafica, documenti, licenze e collegamento agli eventi"
        icon={<Users size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo piloti. Chiedi a un owner o admin di abilitare il permesso drivers.view."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Piloti"
        subtitle="Anagrafica, documenti, licenze e collegamento agli eventi"
        icon={<Users size={22} />}
        actions={canEditDrivers ? <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"><PlusCircle size={16} className="inline mr-2" />Nuovo pilota</button> : undefined}
      />

      {!canEditDrivers ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Hai accesso in sola lettura a questo modulo.</div> : null}
      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard title="Elenco piloti">
        {loading ? <div className="text-neutral-500">Caricamento...</div> : drivers.length === 0 ? <EmptyState title="Nessun pilota registrato" /> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => (
              <Link key={driver.id} href={`/drivers/${driver.id}`} className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm shadow-sm hover:shadow-md">
                <div className="font-bold text-neutral-900">{driver.first_name} {driver.last_name}</div>
                <div className="mt-1 text-sm text-neutral-500">{driver.nickname || "Nessun nickname"}</div>
                <div className="mt-3 text-sm text-neutral-700">{driver.email || "—"}</div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      {open && canEditDrivers ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-neutral-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-neutral-900">Nuovo pilota</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(form).map(([key, value]) => (
                <input key={key} className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" value={value} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} placeholder={key.replace("_", " ")} />
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">Annulla</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500">{saving ? "Salvataggio..." : "Salva pilota"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
