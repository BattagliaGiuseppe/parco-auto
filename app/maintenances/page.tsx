"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext, getTeamUsers } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import {
  Edit,
  PlusCircle,
  X,
  Wrench,
  CalendarDays,
  CarFront,
  Boxes,
  RotateCcw,
  Info,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import StatusBadge from "@/components/StatusBadge";
import ModalShell from "@/components/ModalShell";
import { Button } from "@/components/Button";
import {
  uiInputClassName,
  uiSelectClassName,
  uiTextareaClassName,
} from "@/components/UiField";
import { formatComponentHours } from "@/lib/componentStatus";

type CarOption = { id: string; name: string };
type ComponentOption = {
  id: string;
  identifier: string;
  type: string | null;
  hours: number | null;
  life_hours: number | null;
};

type MaintenanceForm = {
  carId: string;
  componentId: string;
  date: string;
  type: string;
  notes: string;
  status: string;
  priority: string;
  assignedTo: string;
  registerRevision: boolean;
  resetHours: boolean;
  revisionDescription: string;
};

const emptyForm: MaintenanceForm = {
  carId: "",
  componentId: "",
  date: new Date().toISOString().slice(0, 10),
  type: "",
  notes: "",
  status: "completed",
  priority: "medium",
  assignedTo: "",
  registerRevision: false,
  resetHours: false,
  revisionDescription: "",
};

