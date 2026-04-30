"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  CarFront,
  Layers3,
  Link2,
  PlusCircle,
  Search,
  Unlink,
  UserCircle2,
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
import { UiField, uiInputClassName, uiTextareaClassName } from "@/components/UiField";

type MountRow = {
  id: string;
  mounted_at: string | null;
  removed_at: string | null;
  status: string | null;
  reason: string | null;
  cars?: { id: string; name: string | null } | null;
  components?: { id: string; type: string | null; identifier: string | null } | null;
  mounted_by_team_user_id?: { id: string; name: string | null; email: string | null } | null;
  removed_by_team_user_id?: { id: string; name: string | null; email: string | null } | null;
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
  const [mountedAt, setMountedAt] = useState(new Date().toISOString().slice(0, 10));
  const [mountedBy, setMountedBy] = useState("");
  const [reason, setReason] = useState("");

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "history">("all");
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

      setMounts((mountsRes.data || []) as MountRow[]);
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

      const haystack = `${row.components?.identifier || ""} ${row.components?.type || ""} ${row.cars?.name || ""}`
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
        helper: "Montaggi e smontaggi registrati",
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
    <div className="space-y-6">
      <PageHeader
        title="Montaggi"
        subtitle="Workflow tecnico per montare, smontare e consultare lo storico componenti del mezzo."
        icon={<Layers3 size={22} />}
      />

      {!canEditMounts ? (
        <FormStatusBanner
          type="info"
          message="Hai accesso in sola lettura a questo modulo."
        />
      ) : null}

      {feedback ? (
        <FormStatusBanner type={feedback.type} message={feedback.message} />
      ) : null}

      <StatsGrid items={stats} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {canEditMounts ? (
          <SectionCard
            title="Montaggio rapido"
            subtitle="Registra un nuovo montaggio scegliendo auto, componente, data e operatore."
          >
            <form className="grid grid-cols-1 gap-4" onSubmit={addMount}>
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

              <UiField
                label="Data montaggio"
                hint="La data odierna è precompilata, cambiala solo se necessario"
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
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
                    {teamRole}
                  </div>
                )}
              </UiField>

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
                  className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-yellow-200"
                >
                  <Wrench size={16} className="mr-2" />
                  {saving ? "Montaggio..." : "Monta componente"}
                </button>
              </div>
            </form>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Filtri storico"
          subtitle="Seleziona stato, auto e ricerca libera per trovare rapidamente un montaggio."
          className={canEditMounts ? "" : "xl:col-span-2"}
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[170px_240px_1fr]">
            <select
              className={uiInputClassName}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "history")}
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

            <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
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
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            Caricamento montaggi...
          </div>
        ) : filteredMounts.length === 0 ? (
          <EmptyState
            title="Nessun montaggio registrato"
            description="Quando monterai un componente, comparirà qui lo storico completo."
          />
        ) : (
          <div className="space-y-4">
            {filteredMounts.map((mount) => (
              <div
                key={mount.id}
                className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex-1">
                    <div className="text-base font-bold uppercase tracking-wide text-neutral-900">
                      {(mount.components?.type || "Componente").replace(/_/g, " ")} · {mount.components?.identifier || "senza codice"}
                    </div>

                    <div className="mt-2 text-sm text-neutral-500">
                      {mount.cars?.name || "Auto non definita"}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Montato il
                        </div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">
                          {formatDate(mount.mounted_at)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Stato
                        </div>
                        <div className="mt-1">
                          <StatusBadge
                            label={mount.removed_at ? "Storico" : "Attivo"}
                            tone={mount.removed_at ? "neutral" : "green"}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Operatore
                        </div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">
                          {mount.mounted_by_team_user_id?.name ||
                            mount.mounted_by_team_user_id?.email ||
                            "—"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Smontato il
                        </div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">
                          {formatDate(mount.removed_at)}
                        </div>
                      </div>
                    </div>

                    {mount.reason ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                        {mount.reason}
                      </div>
                    ) : null}
                  </div>

                  {!mount.removed_at && canEditMounts ? (
                    <div className="xl:w-[220px] xl:pl-4">
                      <button
                        type="button"
                        onClick={() => unmount(mount.id, mount.components?.id)}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Unlink size={16} className="mr-2" />
                        Smonta componente
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}\n