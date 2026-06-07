"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import PagePermissionState from "@/components/PagePermissionState";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import ModalShell from "@/components/ModalShell";
import { Button } from "@/components/Button";
import { UiField, uiInputClassName, uiSelectClassName, uiTextareaClassName } from "@/components/UiField";
import ViewModeToggle from "@/components/ViewModeToggle";
import { usePersistedViewMode } from "@/lib/usePersistedViewMode";
import { useLanguage } from "@/components/providers/LanguageProvider";
import LocalizedText from "@/components/LocalizedText";

type TaskStatus = "todo" | "in_progress" | "waiting" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type TaskArea = "auto" | "componenti" | "manutenzioni" | "magazzino" | "eventi" | "piloti" | "team" | "amministrazione" | "altro";

type TeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

type CarOption = { id: string; name: string };
type ComponentOption = { id: string; type: string | null; identifier: string | null; car_id: string | null };
type EventOption = { id: string; name: string; date: string | null };
type InventoryOption = { id: string; name: string };
type DriverOption = { id: string; first_name: string | null; last_name: string | null };

type TaskRow = {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  area: TaskArea;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to_team_user_id: string | null;
  car_id: string | null;
  component_id: string | null;
  event_id: string | null;
  maintenance_id: string | null;
  inventory_item_id: string | null;
  driver_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  car?: CarOption | null;
  component?: ComponentOption | null;
  event?: EventOption | null;
  inventory_item?: InventoryOption | null;
  driver?: DriverOption | null;
  assigned_to?: TeamMember | null;
};