export default function MaintenancesPage() {
  const access = usePermissionAccess();
  const canViewMaintenances = access.hasPermission("maintenances.view");
  const canEditMaintenances = access.hasPermission("maintenances.edit", [
    "owner",
    "admin",
  ]);

  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MaintenanceForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cars, setCars] = useState<CarOption[]>([]);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [teamRole, setTeamRole] = useState("viewer");
  const [toast, setToast] = useState("");

  async function fetchMaintenances() {
    setLoading(true);
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase
      .from("maintenances")
      .select(
        "id, date, type, notes, status, priority, car_id(id,name), component_id(id,identifier,type), assigned_to_team_user_id(id,name,email)",
      )
      .eq("team_id", ctx.teamId)
      .order("date", { ascending: false });
    setMaintenances(data || []);
    setLoading(false);
  }

  async function fetchCarsAndComponents() {
    const ctx = await getCurrentTeamContext();
    const [carsRes, compsRes, teamUsersRes] = await Promise.all([
      supabase
        .from("cars")
        .select("id, name")
        .eq("team_id", ctx.teamId)
        .order("name"),
      supabase
        .from("components")
        .select("id, identifier, type, hours, life_hours")
        .eq("team_id", ctx.teamId)
        .order("identifier"),
      getTeamUsers(),
    ]);
    setTeamRole(ctx.role);
    setCars((carsRes.data || []) as CarOption[]);
    setComponents((compsRes.data || []) as ComponentOption[]);
    setTeamUsers(teamUsersRes || []);
  }

  useEffect(() => {
    if (!access.loading && canViewMaintenances) {
      void fetchMaintenances();
      void fetchCarsAndComponents();
    }
  }, [access.loading, canViewMaintenances]);

  const stats = useMemo(
    () => [
      {
        label: "Totale",
        value: String(maintenances.length),
        icon: <Wrench size={18} />,
      },
      {
        label: "Aperte",
        value: String(
          maintenances.filter((m) => m.status !== "completed").length,
        ),
        icon: <CalendarDays size={18} />,
      },
      {
        label: "Auto coinvolte",
        value: String(
          new Set(maintenances.map((m) => m.car_id?.id).filter(Boolean)).size,
        ),
        icon: <CarFront size={18} />,
      },
      {
        label: "Componenti",
        value: String(
          new Set(maintenances.map((m) => m.component_id?.id).filter(Boolean))
            .size,
        ),
        icon: <Boxes size={18} />,
      },
    ],
    [maintenances],
  );

  const selectedComponent =
    components.find((component) => component.id === form.componentId) || null;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.carId) next.carId = "Seleziona un mezzo";
    if (!form.componentId) next.componentId = "Seleziona un componente";
    if (!form.date) next.date = "Inserisci la data";
    if (!form.type.trim()) next.type = "Inserisci il tipo intervento";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function openForEdit(m: any) {
    if (!canEditMaintenances) return;
    setEditId(m.id);
    setForm({
      carId: m.car_id?.id || "",
      componentId: m.component_id?.id || "",
      date: m.date || new Date().toISOString().slice(0, 10),
      type: m.type || "",
      notes: m.notes || "",
      status: m.status || "completed",
      priority: m.priority || "medium",
      assignedTo: m.assigned_to_team_user_id?.id || "",
      registerRevision: false,
      resetHours: false,
      revisionDescription: "",
    });
    setErrors({});
    setOpenModal(true);
  }

  async function saveMaintenance() {
    if (!canEditMaintenances || !validate()) return;

    if (!editId && form.registerRevision && form.status !== "completed") {
      alert(
        "La revisione componente può essere registrata solo su una manutenzione completata.",
      );
      return;
    }

    setSaving(true);

    try {
      const ctx = await getCurrentTeamContext();

      const payload = {
        car_id: form.carId,
        component_id: form.componentId,
        date: form.date,
        type: form.type.trim(),
        notes: form.notes.trim() || null,
        status: form.status,
        priority: form.priority,
        assigned_to_team_user_id: form.assignedTo || null,
        created_by_team_user_id: ctx.teamUserId,
      };

      if (editId) {
        const { error } = await supabase
          .from("maintenances")
          .update(payload)
          .eq("id", editId)
          .eq("team_id", ctx.teamId);

        if (error) throw error;

        if (form.componentId && form.status === "completed") {
          const { error: componentTouchError } = await supabase
            .from("components")
            .update({ last_maintenance_date: form.date })
            .eq("team_id", ctx.teamId)
            .eq("id", form.componentId);

          if (componentTouchError) throw componentTouchError;
        }
      } else {
        const { error } = await supabase.rpc(
          "create_maintenance_with_revision",
          {
            p_team_id: ctx.teamId,
            p_car_id: form.carId,
            p_component_id: form.componentId,
            p_date: form.date,
            p_type: form.type.trim(),
            p_notes: form.notes.trim() || null,
            p_status: form.status,
            p_priority: form.priority,
            p_assigned_to_team_user_id: form.assignedTo || null,
            p_created_by_team_user_id: ctx.teamUserId,
            p_register_revision: form.registerRevision,
            p_reset_hours: form.resetHours,
            p_revision_description:
              form.revisionDescription.trim() || form.type.trim(),
          },
        );

        if (error) throw error;
      }

      setOpenModal(false);
      setEditId(null);
      setForm(emptyForm);

      await fetchMaintenances();
      await fetchCarsAndComponents();

      showToast(
        !editId && form.registerRevision
          ? form.resetHours
            ? "Manutenzione salvata con revisione e reset ore"
            : "Manutenzione salvata con revisione"
          : "Manutenzione salvata",
      );
    } catch (e) {
      console.error("Errore salvataggio manutenzione:", e);
      alert("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const canAssign =
    canEditMaintenances && (teamRole === "owner" || teamRole === "admin");

  if (access.loading) {
    return (
      <PagePermissionState
        title="Manutenzioni"
        subtitle="Workflow tecnico con priorità, stato e assegnazione"
        icon={<Wrench size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Manutenzioni"
        subtitle="Workflow tecnico con priorità, stato e assegnazione"
        icon={<Wrench size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewMaintenances) {
    return (
      <PagePermissionState
        title="Manutenzioni"
        subtitle="Workflow tecnico con priorità, stato e assegnazione"
        icon={<Wrench size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo manutenzioni."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-xl bg-[var(--brand-accent)] px-4 py-3 font-semibold text-[var(--brand-on-accent)] shadow-lg">
          {toast}
        </div>
      ) : null}

      <PageHeader
        title="Manutenzioni"
        subtitle="Workflow tecnico con priorità, stato, assegnazione e collegamento alle revisioni."
        icon={<Wrench size={22} />}
        actions={
          canEditMaintenances ? (
            <Button
              onClick={() => {
                setOpenModal(true);
                setEditId(null);
                setForm(emptyForm);
                setErrors({});
              }}
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi manutenzione
            </Button>
          ) : undefined
        }
      />

      {!canEditMaintenances ? (
        <div className="rounded-2xl border border-blue-400/25 bg-blue-400/10 px-4 py-3 text-sm text-blue-200">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Manutenzione e revisione ora lavorano insieme in modo più chiaro."
      >
        <div className="race-info-box text-sm leading-6">
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 shrink-0" />
            <div>
              Usa la manutenzione per registrare o pianificare un intervento. Se
              l’intervento corrisponde a una revisione del componente, attiva
              anche la sezione
              <strong> “Registra anche revisione”</strong>. Da lì puoi scegliere
              se
              <strong> azzerare o no le ore</strong> del componente.
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Storico interventi">
        {loading ? (
          <div className="text-[var(--text-secondary)]">Caricamento...</div>
        ) : maintenances.length === 0 ? (
          <EmptyState title="Nessuna manutenzione registrata" />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {maintenances.map((m) => (
              <div key={m.id} className="data-row">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">
                      {m.type}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">
                      {m.car_id?.name || "—"} ·{" "}
                      {m.component_id?.identifier
                        ? `${m.component_id?.type || "Componente"} · ${m.component_id?.identifier}`
                        : "—"}
                    </div>
                  </div>
                  {canEditMaintenances ? (
                    <button
                      onClick={() => openForEdit(m)}
                      className="race-action-secondary px-3 py-2 text-sm"
                    >
                      <Edit size={16} className="mr-2 inline" />
                      Modifica
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <InfoMini
                    label="Data"
                    value={
                      m.date
                        ? new Date(m.date).toLocaleDateString("it-IT")
                        : "—"
                    }
                  />
                  <InfoMini label="Priorità" value={m.priority || "—"} />
                  <InfoMini label="Stato" value={m.status || "—"} />
                  <InfoMini
                    label="Assegnato a"
                    value={
                      m.assigned_to_team_user_id?.name ||
                      m.assigned_to_team_user_id?.email ||
                      "—"
                    }
                  />
                </div>
                {m.notes ? (
                  <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm text-[var(--text-secondary)]">
                    {m.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {openModal && canEditMaintenances ? (
        <ModalShell
          title={editId ? "Modifica manutenzione" : "Aggiungi manutenzione"}
          subtitle="Scheda coerente con il flusso componenti e revisione."
          onClose={() => setOpenModal(false)}
          maxWidth="max-w-4xl"
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpenModal(false)}>
                Annulla
              </Button>
              <Button onClick={() => void saveMaintenance()} disabled={saving}>
                {saving ? "Salvataggio..." : "Salva manutenzione"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Mezzo" required error={errors.carId}>
              <select
                className={uiSelectClassName}
                value={form.carId}
                onChange={(e) => setForm({ ...form, carId: e.target.value })}
              >
                <option value="">Seleziona mezzo</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Componente" required error={errors.componentId}>
              <select
                className={uiSelectClassName}
                value={form.componentId}
                onChange={(e) =>
                  setForm({ ...form, componentId: e.target.value })
                }
              >
                <option value="">Seleziona componente</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.type || "Componente"} · {c.identifier}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Data" required error={errors.date}>
              <input
                type="date"
                className={uiInputClassName}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>

            <Field label="Tipo intervento" required error={errors.type}>
              <input
                className={uiInputClassName}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="Es. revisione, sostituzione, controllo"
              />
            </Field>

            <Field label="Stato">
              <select
                className={uiSelectClassName}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="open">Aperta</option>
                <option value="in_progress">In corso</option>
                <option value="completed">Completata</option>
              </select>
            </Field>

            <Field label="Priorità">
              <select
                className={uiSelectClassName}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Bassa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </Field>

            {canAssign ? (
              <Field label="Assegna a">
                <select
                  className={uiSelectClassName}
                  value={form.assignedTo}
                  onChange={(e) =>
                    setForm({ ...form, assignedTo: e.target.value })
                  }
                >
                  <option value="">Nessuno</option>
                  {teamUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email || user.role}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="md:col-span-2">
              <Field label="Note">
                <textarea
                  className={uiTextareaClassName}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {selectedComponent ? (
            <div className="mt-6 race-mini-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold text-[var(--text-primary)]">
                    {selectedComponent.type || "Componente"} ·{" "}
                    {selectedComponent.identifier}
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    Ore attuali: {formatComponentHours(selectedComponent.hours)}{" "}
                    · Vita: {formatComponentHours(selectedComponent.life_hours)}
                  </div>
                </div>
                <StatusBadge label="Componente collegato" tone="blue" />
              </div>
            </div>
          ) : null}

          {!editId ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                <RotateCcw size={18} />
                Revisione componente
              </div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                Attiva questa sezione solo quando l’intervento equivale anche a
                una revisione del componente.
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <input
                  type="checkbox"
                  checked={form.registerRevision}
                  onChange={(e) =>
                    setForm({ ...form, registerRevision: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 accent-[var(--brand-accent)]"
                />
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    Registra anche revisione
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    Crea una riga nello storico revisioni del componente
                    selezionato.
                  </div>
                </div>
              </label>

              {form.registerRevision ? (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Descrizione revisione">
                    <input
                      className={uiInputClassName}
                      value={form.revisionDescription}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          revisionDescription: e.target.value,
                        })
                      }
                      placeholder="Es. revisione completa, sostituzione paraoli, banco prova"
                    />
                  </Field>

                  <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <input
                      type="checkbox"
                      checked={form.resetHours}
                      onChange={(e) =>
                        setForm({ ...form, resetHours: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 accent-[var(--brand-accent)]"
                    />
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">
                        Azzera ore componente
                      </div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">
                        Attivalo solo se la revisione riporta il componente a
                        zero ore operative.
                      </div>
                    </div>
                  </label>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-blue-400/25 bg-blue-400/10 p-4 text-sm text-blue-200">
              Le revisioni e l’eventuale reset ore si registrano sulle nuove
              manutenzioni, non durante la modifica di una manutenzione già
              esistente.
            </div>
          )}
        </ModalShell>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-[var(--text-secondary)]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {error ? <div className="mt-1 text-xs text-red-300">{error}</div> : null}
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="race-mini-panel">
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
