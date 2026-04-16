"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  CarFront,
  Clock3,
  FileText,
  ShieldAlert,
  Wrench,
  Edit,
  RotateCcw,
  Link2,
  Unlink,
  Save,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import PagePermissionState from "@/components/PagePermissionState";
import { usePermissionAccess } from "@/lib/permissions";

type ComponentRow = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
  notes: string | null;
  car_id: string | null;
  created_at: string;
  last_maintenance_date: string | null;
};

type MountedCar = { id: string; name: string; chassis_number: string | null };
type CarOption = { id: string; name: string; chassis_number: string | null };

type MaintenanceRow = {
  id: string;
  date: string | null;
  type: string | null;
  status: string | null;
  priority: string | null;
  notes: string | null;
};

type RevisionRow = {
  id: string;
  date: string;
  description: string | null;
  notes: string | null;
  reset_hours: boolean;
  created_at: string;
};

type DocumentRow = {
  id: string;
  title: string | null;
  type: string | null;
  file_url: string | null;
  file_name: string | null;
  uploaded_at: string;
};

type EditForm = {
  type: string;
  identifier: string;
  hours: string;
  life_hours: string;
  warning_threshold_hours: string;
  revision_threshold_hours: string;
  expiry_date: string;
  notes: string;
};

type RevisionForm = {
  date: string;
  description: string;
  notes: string;
  reset_hours: boolean;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatHours(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)} h`;
}

function getStatus(component: ComponentRow) {
  const hours = Number(component.hours || 0);
  if (component.expiry_date && new Date(component.expiry_date) < new Date()) {
    return { label: "Scaduto", tone: "red" as const };
  }
  if (
    component.revision_threshold_hours !== null &&
    component.revision_threshold_hours !== undefined &&
    hours >= component.revision_threshold_hours
  ) {
    return { label: "Fuori soglia", tone: "red" as const };
  }
  if (
    component.warning_threshold_hours !== null &&
    component.warning_threshold_hours !== undefined &&
    hours >= component.warning_threshold_hours
  ) {
    return { label: "In attenzione", tone: "yellow" as const };
  }
  return { label: "OK", tone: "green" as const };
}

function parseNullableNumber(value: string) {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function ComponentDetailPage() {
  const params = useParams();
  const componentId = params?.id as string;

  const access = usePermissionAccess();
  const canViewComponents = access.hasPermission("components.view");
  const canEditComponents = access.hasPermission("components.edit", ["owner", "admin"]);

  const [component, setComponent] = useState<ComponentRow | null>(null);
  const [mountedCar, setMountedCar] = useState<MountedCar | null>(null);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceRow[]>([]);
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [openEdit, setOpenEdit] = useState(false);
  const [openRevision, setOpenRevision] = useState(false);
  const [openMount, setOpenMount] = useState(false);

  const [savingEdit, setSavingEdit] = useState(false);
  const [savingRevision, setSavingRevision] = useState(false);
  const [savingMount, setSavingMount] = useState(false);

  const [editForm, setEditForm] = useState<EditForm>({
    type: "",
    identifier: "",
    hours: "0",
    life_hours: "",
    warning_threshold_hours: "",
    revision_threshold_hours: "",
    expiry_date: "",
    notes: "",
  });

  const [revisionForm, setRevisionForm] = useState<RevisionForm>({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    notes: "",
    reset_hours: false,
  });

  const [selectedCarId, setSelectedCarId] = useState("");
  const [mountDate, setMountDate] = useState(new Date().toISOString().slice(0, 10));
  const [mountReason, setMountReason] = useState("");
  const [toast, setToast] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [componentRes, maintRes, revRes, docsRes, carsRes] = await Promise.all([
        supabase
          .from("components")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("id", componentId)
          .single(),
        supabase
          .from("maintenances")
          .select("id,date,type,status,priority,notes")
          .eq("team_id", ctx.teamId)
          .eq("component_id", componentId)
          .order("date", { ascending: false }),
        supabase
          .from("component_revisions")
          .select("id,date,description,notes,reset_hours,created_at")
          .eq("team_id", ctx.teamId)
          .eq("component_id", componentId)
          .order("date", { ascending: false }),
        supabase
          .from("documents")
          .select("id,title,type,file_url,file_name,uploaded_at")
          .eq("team_id", ctx.teamId)
          .eq("component_id", componentId)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("cars")
          .select("id,name,chassis_number")
          .eq("team_id", ctx.teamId)
          .order("name", { ascending: true }),
      ]);

      const componentData = componentRes.data as ComponentRow | null;
      setComponent(componentData);
      setMaintenances((maintRes.data || []) as MaintenanceRow[]);
      setRevisions((revRes.data || []) as RevisionRow[]);
      setDocuments((docsRes.data || []) as DocumentRow[]);
      setCars((carsRes.data || []) as CarOption[]);

      if (componentData) {
        setEditForm({
          type: componentData.type || "",
          identifier: componentData.identifier || "",
          hours: String(componentData.hours ?? 0),
          life_hours:
            componentData.life_hours !== null && componentData.life_hours !== undefined
              ? String(componentData.life_hours)
              : "",
          warning_threshold_hours:
            componentData.warning_threshold_hours !== null &&
            componentData.warning_threshold_hours !== undefined
              ? String(componentData.warning_threshold_hours)
              : "",
          revision_threshold_hours:
            componentData.revision_threshold_hours !== null &&
            componentData.revision_threshold_hours !== undefined
              ? String(componentData.revision_threshold_hours)
              : "",
          expiry_date: componentData.expiry_date || "",
          notes: componentData.notes || "",
        });
      }

      if (componentData?.car_id) {
        const { data: carData } = await supabase
          .from("cars")
          .select("id,name,chassis_number")
          .eq("team_id", ctx.teamId)
          .eq("id", componentData.car_id)
          .single();
        setMountedCar((carData || null) as MountedCar | null);
      } else {
        setMountedCar(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewComponents && componentId) {
      void loadAll();
    }
  }, [access.loading, canViewComponents, componentId]);

  const status = useMemo(
    () => (component ? getStatus(component) : { label: "—", tone: "neutral" as const }),
    [component]
  );

  const stats: StatItem[] = [
    { label: "Ore attuali", value: formatHours(component?.hours), icon: <Clock3 size={18} /> },
    {
      label: "Vita componente",
      value: formatHours(component?.life_hours),
      icon: <ShieldAlert size={18} />,
    },
    {
      label: "Manutenzioni",
      value: String(maintenances.length),
      icon: <Wrench size={18} />,
    },
    {
      label: "Revisioni",
      value: String(revisions.length),
      icon: <CalendarClock size={18} />,
    },
  ];

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  async function saveComponentEdits() {
    if (!canEditComponents || !component) return;
    if (!editForm.type.trim() || !editForm.identifier.trim()) {
      alert("Tipo e identificativo sono obbligatori");
      return;
    }

    setSavingEdit(true);
    try {
      const ctx = await getCurrentTeamContext();
      const payload = {
        type: editForm.type.trim(),
        identifier: editForm.identifier.trim(),
        hours: Number(editForm.hours || 0),
        life_hours: Number(editForm.life_hours || 0),
        warning_threshold_hours: parseNullableNumber(editForm.warning_threshold_hours),
        revision_threshold_hours: parseNullableNumber(editForm.revision_threshold_hours),
        expiry_date: editForm.expiry_date || null,
        notes: editForm.notes.trim() || null,
      };

      const { error } = await supabase
        .from("components")
        .update(payload)
        .eq("team_id", ctx.teamId)
        .eq("id", component.id);

      if (error) throw error;
      setOpenEdit(false);
      showToast("Componente aggiornato");
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Errore durante il salvataggio del componente");
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveRevision() {
    if (!canEditComponents || !component) return;

    setSavingRevision(true);
    try {
      const ctx = await getCurrentTeamContext();
      const hoursBefore = Number(component.hours || 0);
      const hoursAfter = revisionForm.reset_hours ? 0 : hoursBefore;

      const { error: revisionError } = await supabase
        .from("component_revisions")
        .insert([
          {
            team_id: ctx.teamId,
            component_id: component.id,
            date: revisionForm.date,
            description: revisionForm.description.trim() || "Revisione componente",
            notes: revisionForm.notes.trim() || null,
            reset_hours: revisionForm.reset_hours,
            hours_before_reset: hoursBefore,
            hours_after_reset: hoursAfter,
            life_hours_at_revision: Number(component.life_hours || 0),
            created_by_team_user_id: ctx.teamUserId,
          },
        ]);

      if (revisionError) throw revisionError;

      const componentUpdate: Record<string, unknown> = {
        last_maintenance_date: revisionForm.date,
      };

      if (revisionForm.reset_hours) {
        componentUpdate.hours = 0;
      }

      const { error: componentError } = await supabase
        .from("components")
        .update(componentUpdate)
        .eq("team_id", ctx.teamId)
        .eq("id", component.id);

      if (componentError) throw componentError;

      setOpenRevision(false);
      setRevisionForm({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        notes: "",
        reset_hours: false,
      });
      showToast(revisionForm.reset_hours ? "Revisione registrata con reset ore" : "Revisione registrata");
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Errore durante la registrazione della revisione");
    } finally {
      setSavingRevision(false);
    }
  }

  async function unmountComponent() {
    if (!canEditComponents || !component?.car_id) return;

    setSavingMount(true);
    try {
      const ctx = await getCurrentTeamContext();
      const today = new Date().toISOString();

      const { error: historyError } = await supabase
        .from("car_components")
        .update({
          removed_at: today,
          removed_by_team_user_id: ctx.teamUserId,
          status: "unmounted",
        })
        .eq("team_id", ctx.teamId)
        .eq("component_id", component.id)
        .is("removed_at", null);

      if (historyError) throw historyError;

      const { error: componentError } = await supabase
        .from("components")
        .update({ car_id: null })
        .eq("team_id", ctx.teamId)
        .eq("id", component.id);

      if (componentError) throw componentError;

      showToast("Componente smontato");
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Errore durante lo smontaggio del componente");
    } finally {
      setSavingMount(false);
    }
  }

  async function mountComponent() {
    if (!canEditComponents || !component || !selectedCarId) {
      return;
    }

    setSavingMount(true);
    try {
      const ctx = await getCurrentTeamContext();
      const mountedAt = mountDate || new Date().toISOString().slice(0, 10);

      const { error: historyError } = await supabase.from("car_components").insert([
        {
          team_id: ctx.teamId,
          car_id: selectedCarId,
          component_id: component.id,
          mounted_at: mountedAt,
          installed_at: mountedAt,
          status: "mounted",
          mounted_by_team_user_id: ctx.teamUserId,
          reason: mountReason.trim() || null,
        },
      ]);

      if (historyError) throw historyError;

      const { error: componentError } = await supabase
        .from("components")
        .update({ car_id: selectedCarId })
        .eq("team_id", ctx.teamId)
        .eq("id", component.id);

      if (componentError) throw componentError;

      setOpenMount(false);
      setSelectedCarId("");
      setMountReason("");
      setMountDate(new Date().toISOString().slice(0, 10));
      showToast("Componente montato");
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Errore durante il montaggio del componente");
    } finally {
      setSavingMount(false);
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Scheda componente"
        subtitle="Stato tecnico, revisioni e montaggio"
        icon={<Boxes size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Scheda componente"
        subtitle="Stato tecnico, revisioni e montaggio"
        icon={<Boxes size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewComponents) {
    return (
      <PagePermissionState
        title="Scheda componente"
        subtitle="Stato tecnico, revisioni e montaggio"
        icon={<Boxes size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo componenti."
      />
    );
  }

  if (loading) {
    return <div className="p-6 text-neutral-500">Caricamento componente...</div>;
  }

  if (!component) {
    return <div className="p-6 font-semibold text-red-600">Componente non trovato.</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-black shadow-lg">
          {toast}
        </div>
      ) : null}

      <PageHeader
        title={`${component.type} · ${component.identifier}`}
        subtitle="Scheda tecnica completa del componente"
        icon={<Boxes size={22} />}
        actions={
          <>
            {canEditComponents ? (
              <>
                <button
                  onClick={() => setOpenEdit(true)}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-900 hover:bg-neutral-100"
                >
                  <Edit size={16} className="mr-2 inline" />
                  Modifica componente
                </button>
                <button
                  onClick={() => setOpenRevision(true)}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-900 hover:bg-neutral-100"
                >
                  <RotateCcw size={16} className="mr-2 inline" />
                  Revisione / reset ore
                </button>
                {mountedCar ? (
                  <button
                    onClick={() => void unmountComponent()}
                    disabled={savingMount}
                    className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    <Unlink size={16} className="mr-2 inline" />
                    {savingMount ? "Smontaggio..." : "Smonta componente"}
                  </button>
                ) : (
                  <button
                    onClick={() => setOpenMount(true)}
                    className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                  >
                    <Link2 size={16} className="mr-2 inline" />
                    Monta su auto
                  </button>
                )}
              </>
            ) : null}
            <Link href="/components" className="rounded-xl bg-neutral-100 px-4 py-2">
              <ArrowLeft size={16} className="mr-2 inline" />
              Componenti
            </Link>
          </>
        }
      />

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Stato tecnico"
          subtitle="Dati del componente, soglie e indicazioni operative"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Info label="Tipo" value={component.type} />
            <Info label="Identificativo" value={component.identifier} />
            <Info
              label="Ultima manutenzione"
              value={formatDate(component.last_maintenance_date)}
            />
            <Info
              label="Scadenza"
              value={formatDate(component.expiry_date)}
            />
            <Info
              label="Soglia attenzione"
              value={
                component.warning_threshold_hours !== null &&
                component.warning_threshold_hours !== undefined
                  ? formatHours(component.warning_threshold_hours)
                  : "—"
              }
            />
            <Info
              label="Soglia revisione"
              value={
                component.revision_threshold_hours !== null &&
                component.revision_threshold_hours !== undefined
                  ? formatHours(component.revision_threshold_hours)
                  : "—"
              }
            />
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm text-neutral-500">Stato</div>
              <div className="mt-2 flex items-center gap-3">
                <StatusBadge label={status.label} tone={status.tone} />
                <StatusBadge
                  label={mountedCar ? "Montato" : "Smontato"}
                  tone={mountedCar ? "green" : "neutral"}
                />
              </div>
              <div className="mt-3 text-xs leading-5 text-neutral-500">
                Usa “Revisione / reset ore” quando l’intervento comporta un ripristino del
                componente. Usa invece la scheda manutenzioni per lavori ordinari o da pianificare.
              </div>
            </div>
          </div>
          {component.notes ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm whitespace-pre-wrap text-neutral-700">
              {component.notes}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Posizione attuale"
          subtitle="Montaggio rapido e stato del componente sul mezzo"
        >
          {mountedCar ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <CarFront size={16} className="text-yellow-600" />
                Mezzo montato
              </div>
              <div className="mt-2 text-lg font-bold text-neutral-900">{mountedCar.name}</div>
              <div className="mt-1 text-sm text-neutral-500">
                Telaio {mountedCar.chassis_number || "—"}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/cars/${mountedCar.id}`}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  Apri scheda mezzo
                </Link>
                <Link
                  href="/mounts"
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  Storico montaggi
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Componente attualmente smontato"
              description="Puoi montarlo da qui oppure dal modulo Montaggi."
            />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Storico manutenzioni"
          subtitle="Interventi tecnici eseguiti sul componente"
        >
          {maintenances.length === 0 ? (
            <EmptyState title="Nessuna manutenzione registrata" />
          ) : (
            <div className="space-y-3">
              {maintenances.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-neutral-900">
                        {row.type || "Manutenzione"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {formatDate(row.date)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {row.status ? (
                        <StatusBadge
                          label={row.status}
                          tone={
                            row.status === "completed"
                              ? "green"
                              : row.status === "open"
                              ? "yellow"
                              : "neutral"
                          }
                        />
                      ) : null}
                      {row.priority ? (
                        <StatusBadge
                          label={row.priority}
                          tone={
                            row.priority === "high"
                              ? "red"
                              : row.priority === "medium"
                              ? "yellow"
                              : "neutral"
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                  {row.notes ? (
                    <div className="mt-2 text-sm whitespace-pre-wrap text-neutral-700">
                      {row.notes}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Revisioni e documenti"
          subtitle="Storico revisioni e allegati collegati"
        >
          <div className="space-y-4">
            <div>
              <div className="mb-2 font-semibold text-neutral-900">Revisioni</div>
              {revisions.length === 0 ? (
                <EmptyState title="Nessuna revisione registrata" />
              ) : (
                <div className="space-y-3">
                  {revisions.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-neutral-900">
                            {formatDate(row.date)}
                          </div>
                          <div className="mt-1 text-sm text-neutral-500">
                            {row.reset_hours ? "Con reset ore" : "Senza reset ore"}
                          </div>
                        </div>
                        <StatusBadge
                          label={row.reset_hours ? "Reset ore" : "Revisione"}
                          tone={row.reset_hours ? "purple" : "blue"}
                        />
                      </div>
                      {row.description ? (
                        <div className="mt-2 text-sm whitespace-pre-wrap text-neutral-700">
                          {row.description}
                        </div>
                      ) : null}
                      {row.notes ? (
                        <div className="mt-2 text-xs whitespace-pre-wrap text-neutral-500">
                          {row.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 font-semibold text-neutral-900">
                <FileText size={16} />
                Documenti
              </div>
              {documents.length === 0 ? (
                <EmptyState title="Nessun documento collegato" />
              ) : (
                <div className="space-y-3">
                  {documents.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                    >
                      <div className="font-bold text-neutral-900">
                        {row.title || row.type || "Documento"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {row.file_name || formatDate(row.uploaded_at)}
                      </div>
                      {row.file_url ? (
                        <a
                          href={row.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold"
                        >
                          Apri file
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {openEdit ? (
        <ModalShell
          title="Modifica componente"
          subtitle="Aggiorna i dati tecnici direttamente dalla scheda componente."
          onClose={() => setOpenEdit(false)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Tipo" required>
              <input
                className="w-full rounded-xl border p-3"
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              />
            </Field>
            <Field label="Identificativo" required>
              <input
                className="w-full rounded-xl border p-3"
                value={editForm.identifier}
                onChange={(e) =>
                  setEditForm({ ...editForm, identifier: e.target.value })
                }
              />
            </Field>
            <Field label="Ore attuali">
              <input
                className="w-full rounded-xl border p-3"
                type="number"
                min="0"
                step="0.1"
                value={editForm.hours}
                onChange={(e) => setEditForm({ ...editForm, hours: e.target.value })}
              />
              <FieldHint>Ore già maturate dal componente.</FieldHint>
            </Field>
            <Field label="Vita totale">
              <input
                className="w-full rounded-xl border p-3"
                type="number"
                min="0"
                step="0.1"
                value={editForm.life_hours}
                onChange={(e) =>
                  setEditForm({ ...editForm, life_hours: e.target.value })
                }
              />
              <FieldHint>Ore previste prima della sostituzione.</FieldHint>
            </Field>
            <Field label="Soglia attenzione">
              <input
                className="w-full rounded-xl border p-3"
                type="number"
                min="0"
                step="0.1"
                value={editForm.warning_threshold_hours}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    warning_threshold_hours: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Soglia revisione">
              <input
                className="w-full rounded-xl border p-3"
                type="number"
                min="0"
                step="0.1"
                value={editForm.revision_threshold_hours}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    revision_threshold_hours: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Scadenza">
              <input
                className="w-full rounded-xl border p-3"
                type="date"
                value={editForm.expiry_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, expiry_date: e.target.value })
                }
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Note tecniche">
                <textarea
                  className="min-h-28 w-full rounded-xl border p-3"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setOpenEdit(false)}
              className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold"
            >
              Annulla
            </button>
            <button
              onClick={() => void saveComponentEdits()}
              disabled={savingEdit}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
            >
              <Save size={16} className="mr-2 inline" />
              {savingEdit ? "Salvataggio..." : "Salva componente"}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {openRevision ? (
        <ModalShell
          title="Revisione componente"
          subtitle="Registra l’intervento e scegli se azzerare o meno le ore del componente."
          onClose={() => setOpenRevision(false)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Data revisione" required>
              <input
                className="w-full rounded-xl border p-3"
                type="date"
                value={revisionForm.date}
                onChange={(e) =>
                  setRevisionForm({ ...revisionForm, date: e.target.value })
                }
              />
            </Field>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm text-neutral-500">Ore attuali da revisionare</div>
              <div className="mt-1 text-lg font-bold text-neutral-900">
                {formatHours(component.hours)}
              </div>
            </div>
            <div className="md:col-span-2">
              <Field label="Descrizione intervento">
                <input
                  className="w-full rounded-xl border p-3"
                  value={revisionForm.description}
                  onChange={(e) =>
                    setRevisionForm({
                      ...revisionForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Es. revisione banco, controllo completo, cambio paraoli"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Note revisione">
                <textarea
                  className="min-h-28 w-full rounded-xl border p-3"
                  value={revisionForm.notes}
                  onChange={(e) =>
                    setRevisionForm({ ...revisionForm, notes: e.target.value })
                  }
                />
              </Field>
            </div>
            <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <input
                type="checkbox"
                checked={revisionForm.reset_hours}
                onChange={(e) =>
                  setRevisionForm({
                    ...revisionForm,
                    reset_hours: e.target.checked,
                  })
                }
                className="mt-1 h-4 w-4"
              />
              <div>
                <div className="font-semibold text-neutral-900">
                  Azzera le ore del componente
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  Attivalo solo se la revisione riporta il componente a zero ore operative.
                </div>
              </div>
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setOpenRevision(false)}
              className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold"
            >
              Annulla
            </button>
            <button
              onClick={() => void saveRevision()}
              disabled={savingRevision}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
            >
              <RotateCcw size={16} className="mr-2 inline" />
              {savingRevision ? "Salvataggio..." : "Registra revisione"}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {openMount ? (
        <ModalShell
          title="Monta componente"
          subtitle="Scegli l’auto su cui montare il componente e registra la data di montaggio."
          onClose={() => setOpenMount(false)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Auto di destinazione" required>
              <select
                className="w-full rounded-xl border p-3"
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
              >
                <option value="">Seleziona auto</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name} {car.chassis_number ? `· ${car.chassis_number}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data montaggio">
              <input
                className="w-full rounded-xl border p-3"
                type="date"
                value={mountDate}
                onChange={(e) => setMountDate(e.target.value)}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Motivo / note montaggio">
                <textarea
                  className="min-h-24 w-full rounded-xl border p-3"
                  value={mountReason}
                  onChange={(e) => setMountReason(e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setOpenMount(false)}
              className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold"
            >
              Annulla
            </button>
            <button
              onClick={() => void mountComponent()}
              disabled={savingMount || !selectedCarId}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:opacity-60"
            >
              <Link2 size={16} className="mr-2 inline" />
              {savingMount ? "Montaggio..." : "Conferma montaggio"}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold text-neutral-900">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-neutral-500">{subtitle}</div> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-neutral-100 p-2 text-neutral-600 hover:bg-neutral-200"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-neutral-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 text-xs leading-5 text-neutral-500">{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-base font-bold text-neutral-900">{value}</div>
    </div>
  );
}
