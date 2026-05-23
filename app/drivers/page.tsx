"use client";

import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
import Link from "next/link";
import { Info, PlusCircle, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import StatsGrid from "@/components/StatsGrid";
import { UiField, uiInputClassName } from "@/components/UiField";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function DriversPage() {
  const access = usePermissionAccess();
  const canViewDrivers = access.hasPermission("drivers.view");
  const canEditDrivers = access.hasPermission("drivers.edit", ["owner", "admin"]);

  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    nickname: "",
    email: "",
    phone: "",
  });
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const { data } = await supabase
        .from("drivers")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("last_name");
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
      const { error } = await supabase
        .from("drivers")
        .insert([{ ...form, team_id: ctx.teamId }]);
      if (error) throw error;
      setOpen(false);
      setForm({
        first_name: "",
        last_name: "",
        nickname: "",
        email: "",
        phone: "",
      });
      await load();
      setFeedback({ type: "success", message: "Pilota creato correttamente." });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: "Errore salvataggio pilota",
      });
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(() => {
    const activeDrivers = drivers.filter((driver) => driver.is_active !== false).length;
    const driversWithEmail = drivers.filter((driver) => !!driver.email).length;
    const driversWithNickname = drivers.filter((driver) => !!driver.nickname).length;

    return [
      {
        label: "Piloti registrati",
        value: String(drivers.length),
        icon: <Users size={18} />,
        helper: "Anagrafiche disponibili nel team",
      },
      {
        label: "Piloti attivi",
        value: String(activeDrivers),
        icon: <ShieldCheck size={18} />,
        helper: "Driver segnati come utilizzabili",
      },
      {
        label: "Con email",
        value: String(driversWithEmail),
        icon: <Users size={18} />,
        helper: "Schede con contatto email compilato",
      },
      {
        label: "Con nickname",
        value: String(driversWithNickname),
        icon: <Users size={18} />,
        helper: "Piloti con nome paddock impostato",
      },
    ];
  }, [drivers]);

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
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title="Piloti"
        subtitle="Anagrafica, documenti, licenze e collegamento agli eventi."
        icon={<Users size={22} />}
        actions={
          canEditDrivers ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Nuovo pilota
            </button>
          ) : undefined
        }
      />

      {!canEditDrivers ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      {feedback ? (
        <FormStatusBanner type={feedback.type} message={feedback.message} />
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="L'anagrafica piloti è il punto di partenza per licenze, documenti, sicurezza e assegnazione agli eventi."
      >
        <InfoBlock>
          Crea la scheda pilota una sola volta e poi aprila per gestire licenze, documenti, checklist sicurezza e stampa scheda.
          Questa pagina deve restare una vista semplice dell&apos;anagrafica del team, mentre il dettaglio pilota contiene tutta la parte operativa.
        </InfoBlock>
      </SectionCard>

      <SectionCard
        title="Elenco piloti"
        subtitle="Apri la scheda pilota per completare documenti, sicurezza e collegamenti agli eventi."
      >
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            Caricamento piloti...
          </div>
        ) : drivers.length === 0 ? (
          <EmptyState
            title="Nessun pilota registrato"
            description="Aggiungi il primo pilota per iniziare a gestire documenti, sicurezza e performance."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => (
              <Link
                key={driver.id}
                href={`/drivers/${driver.id}`}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="font-bold text-neutral-900">
                  {driver.first_name} {driver.last_name}
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  {driver.nickname || "Nessun nickname"}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-700">
                  <div>{driver.email || "Email non inserita"}</div>
                  <div>{driver.phone || "Telefono non inserito"}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      {open && canEditDrivers ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-neutral-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-neutral-900">Nuovo pilota</h3>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <UiField label="Nome">
                <input
                  className={uiInputClassName}
                  value={form.first_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, first_name: e.target.value }))
                  }
                  placeholder="Nome"
                />
              </UiField>

              <UiField label="Cognome">
                <input
                  className={uiInputClassName}
                  value={form.last_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, last_name: e.target.value }))
                  }
                  placeholder="Cognome"
                />
              </UiField>

              <UiField label="Nickname">
                <input
                  className={uiInputClassName}
                  value={form.nickname}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nickname: e.target.value }))
                  }
                  placeholder="Nickname paddock"
                />
              </UiField>

              <UiField label="Email">
                <input
                  type="email"
                  className={uiInputClassName}
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Email"
                />
              </UiField>

              <UiField label="Telefono">
                <input
                  className={uiInputClassName}
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="Telefono"
                />
              </UiField>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-yellow-200"
              >
                {saving ? "Salvataggio..." : "Salva pilota"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
