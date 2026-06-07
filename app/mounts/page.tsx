"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
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
import ViewModeToggle from "@/components/ViewModeToggle";
import { usePersistedViewMode } from "@/lib/usePersistedViewMode";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  UiField,
  uiInputClassName,
  uiTextareaClassName,
} from "@/components/UiField";
import LocalizedText from "@/components/LocalizedText";

type MountRow = {
  id: string;
  mounted_at: string | null;
  removed_at: string | null;
  status: string | null;
  reason: string | null;
  cars?: { id: string; name: string | null } | null;
  components?: {
    id: string;
    type: string | null;
    identifier: string | null;
  } | null;
  mounted_by_team_user_id?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  removed_by_team_user_id?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
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
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
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
    new Date().toISOString().slice(0, 10),
  );
  const [mountedBy, setMountedBy] = useState("");
  const [reason, setReason] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "history"
  >("all");
  const [carFilter, setCarFilter] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = usePersistedViewMode("mounts-view-mode");

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
            "id, mounted_at, removed_at, status, reason, cars:car_id(id,name), components:component_id(id,type,identifier), mounted_by_team_user_id(id,name,email), removed_by_team_user_id(id,name,email)",
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
    [mounts],
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

  const groupedMounts = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; rows: MountRow[] }>();
    for (const mount of filteredMounts) {
      const label = mount.cars?.name || "Auto non definita";
      const key = mount.cars?.id || "__no_car";
      const group = groups.get(key) || { key, label, rows: [] as MountRow[] };
      group.rows.push(mount);
      groups.set(key, group);
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.label === "Auto non definita") return 1;
      if (b.label === "Auto non definita") return -1;
      return a.label.localeCompare(b.label, "it");
    });
  }, [filteredMounts]);

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
    [activeMounts.length, mounts.length, cars.length, components.length],
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

      const { error } = await supabase.rpc("mount_component_on_car", {
        p_team_id: ctx.teamId,
        p_car_id: selectedCar,
        p_component_id: selectedComponent,
        p_mounted_at: mountedAt,
        p_mounted_by_team_user_id: actorId,
        p_reason: reason.trim() || null,
        p_replace_same_type: true,
      });

      if (error) throw error;

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

      const { error } = await supabase.rpc("unmount_component_from_car", {
        p_team_id: ctx.teamId,
        p_component_id: componentId,
        p_mount_id: mountId,
        p_removed_at: today,
        p_removed_by_team_user_id: actorId,
        p_reason: null,
      });

      if (error) throw error;

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
        title={tr("Montaggi")}
        subtitle="Configurazione tecnica del mezzo con storico montaggi e smontaggi"
        icon={<Layers3 size={20} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title={tr("Montaggi")}
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
        title={tr("Montaggi")}
        subtitle="Configurazione tecnica del mezzo con storico montaggi e smontaggi"
        icon={<Layers3 size={20} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo montaggi."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title={tr("Montaggi")}
        subtitle="Workflow tecnico per montare, smontare e consultare lo storico componenti del mezzo."
        icon={<Layers3 size={22} />}
      />

      {!canEditMounts ? (
        <div className="rounded-2xl border border-blue-400/25 bg-blue-400/10 px-4 py-3 text-sm text-blue-200">
          {tr("Hai accesso in sola lettura a questo modulo.")}
        </div>
      ) : null}

      {feedback ? (
        <FormStatusBanner type={feedback.type} message={feedback.message} />
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title={tr("Lettura operativa")}
        subtitle="Montaggio e smontaggio lavorano insieme in modo più chiaro."
      >
        <div className="race-info-box text-sm leading-6">
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 shrink-0" />
            <div>{tr("Usa “Montaggio rapido” per installare un componente libero su un mezzo. Lo storico mostra tutto il ciclo del componente: quando è stato montato, da chi, su quale auto e quando è stato smontato. Il pulsante “Smonta componente” chiude il montaggio attivo senza alterare il resto della configurazione del modulo.")}</div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {canEditMounts ? (
          <SectionCard
            title={tr("Montaggio rapido")}
            subtitle="Seleziona mezzo, componente, data e operatore per registrare il montaggio."
          >
            <form className="grid grid-cols-1 gap-5" onSubmit={addMount}>
              <div className="grid grid-cols-1 gap-4">
                <UiField
                  label="Auto"
                  hint="Mezzo sul quale installare il componente"
                >
                  <select
                    value={selectedCar}
                    onChange={(e) => setSelectedCar(e.target.value)}
                    className={uiInputClassName}
                    required
                  >
                    <option value="">{tr("Seleziona auto")}</option>
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
                    <option value="">{tr("Seleziona componente")}</option>
                    {components.map((component) => (
                      <option key={component.id} value={component.id}>
                        {component.type || "Componente"} ·{" "}
                        {component.identifier || "senza codice"}
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
                      <option value="">{tr("Operatore")}</option>
                      {teamUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {formatUserLabel(user)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="race-mini-panel text-sm text-[var(--text-secondary)]">
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
                  placeholder={tr("Descrivi il motivo tecnico del montaggio...")}
                />
              </UiField>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wrench size={16} className="mr-2 inline" />
                  {saving ? "Montaggio..." : "Monta componente"}
                </button>
              </div>
            </form>
          </SectionCard>
        ) : null}

        <SectionCard
          title={tr("Filtri storico")}
          subtitle="Riduci lo storico per stato, auto o ricerca libera."
          className={canEditMounts ? "" : "xl:col-span-2"}
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[170px_240px_1fr_auto] xl:items-center">
            <select
              className={uiInputClassName}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "history")
              }
            >
              <option value="all">{tr("Tutti")}</option>
              <option value="active">{tr("Montaggi attivi")}</option>
              <option value="history">{tr("Storico chiuso")}</option>
            </select>

            <select
              className={uiInputClassName}
              value={carFilter}
              onChange={(e) => setCarFilter(e.target.value)}
            >
              <option value="">{tr("Tutte le auto")}</option>
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.name || "Auto senza nome"}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.035] p-3">
              <Search size={18} className="text-[var(--text-muted)]" />
              <input
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-white/30"
                placeholder={tr("Cerca per componente o auto")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex justify-start xl:justify-end">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title={tr("Storico montaggi")}
        subtitle="Visione unificata di componenti attivi e storico smontaggi."
      >
        {loading ? (
          <div className="text-[var(--text-secondary)]"><LocalizedText text="Caricamento..." /></div>
        ) : filteredMounts.length === 0 ? (
          <EmptyState
            title={tr("Nessun montaggio registrato")}
            description="Quando monterai un componente, comparirà qui lo storico completo."
          />
        ) : viewMode === "compact" ? (
          <div className="space-y-5">
            {groupedMounts.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--brand-accent)]">
                    {group.label}
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-bold text-[var(--text-secondary)]">
                    {group.rows.length} movimenti
                  </div>
                </div>
                <div className="space-y-2">
                  {group.rows.map((mount) => (
                    <div key={mount.id} className="data-row">
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.55fr_0.65fr_0.65fr_auto] xl:items-center">
                        <div>
                          <div className="font-bold uppercase text-[var(--text-primary)]">
                            {(mount.components?.type || "Componente").replace(/_/g, " ")} · {mount.components?.identifier || "senza codice"}
                          </div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">
                            {mount.reason || "Nessuna nota tecnica"}
                          </div>
                        </div>
                        <InfoMini label="Montato" value={formatDate(mount.mounted_at)} />
                        <InfoMini label="Smontato" value={formatDate(mount.removed_at)} />
                        <StatusBadge label={mount.removed_at ? "Storico" : "Attivo"} tone={mount.removed_at ? "neutral" : "green"} />
                        <div className="flex justify-end">
                          {!mount.removed_at && canEditMounts ? (
                            <button
                              type="button"
                              onClick={() => unmount(mount.id, mount.components?.id)}
                              className="race-action-danger px-4 py-2 text-sm"
                            >
                              <Unlink size={16} className="mr-2 inline" />
                              Smonta
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredMounts.map((mount) => (
              <div key={mount.id} className="data-row">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold uppercase text-[var(--text-primary)]">
                      {(mount.components?.type || "Componente").replace(
                        /_/g,
                        " ",
                      )}{" "}
                      · {mount.components?.identifier || "senza codice"}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">
                      {mount.cars?.name || "Auto non definita"}
                    </div>
                  </div>

                  <StatusBadge
                    label={mount.removed_at ? "Storico" : "Attivo"}
                    tone={mount.removed_at ? "neutral" : "green"}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="race-mini-panel">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      Montato il
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {formatDate(mount.mounted_at)}
                    </div>
                  </div>

                  <div className="race-mini-panel">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      <LocalizedText text="Operatore" />
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {mount.mounted_by_team_user_id?.name ||
                        mount.mounted_by_team_user_id?.email ||
                        "—"}
                    </div>
                  </div>

                  <div className="race-mini-panel sm:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      Smontato il
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {formatDate(mount.removed_at)}
                    </div>
                  </div>
                </div>

                {mount.reason ? (
                  <div className="mt-4 rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-3 text-sm leading-6 text-yellow-200">
                    {mount.reason}
                  </div>
                ) : null}

                {!mount.removed_at && canEditMounts ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => unmount(mount.id, mount.components?.id)}
                      className="race-action-danger px-4 py-2 text-sm"
                    >
                      <Unlink size={16} className="mr-2 inline" />
                      <LocalizedText text="Smonta componente" />
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

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="race-mini-panel">
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
