"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Audiowide } from "next/font/google";
import {
  CarFront,
  Info,
  Layers3,
  Link2,
  PlusCircle,
  Search,
  Unlink,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext, getTeamUsers } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import {
  UiField,
  uiInputClassName,
  uiTextareaClassName,
} from "@/components/UiField";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type MountRow = {
  id: string;
  mounted_at: string | null;
  removed_at: string | null;
  status: string | null;
  reason: string | null;
  cars?: { id: string; name: string | null } | null;
  components?:
    | { id: string; type: string | null; identifier: string | null }
    | null;
  mounted_by_team_user_id?:
    | { id: string; name: string | null; email: string | null }
    | null;
  removed_by_team_user_id?:
    | { id: string; name: string | null; email: string | null }
    | null;
};

type MountRowRaw = {
  id: string;
  mounted_at: string | null;
  removed_at: string | null;
  status: string | null;
  reason: string | null;
  cars?:
    | { id: string; name: string | null }[]
    | { id: string; name: string | null }
    | null;
  components?:
    | { id: string; type: string | null; identifier: string | null }[]
    | { id: string; type: string | null; identifier: string | null }
    | null;
  mounted_by_team_user_id?:
    | { id: string; name: string | null; email: string | null }[]
    | { id: string; name: string | null; email: string | null }
    | null;
  removed_by_team_user_id?:
    | { id: string; name: string | null; email: string | null }[]
    | { id: string; name: string | null; email: string | null }
    | null;
};

type CarRow = {
  id: string;
  name: string | null;
};

type ComponentRow = {
  id: string;
  type: string | null;
  identifier: string | null;
  car_id: string | null;
};