type TaskFormState = {
  title: string;
  description: string;
  area: TaskArea;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  assigned_to_team_user_id: string;
  car_id: string;
  component_id: string;
  event_id: string;
  inventory_item_id: string;
  driver_id: string;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Da fare",
  in_progress: "In corso",
  waiting: "In attesa",
  done: "Completata",
  cancelled: "Annullata",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const AREA_LABELS: Record<TaskArea, string> = {
  auto: "Auto",
  componenti: "Componenti",
  manutenzioni: "Manutenzioni",
  magazzino: "Magazzino",
  eventi: "Eventi",
  piloti: "Piloti",
  team: "Team",
  amministrazione: "Amministrazione",
  altro: "Altro",
};

const EMPTY_FORM: TaskFormState = {
  title: "",
  description: "",
  area: "auto",
  status: "todo",
  priority: "medium",
  due_date: "",
  assigned_to_team_user_id: "",
  car_id: "",
  component_id: "",
  event_id: "",
  inventory_item_id: "",
  driver_id: "",
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function getStatusTone(status: TaskStatus): "neutral" | "green" | "yellow" | "red" | "blue" | "purple" {
  if (status === "done") return "green";
  if (status === "in_progress") return "blue";
  if (status === "waiting") return "yellow";
  if (status === "cancelled") return "neutral";
  return "purple";
}

function getPriorityTone(priority: TaskPriority): "neutral" | "green" | "yellow" | "red" | "blue" | "purple" {
  if (priority === "urgent") return "red";
  if (priority === "high") return "yellow";
  if (priority === "low") return "neutral";
  return "blue";
}

function getMemberLabel(member: TeamMember | null | undefined) {
  if (!member) return "Non assegnata";
  return member.name || member.email || "Membro team";
}

function getDriverLabel(driver: DriverOption | null | undefined) {
  if (!driver) return "";
  return [driver.first_name, driver.last_name].filter(Boolean).join(" ") || "Pilota";
}

function taskLinkSummary(task: TaskRow) {
  const parts = [
    task.car?.name ? `Auto: ${task.car.name}` : null,
    task.component?.identifier ? `Comp.: ${task.component.type || "componente"} ${task.component.identifier}` : null,
    task.event?.name ? `Evento: ${task.event.name}` : null,
    task.inventory_item?.name ? `Mag.: ${task.inventory_item.name}` : null,
    task.driver ? `Pilota: ${getDriverLabel(task.driver)}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Nessun collegamento operativo";
}

function isOpenTask(task: TaskRow) {
  return task.status !== "done" && task.status !== "cancelled";
}

export default function TasksPage() {
  const access = usePermissionAccess();
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
  const [viewMode, setViewMode] = usePersistedViewMode("parcoauto.tasks.viewMode", "compact");

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [inventory, setInventory] = useState<InventoryOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [areaFilter, setAreaFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [carFilter, setCarFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const canView = access.hasPermission("tasks.view", ["owner", "admin", "engineer", "mechanic", "viewer"]);
  const canEdit = access.hasPermission("tasks.edit", ["owner", "admin", "engineer", "mechanic"]);
  const canAssign = access.hasPermission("tasks.assign", ["owner", "admin", "engineer"]);
  const canDelete = access.hasPermission("tasks.delete", ["owner", "admin"]);

  async function loadData() {
    if (!access.ctx || !canView) return;

    setLoading(true);
    setError("");

    try {
      const ctx = access.ctx;
      const [tasksRes, membersRes, carsRes, componentsRes, eventsRes, inventoryRes, driversRes] = await Promise.all([
        supabase
          .from("tasks")
          .select(`
            *,
            car:car_id(id,name),
            component:component_id(id,type,identifier,car_id),
            event:event_id(id,name,date),
            inventory_item:inventory_item_id(id,name),
            driver:driver_id(id,first_name,last_name),
            assigned_to:assigned_to_team_user_id(id,name,email,role)
          `)
          .eq("team_id", ctx.teamId)
          .order("created_at", { ascending: false }),
        supabase
          .from("team_users")
          .select("id,name,email,role")
          .eq("team_id", ctx.teamId)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase.from("cars").select("id,name").eq("team_id", ctx.teamId).order("name", { ascending: true }),
        supabase.from("components").select("id,type,identifier,car_id").eq("team_id", ctx.teamId).order("identifier", { ascending: true }),
        supabase.from("events").select("id,name,date").eq("team_id", ctx.teamId).order("date", { ascending: false }).limit(80),
        supabase.from("inventory_items").select("id,name").eq("team_id", ctx.teamId).order("name", { ascending: true }).limit(250),
        supabase.from("drivers").select("id,first_name,last_name").eq("team_id", ctx.teamId).order("last_name", { ascending: true }),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (membersRes.error) throw membersRes.error;
      if (carsRes.error) throw carsRes.error;
      if (componentsRes.error) throw componentsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (driversRes.error) throw driversRes.error;

      const normalizedTasks: TaskRow[] = ((tasksRes.data || []) as any[]).map((row) => ({
        ...row,
        area: (row.area || "altro") as TaskArea,
        status: (row.status || "todo") as TaskStatus,
        priority: (row.priority || "medium") as TaskPriority,
        car: normalizeRelation<CarOption>(row.car),
        component: normalizeRelation<ComponentOption>(row.component),
        event: normalizeRelation<EventOption>(row.event),
        inventory_item: normalizeRelation<InventoryOption>(row.inventory_item),
        driver: normalizeRelation<DriverOption>(row.driver),
        assigned_to: normalizeRelation<TeamMember>(row.assigned_to),
      }));

      setTasks(normalizedTasks);
      setMembers((membersRes.data || []) as TeamMember[]);
      setCars((carsRes.data || []) as CarOption[]);
      setComponents((componentsRes.data || []) as ComponentOption[]);
      setEvents((eventsRes.data || []) as EventOption[]);
      setInventory((inventoryRes.data || []) as InventoryOption[]);
      setDrivers((driversRes.data || []) as DriverOption[]);
    } catch (err: any) {
      setError(err.message || "Errore durante il caricamento delle attività.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && access.ctx && canView) {
      void loadData();
    }
  }, [access.loading, access.ctx?.teamId, canView]);

  const filteredComponents = useMemo(() => {
    if (!form.car_id) return components;
    return components.filter((component) => !component.car_id || component.car_id === form.car_id);
  }, [components, form.car_id]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (statusFilter === "open" && !isOpenTask(task)) return false;
      if (statusFilter !== "all" && statusFilter !== "open" && task.status !== statusFilter) return false;
      if (areaFilter !== "all" && task.area !== areaFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "unassigned" && task.assigned_to_team_user_id) return false;
        if (assigneeFilter !== "unassigned" && task.assigned_to_team_user_id !== assigneeFilter) return false;
      }
      if (carFilter !== "all") {
        if (carFilter === "__no_car" && task.car_id) return false;
        if (carFilter !== "__no_car" && task.car_id !== carFilter) return false;
      }
      if (!q) return true;

      const haystack = [
        task.title,
        task.description,
        task.car?.name,
        task.component?.identifier,
        task.component?.type,
        task.event?.name,
        task.inventory_item?.name,
        getDriverLabel(task.driver),
        getMemberLabel(task.assigned_to),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [areaFilter, assigneeFilter, carFilter, priorityFilter, search, statusFilter, tasks]);

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; rows: TaskRow[] }>();

    for (const task of filteredTasks) {
      const key = task.car_id || "__no_car";
      const label = task.car?.name || "Attività non collegate ad auto";
      const group = groups.get(key) || { key, label, rows: [] as TaskRow[] };
      group.rows.push(task);
      groups.set(key, group);
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === "__no_car") return 1;
      if (b.key === "__no_car") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [filteredTasks]);

  const openTasks = useMemo(() => tasks.filter(isOpenTask), [tasks]);
  const urgentTasks = useMemo(() => openTasks.filter((task) => task.priority === "urgent"), [openTasks]);
  const dueSoonTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 7);

    return openTasks.filter((task) => {
      if (!task.due_date) return false;
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      return due <= limit;
    });
  }, [openTasks]);

  function openCreateModal() {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(task: TaskRow) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      area: task.area,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
      assigned_to_team_user_id: task.assigned_to_team_user_id || "",
      car_id: task.car_id || "",
      component_id: task.component_id || "",
      event_id: task.event_id || "",
      inventory_item_id: task.inventory_item_id || "",
      driver_id: task.driver_id || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setSaving(false);
  }

  function buildPayload() {
    const completedAt = form.status === "done" ? editingTask?.completed_at || new Date().toISOString() : null;

    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      area: form.area,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to_team_user_id: form.assigned_to_team_user_id || null,
      car_id: form.car_id || null,
      component_id: form.component_id || null,
      event_id: form.event_id || null,
      inventory_item_id: form.inventory_item_id || null,
      driver_id: form.driver_id || null,
      completed_at: completedAt,
    };
  }

  async function saveTask() {
    if (!access.ctx || !canEdit) return;
    if (!form.title.trim()) {
      setError("Inserisci un titolo per l'attività.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = buildPayload();

      if (editingTask) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update(payload)
          .eq("id", editingTask.id)
          .eq("team_id", access.ctx.teamId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("tasks").insert({
          ...payload,
          team_id: access.ctx.teamId,
          created_by_team_user_id: access.ctx.teamUserId,
          created_by_auth_user_id: access.ctx.authUserId,
        });

        if (insertError) throw insertError;
      }

      closeModal();
      await loadData();
    } catch (err: any) {
      setError(err.message || "Errore durante il salvataggio dell'attività.");
      setSaving(false);
    }
  }

  async function quickUpdate(task: TaskRow, patch: Partial<Pick<TaskRow, "status" | "priority">>) {
    if (!access.ctx || !canEdit) return;

    const nextStatus = patch.status || task.status;
    const completedAt = nextStatus === "done" ? task.completed_at || new Date().toISOString() : null;

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ ...patch, completed_at: completedAt })
      .eq("id", task.id)
      .eq("team_id", access.ctx.teamId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadData();
  }

  async function deleteTask(task: TaskRow) {
    if (!access.ctx || !canDelete) return;
    const confirmed = window.confirm(`Eliminare l'attività "${task.title}"?`);
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id)
      .eq("team_id", access.ctx.teamId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadData();
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title={tr("Attività")}
        subtitle="Task, promemoria e cose da fare collegate al lavoro del team"
        icon={<ClipboardList size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title={tr("Attività")}
        subtitle="Task, promemoria e cose da fare collegate al lavoro del team"
        icon={<ClipboardList size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canView) {
    return (
      <PagePermissionState
        title={tr("Attività")}
        subtitle="Task, promemoria e cose da fare collegate al lavoro del team"
        icon={<ClipboardList size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo attività."
      />
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title={tr("Attività")}
        subtitle="Promemoria operativi collegati ad auto, componenti, eventi, magazzino, piloti e persone del team."
        icon={<ClipboardList size={22} />}
        actions={
          canEdit ? (
            <Button onClick={openCreateModal}>
              <Plus size={16} className="mr-2" />
              <LocalizedText text="Nuova attività" />
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickStat icon={<ClipboardList size={18} />} label="Aperte" value={String(openTasks.length)} tone="blue" />
        <QuickStat icon={<AlertTriangle size={18} />} label="Urgenti" value={String(urgentTasks.length)} tone={urgentTasks.length ? "red" : "green"} />
        <QuickStat icon={<Clock3 size={18} />} label="Scadenza 7 giorni" value={String(dueSoonTasks.length)} tone={dueSoonTasks.length ? "yellow" : "green"} />
      </div>

      <SectionCard
        title={tr("Console attività")}
        subtitle="Vista sintetica di default, con filtri per auto, area, assegnatario, priorità e stato."
        actions={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
      >
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              className={`${uiInputClassName} pl-10`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr("Cerca attività, auto, componente...")}
            />
          </label>

          <select className={uiSelectClassName} value={carFilter} onChange={(e) => setCarFilter(e.target.value)}>
            <option value="all">{tr("Tutte le auto")}</option>
            {cars.map((car) => <option key={car.id} value={car.id}>{car.name}</option>)}
            <option value="__no_car">{tr("Senza auto")}</option>
          </select>

          <select className={uiSelectClassName} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="open">{tr("Solo aperte")}</option>
            <option value="all">{tr("Tutti gli stati")}</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
          </select>

          <select className={uiSelectClassName} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
            <option value="all">{tr("Tutte le aree")}</option>
            {Object.entries(AREA_LABELS).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
          </select>

          <select className={uiSelectClassName} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">{tr("Tutte le priorità")}</option>
            {Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
          </select>

          <select className={uiSelectClassName} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="all">{tr("Tutti")}</option>
            <option value="unassigned">{tr("Non assegnate")}</option>
            {members.map((member) => <option key={member.id} value={member.id}>{getMemberLabel(member)}</option>)}
          </select>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="race-card-grid px-5 py-4 text-sm text-[var(--text-secondary)]">{tr("Caricamento attività...")}</div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              title={tr("Nessuna attività trovata")}
              description="Crea un promemoria oppure modifica i filtri per visualizzare altre attività."
            />
          ) : viewMode === "compact" ? (
            <div className="space-y-6">
              {groupedTasks.map((group) => (
                <div key={group.key} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="racing-kicker text-[var(--brand-accent)]">{group.label}</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-3">
                    {group.rows.map((task) => (
                      <TaskRowCard
                        key={task.id}
                        task={task}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={openEditModal}
                        onComplete={(row) => quickUpdate(row, { status: row.status === "done" ? "todo" : "done" })}
                        onDelete={deleteTask}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={openEditModal}
                  onComplete={(row) => quickUpdate(row, { status: row.status === "done" ? "todo" : "done" })}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {modalOpen ? (
        <ModalShell
          title={editingTask ? "Modifica attività" : "Nuova attività"}
          subtitle="Collega il promemoria a un mezzo, componente, evento, articolo magazzino o pilota per ritrovarlo nel punto giusto della webapp."
          onClose={closeModal}
          maxWidth="max-w-5xl"
          footer={
            <>
              <Button variant="secondary" onClick={closeModal} disabled={saving}><LocalizedText text="Annulla" /></Button>
              <Button onClick={saveTask} disabled={saving || !form.title.trim()}>
                {saving ? tr("Salvataggio...") : editingTask ? tr("Salva modifiche") : tr("Crea attività")}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <UiField label="Titolo attività">
                <input
                  className={uiInputClassName}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={tr("Es. Ordinare pastiglie freno, controllare serraggio sospensioni...")}
                />
              </UiField>
            </div>

            <UiField label="Area">
              <select className={uiSelectClassName} value={form.area} onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value as TaskArea }))}>
                {Object.entries(AREA_LABELS).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
              </select>
            </UiField>

            <UiField label="Assegnata a">
              <select
                className={uiSelectClassName}
                value={form.assigned_to_team_user_id}
                onChange={(e) => setForm((prev) => ({ ...prev, assigned_to_team_user_id: e.target.value }))}
                disabled={!canAssign}
              >
                <option value="">{tr("Non assegnata")}</option>
                {members.map((member) => <option key={member.id} value={member.id}>{getMemberLabel(member)}</option>)}
              </select>
            </UiField>

            <UiField label="Stato">
              <select className={uiSelectClassName} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}>
                {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
              </select>
            </UiField>

            <UiField label="Priorità">
              <select className={uiSelectClassName} value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}>
                {Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
              </select>
            </UiField>

            <UiField label="Scadenza">
              <input
                className={uiInputClassName}
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              />
            </UiField>

            <UiField label="Auto collegata">
              <select
                className={uiSelectClassName}
                value={form.car_id}
                onChange={(e) => setForm((prev) => ({ ...prev, car_id: e.target.value, component_id: "" }))}
              >
                <option value="">{tr("Nessuna auto")}</option>
                {cars.map((car) => <option key={car.id} value={car.id}>{car.name}</option>)}
              </select>
            </UiField>

            <UiField label="Componente collegato">
              <select className={uiSelectClassName} value={form.component_id} onChange={(e) => setForm((prev) => ({ ...prev, component_id: e.target.value }))}>
                <option value="">{tr("Nessun componente")}</option>
                {filteredComponents.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.type || tr("Componente")} · {component.identifier || component.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </UiField>

            <UiField label="Evento collegato">
              <select className={uiSelectClassName} value={form.event_id} onChange={(e) => setForm((prev) => ({ ...prev, event_id: e.target.value }))}>
                <option value="">{tr("Nessun evento")}</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name} · {formatDate(event.date)}</option>)}
              </select>
            </UiField>

            <UiField label="Articolo magazzino">
              <select className={uiSelectClassName} value={form.inventory_item_id} onChange={(e) => setForm((prev) => ({ ...prev, inventory_item_id: e.target.value }))}>
                <option value="">{tr("Nessun articolo")}</option>
                {inventory.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </UiField>

            <UiField label="Pilota collegato">
              <select className={uiSelectClassName} value={form.driver_id} onChange={(e) => setForm((prev) => ({ ...prev, driver_id: e.target.value }))}>
                <option value="">{tr("Nessun pilota")}</option>
                {drivers.map((driver) => <option key={driver.id} value={driver.id}>{getDriverLabel(driver)}</option>)}
              </select>
            </UiField>

            <div className="md:col-span-2">
              <UiField label="Descrizione / note operative">
                <textarea
                  className={uiTextareaClassName}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={tr("Dettagli, ricambi da ordinare, controlli da fare, note per il responsabile...")}
                />
              </UiField>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function QuickStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "green" | "yellow" | "red" | "blue" }) {
  const { t } = useLanguage();
  const toneClass = {
    green: "text-emerald-300",
    yellow: "text-amber-300",
    red: "text-red-300",
    blue: "text-blue-300",
  }[tone];

  return (
    <div className="race-mini-panel p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
        {icon}
        {t(`ui.${label}`, label)}
      </div>
      <div className={`technical-number mt-3 text-3xl font-black leading-none ${toneClass}`}>{value}</div>
    </div>
  );
}

function TaskRowCard({
  task,
  canEdit,
  canDelete,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: TaskRow;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (task: TaskRow) => void;
  onComplete: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="data-row flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={AREA_LABELS[task.area]} tone="blue" />
          <StatusBadge label={PRIORITY_LABELS[task.priority]} tone={getPriorityTone(task.priority)} />
          <StatusBadge label={STATUS_LABELS[task.status]} tone={getStatusTone(task.status)} />
        </div>
        <div className="mt-3 text-lg font-black text-[var(--text-primary)]">{task.title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{taskLinkSummary(task)}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[var(--text-muted)]">
          <span>{t("ui.Assegnata", "Assegnata")}: {t(`ui.${getMemberLabel(task.assigned_to)}`, getMemberLabel(task.assigned_to))}</span>
          <span>{t("ui.Scadenza", "Scadenza")}: {formatDate(task.due_date)}</span>
        </div>
      </div>

      <TaskActions task={task} canEdit={canEdit} canDelete={canDelete} onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />
    </div>
  );
}

function TaskCard({
  task,
  canEdit,
  canDelete,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: TaskRow;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (task: TaskRow) => void;
  onComplete: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
}) {
  return (
    <div className="race-card-grid p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={AREA_LABELS[task.area]} tone="blue" />
        <StatusBadge label={PRIORITY_LABELS[task.priority]} tone={getPriorityTone(task.priority)} />
        <StatusBadge label={STATUS_LABELS[task.status]} tone={getStatusTone(task.status)} />
      </div>

      <h3 className="mt-4 text-xl font-black text-[var(--text-primary)]">{task.title}</h3>
      {task.description ? <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{task.description}</p> : null}

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <MiniInfo icon={<CarFront size={15} />} label="Collegamento" value={taskLinkSummary(task)} />
        <MiniInfo icon={<UserRound size={15} />} label="Assegnata" value={getMemberLabel(task.assigned_to)} />
        <MiniInfo icon={<CalendarDays size={15} />} label="Scadenza" value={formatDate(task.due_date)} />
        <MiniInfo icon={<Clock3 size={15} />} label="Aggiornata" value={formatDate(task.updated_at)} />
      </div>

      <div className="mt-5 flex justify-end">
        <TaskActions task={task} canEdit={canEdit} canDelete={canDelete} onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />
      </div>
    </div>
  );
}

function TaskActions({
  task,
  canEdit,
  canDelete,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: TaskRow;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (task: TaskRow) => void;
  onComplete: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {canEdit ? (
        <button type="button" className="race-action-secondary px-3 py-2 text-xs" onClick={() => onComplete(task)}>
          <CheckCircle2 size={15} className="mr-1 inline" />
          {task.status === "done" ? t("ui.Riapri", "Riapri") : t("ui.Completa", "Completa")}
        </button>
      ) : null}
      {canEdit ? (
        <button type="button" className="race-action-secondary px-3 py-2 text-xs" onClick={() => onEdit(task)}>
          <Pencil size={15} className="mr-1 inline" />
          {t("ui.Modifica", "Modifica")}
        </button>
      ) : null}
      {canDelete ? (
        <button type="button" className="race-action-danger px-3 py-2 text-xs" onClick={() => onDelete(task)}>
          <Trash2 size={15} className="mr-1 inline" />
          {t("ui.Elimina", "Elimina")}
        </button>
      ) : null}
    </div>
  );
}

function MiniInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { t } = useLanguage();
  return (
    <div className="race-mini-panel p-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {icon}
        {t(`ui.${label}`, label)}
      </div>
      <div className="mt-2 text-sm font-bold leading-5 text-[var(--text-primary)]">{t(`ui.${value}`, value)}</div>
    </div>
  );
}