type TeamUserLite = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatUserLabel(user: TeamUserLite) {
  return user.name || user.email || user.role || "Operatore";
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function MountsPage() {
  const access = usePermissionAccess();
  const canViewMounts = access.hasPermission("mounts.view");
  const canEditMounts = access.hasPermission("mounts.edit", ["owner", "admin"]);

  const [mounts, setMounts] = useState<MountRow[]>([]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUserLite[]>([]);
  const [teamRole, setTeamRole] = useState("viewer");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedCar, setSelectedCar] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("");
  const [mountedAt, setMountedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [mountedBy, setMountedBy] = useState("");
  const [reason, setReason] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "history"
  >("all");
  const [carFilter, setCarFilter] = useState("");
  const [search, setSearch] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  async function loadAll() {
    setLoading(true);
    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();

      const [mountsRes, carsRes, compsRes, usersRes] = await Promise.all([
        supabase
          .from("car_components")
          .select(
            "id, mounted_at, removed_at, status, reason, cars:car_id(id,name), components:component_id(id,type,identifier), mounted_by_team_user_id(id,name,email), removed_by_team_user_id(id,name,email)"
          )
          .eq("team_id", ctx.teamId)
          .order("created_at", { ascending: false }),
        supabase
          .from("cars")
          .select("id, name")
          .eq("team_id", ctx.teamId)
          .order("name", { ascending: true }),
        supabase
          .from("components")
          .select("id, type, identifier, car_id")
          .eq("team_id", ctx.teamId)
          .is("car_id", null)
          .order("identifier", { ascending: true }),
        getTeamUsers(),
      ]);

      if (mountsRes.error) throw mountsRes.error;
      if (carsRes.error) throw carsRes.error;
      if (compsRes.error) throw compsRes.error;

      const normalizedMounts: MountRow[] = (
        (mountsRes.data || []) as MountRowRaw[]
      ).map((row) => ({
        id: row.id,
        mounted_at: row.mounted_at,
        removed_at: row.removed_at,
        status: row.status,
        reason: row.reason,
        cars: pickOne(row.cars),
        components: pickOne(row.components),
        mounted_by_team_user_id: pickOne(row.mounted_by_team_user_id),
        removed_by_team_user_id: pickOne(row.removed_by_team_user_id),
      }));

      setMounts(normalizedMounts);
      setCars((carsRes.data || []) as CarRow[]);
      setComponents((compsRes.data || []) as ComponentRow[]);
      setTeamUsers((usersRes || []) as TeamUserLite[]);
      setTeamRole(ctx.role);
      setMountedBy(ctx.teamUserId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore caricamento montaggi";
      setFeedback({ type: "error", message });
      setMounts([]);
      setCars([]);
      setComponents([]);
      setTeamUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewMounts) {
      void loadAll();
    }
  }, [access.loading, canViewMounts]);

  const activeMounts = useMemo(
    () => mounts.filter((row) => !row.removed_at),
    [mounts]
  );

  const filteredMounts = useMemo(() => {
    return mounts.filter((row) => {
      if (statusFilter === "active" && row.removed_at) return false;
      if (statusFilter === "history" && !row.removed_at) return false;
      if (carFilter && row.cars?.id !== carFilter) return false;

      const haystack = `${row.components?.identifier || ""} ${
        row.components?.type || ""
      } ${row.cars?.name || ""}`
        .toLowerCase()
        .trim();

      if (search.trim() && !haystack.includes(search.toLowerCase().trim())) {
        return false;
      }

      return true;
    });
  }, [mounts, statusFilter, carFilter, search]);

  const canChooseActor =
    canEditMounts && (teamRole === "owner" || teamRole === "admin");

  const stats = useMemo(
    () => [
      {
        label: "Montaggi attivi",
        value: String(activeMounts.length),
        icon: <Link2 size={18} />,
        helper: "Componenti attualmente installati",
      },
      {
        label: "Storico totale",
        value: String(mounts.length),
        icon: <Layers3 size={18} />,
        helper: "Interventi di montaggio e smontaggio registrati",
      },
      {
        label: "Auto coinvolte",
        value: String(cars.length),
        icon: <CarFront size={18} />,
        helper: "Mezzi disponibili nel team",
      },
      {
        label: "Componenti liberi",
        value: String(components.length),
        icon: <PlusCircle size={18} />,
        helper: "Pronti per un nuovo montaggio",
      },
    ],
    [activeMounts.length, mounts.length, cars.length, components.length]
  );

  async function addMount(e: FormEvent) {
    e.preventDefault();

    if (!canEditMounts || !selectedCar || !selectedComponent) {
      setFeedback({
        type: "info",
        message: "Seleziona auto e componente per procedere con il montaggio.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();
      const actorId =
        teamRole === "owner" || teamRole === "admin"
          ? mountedBy || ctx.teamUserId
          : ctx.teamUserId;

      const { error } = await supabase.from("car_components").insert([
        {
          team_id: ctx.teamId,
          car_id: selectedCar,
          component_id: selectedComponent,
          mounted_at: mountedAt,
          installed_at: mountedAt,
          status: "mounted",
          mounted_by_team_user_id: actorId,
          reason: reason.trim() || null,
        },
      ]);

      if (error) throw error;

      const { error: updateError } = await supabase
        .from("components")
        .update({ car_id: selectedCar })
        .eq("team_id", ctx.teamId)
        .eq("id", selectedComponent);

      if (updateError) throw updateError;

      setSelectedCar("");
      setSelectedComponent("");
      setMountedAt(new Date().toISOString().slice(0, 10));
      setReason("");

      await loadAll();
      setFeedback({
        type: "success",
        message: "Componente montato correttamente.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore montaggio componente";
      setFeedback({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  async function unmount(mountId: string, componentId: string | undefined) {
    if (!canEditMounts || !componentId) return;

    setFeedback(null);

    try {
      const ctx = await getCurrentTeamContext();
      const actorId = ctx.teamUserId;
      const today = new Date().toISOString().slice(0, 10);

      const { error } = await supabase
        .from("car_components")
        .update({
          removed_at: today,
          removed_by_team_user_id: actorId,
          status: "unmounted",
        })
        .eq("team_id", ctx.teamId)
        .eq("id", mountId);

      if (error) throw error;

      const { error: compError } = await supabase
        .from("components")
        .update({ car_id: null })
        .eq("team_id", ctx.teamId)
        .eq("id", componentId);

      if (compError) throw compError;

      await loadAll();
      setFeedback({
        type: "success",
        message: "Componente smontato correttamente.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore smontaggio componente";
      setFeedback({ type: "error", message });
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Montaggi"
        subtitle="Configurazione tecnica del mezzo con storico montaggi e smontaggi"
        icon={<Layers3 size={20} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Montaggi"
        subtitle="Configurazione tecnica del mezzo con storico montaggi e smontaggi"
        icon={<Layers3 size={20} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewMounts) {
    return (
      <PagePermissionState
        title="Montaggi"
        subtitle="Configurazione tecnica del mezzo con storico montaggi e smontaggi"
        icon={<Layers3 size={20} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo montaggi."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title="Montaggi"
        subtitle="Workflow tecnico per montare, smontare e consultare lo storico componenti del mezzo."
        icon={<Layers3 size={22} />}
      />

      {!canEditMounts ? (
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
        subtitle="Montaggio e smontaggio lavorano insieme in modo più chiaro."
      >
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 shrink-0" />
            <div>
              Usa <strong>Montaggio rapido</strong> per installare un componente libero su un mezzo.
              Lo storico mostra tutto il ciclo del componente: quando è stato montato, da chi,
              su quale auto e quando è stato smontato. Il pulsante <strong>Smonta componente</strong>
              chiude il montaggio attivo senza alterare il resto della configurazione del modulo.
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {canEditMounts ? (
          <SectionCard
            title="Montaggio rapido"
            subtitle="Seleziona mezzo, componente, data e operatore per registrare il montaggio."
          >
            <form className="grid grid-cols-1 gap-5" onSubmit={addMount}>
              <div className="grid grid-cols-1 gap-4">
                <UiField label="Auto" hint="Mezzo sul quale installare il componente">
                  <select
                    value={selectedCar}
                    onChange={(e) => setSelectedCar(e.target.value)}
                    className={uiInputClassName}
                    required
                  >
                    <option value="">Seleziona auto</option>
                    {cars.map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.name || "Auto senza nome"}
                      </option>
                    ))}
                  </select>
                </UiField>

                <UiField
                  label="Componente disponibile"
                  hint="Mostra solo componenti attualmente non montati"
                >
                  <select
                    value={selectedComponent}
                    onChange={(e) => setSelectedComponent(e.target.value)}
                    className={uiInputClassName}
                    required
                  >
                    <option value="">Seleziona componente</option>
                    {components.map((component) => (
                      <option key={component.id} value={component.id}>
                        {(component.type || "Componente")} · {component.identifier || "senza codice"}
                      </option>
                    ))}
                  </select>
                </UiField>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UiField
                  label="Data montaggio"
                  hint="La data odierna è precompilata"
                >
                  <input
                    type="date"
                    value={mountedAt}
                    onChange={(e) => setMountedAt(e.target.value)}
                    className={uiInputClassName}
                  />
                </UiField>

                <UiField
                  label="Operatore"
                  hint={
                    canChooseActor
                      ? "Owner/Admin possono attribuire il montaggio a un membro del team"
                      : "Utente registrato automaticamente"
                  }
                >
                  {canChooseActor ? (
                    <select
                      value={mountedBy}
                      onChange={(e) => setMountedBy(e.target.value)}
                      className={uiInputClassName}
                    >
                      <option value="">Operatore</option>
                      {teamUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {formatUserLabel(user)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-xl border p-3 text-sm text-neutral-700">
                      {teamRole}
                    </div>
                  )}
                </UiField>
              </div>

              <UiField
                label="Motivo / note montaggio"
                hint="Weekend gara, sostituzione preventiva, guasto, test, ecc."
              >
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={uiTextareaClassName}
                  placeholder="Descrivi il motivo tecnico del montaggio..."
                />
              </UiField>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-yellow-200"
                >
                  <Wrench size={16} className="mr-2 inline" />
                  {saving ? "Montaggio..." : "Monta componente"}
                </button>
              </div>
            </form>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Filtri storico"
          subtitle="Riduci lo storico per stato, auto o ricerca libera."
          className={canEditMounts ? "" : "xl:col-span-2"}
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[170px_240px_1fr]">
            <select
              className={uiInputClassName}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "history")
              }
            >
              <option value="all">Tutti</option>
              <option value="active">Montaggi attivi</option>
              <option value="history">Storico chiuso</option>
            </select>

            <select
              className={uiInputClassName}
              value={carFilter}
              onChange={(e) => setCarFilter(e.target.value)}
            >
              <option value="">Tutte le auto</option>
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.name || "Auto senza nome"}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3 rounded-xl border p-3">
              <Search size={18} className="text-neutral-400" />
              <input
                className="w-full bg-transparent text-sm text-neutral-900 outline-none"
                placeholder="Cerca per componente o auto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Storico montaggi"
        subtitle="Visione unificata di componenti attivi e storico smontaggi."
      >
        {loading ? (
          <div className="text-neutral-500">Caricamento...</div>
        ) : filteredMounts.length === 0 ? (
          <EmptyState
            title="Nessun montaggio registrato"
            description="Quando monterai un componente, comparirà qui lo storico completo."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredMounts.map((mount) => (
              <div
                key={mount.id}
                className="rounded-2xl border p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold uppercase text-neutral-900">
                      {(mount.components?.type || "Componente").replace(/_/g, " ")} · {mount.components?.identifier || "senza codice"}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {mount.cars?.name || "Auto non definita"}
                    </div>
                  </div>

                  <StatusBadge
                    label={mount.removed_at ? "Storico" : "Attivo"}
                    tone={mount.removed_at ? "neutral" : "green"}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-neutral-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-neutral-500">
                      Montato il
                    </div>
                    <div className="mt-1 text-sm font-semibold text-neutral-900">
                      {formatDate(mount.mounted_at)}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-neutral-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-neutral-500">
                      Operatore
                    </div>
                    <div className="mt-1 text-sm font-semibold text-neutral-900">
                      {mount.mounted_by_team_user_id?.name ||
                        mount.mounted_by_team_user_id?.email ||
                        "—"}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-neutral-50 p-3 sm:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-neutral-500">
                      Smontato il
                    </div>
                    <div className="mt-1 text-sm font-semibold text-neutral-900">
                      {formatDate(mount.removed_at)}
                    </div>
                  </div>
                </div>

                {mount.reason ? (
                  <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm leading-6 text-yellow-900">
                    {mount.reason}
                  </div>
                ) : null}

                {!mount.removed_at && canEditMounts ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => unmount(mount.id, mount.components?.id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-bold text-red-700 hover:bg-red-100"
                    >
                      <Unlink size={16} className="mr-2 inline" />
                      Smonta componente
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
