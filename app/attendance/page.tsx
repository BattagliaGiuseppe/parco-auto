"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  TimerReset,
  UserRound,
  UsersRound,
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

type LocationLabel = "sede" | "pista" | "altro";
type AttendanceSource = "self" | "admin" | "kiosk" | "qr_event";
type AdminClockMode = "in" | "out";

type StaffMember = {
  id: string;
  team_id: string;
  team_user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EventOption = {
  id: string;
  name: string;
  date: string | null;
};

type AttendanceRecord = {
  id: string;
  team_id: string;
  staff_member_id: string;
  event_id: string | null;
  check_in_at: string;
  check_out_at: string | null;
  check_in_source: AttendanceSource | string | null;
  check_out_source: AttendanceSource | string | null;
  check_in_location_label: LocationLabel | string | null;
  check_out_location_label: LocationLabel | string | null;
  check_in_note: string | null;
  check_out_note: string | null;
  created_at: string;
  updated_at: string;
  staff_member?: StaffMember | null;
  event?: EventOption | null;
};

type AttendanceSummary = {
  staff_member_id: string;
  minutes_all_time: number;
  minutes_since_reset: number;
  records_count: number;
  days_worked: number;
  last_reset_at: string | null;
  last_check_in_at: string | null;
  latest_record_id: string | null;
  open_record_id: string | null;
};

type StaffFormState = {
  full_name: string;
  email: string;
  phone: string;
  role_label: string;
  is_active: boolean;
};

type AdminClockFormState = {
  mode: AdminClockMode;
  staff_member_id: string;
  at: string;
  location_label: LocationLabel;
  event_id: string;
  note: string;
};

type EditRecordFormState = {
  record_id: string;
  staff_member_id: string;
  check_in_at: string;
  check_out_at: string;
  check_in_location_label: LocationLabel;
  check_out_location_label: LocationLabel;
  event_id: string;
  check_in_note: string;
  check_out_note: string;
};

type ResetFormState = {
  staff_member_id: string;
  reset_at: string;
  notify_user: boolean;
  note: string;
};

const LOCATION_LABELS: Record<LocationLabel, string> = {
  sede: "Sede / officina",
  pista: "Pista / evento",
  altro: "Altro luogo",
};

const EMPTY_STAFF_FORM: StaffFormState = {
  full_name: "",
  email: "",
  phone: "",
  role_label: "",
  is_active: true,
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h}h ${m}m`;
}

function minutesBetween(start: string, end?: string | null) {
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, (to - from) / 60000);
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toDatetimeLocal(value?: string | null) {
  const d = value ? new Date(value) : new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function datetimeLocalToIso(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function getStaffLabel(staff: StaffMember | null | undefined) {
  if (!staff) return "Membro team";
  return staff.full_name || staff.email || "Membro team";
}

function getLocationLabel(value: string | null | undefined) {
  if (!value) return "—";
  return LOCATION_LABELS[value as LocationLabel] || value;
}

function getNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AttendancePage() {
  const access = usePermissionAccess();
  const [viewMode, setViewMode] = usePersistedViewMode("parcoauto.attendance.viewMode", "compact");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const [clockLocation, setClockLocation] = useState<LocationLabel>("sede");
  const [clockEventId, setClockEventId] = useState("");
  const [clockNote, setClockNote] = useState("");
  const [clockSaving, setClockSaving] = useState(false);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState<StaffFormState>(EMPTY_STAFF_FORM);
  const [savingStaff, setSavingStaff] = useState(false);

  const [adminClockModalOpen, setAdminClockModalOpen] = useState(false);
  const [adminClockForm, setAdminClockForm] = useState<AdminClockFormState>({
    mode: "in",
    staff_member_id: "",
    at: toDatetimeLocal(),
    location_label: "sede",
    event_id: "",
    note: "",
  });
  const [savingAdminClock, setSavingAdminClock] = useState(false);

  const [editRecordModalOpen, setEditRecordModalOpen] = useState(false);
  const [editRecordForm, setEditRecordForm] = useState<EditRecordFormState | null>(null);
  const [savingRecordEdit, setSavingRecordEdit] = useState(false);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetForm, setResetForm] = useState<ResetFormState>({
    staff_member_id: "",
    reset_at: toDatetimeLocal(),
    notify_user: true,
    note: "",
  });
  const [savingReset, setSavingReset] = useState(false);

  const canView = access.hasPermission("attendance.view", ["owner", "admin", "engineer", "mechanic", "viewer"]);
  const canClockSelf = access.hasPermission("attendance.clock_self", ["owner", "admin", "engineer", "mechanic", "viewer"]);
  const canManage = access.hasPermission("attendance.manage", ["owner", "admin"]);
  const canExport = access.hasPermission("attendance.export", ["owner", "admin"]);

  const activeRecords = useMemo(() => records.filter((row) => !row.check_out_at), [records]);
  const activeStaffIds = useMemo(() => new Set(activeRecords.map((row) => row.staff_member_id)), [activeRecords]);
  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);
  const summaryByStaffId = useMemo(() => new Map(summaries.map((summary) => [summary.staff_member_id, summary])), [summaries]);
  const currentOpenRecord = useMemo(
    () => activeRecords.find((row) => row.staff_member_id === currentStaff?.id) || null,
    [activeRecords, currentStaff?.id]
  );
  const latestRecordByStaffId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const record of records) {
      const current = map.get(record.staff_member_id);
      if (!current || new Date(record.check_in_at).getTime() > new Date(current.check_in_at).getTime()) {
        map.set(record.staff_member_id, record);
      }
    }
    return map;
  }, [records]);

  const todayRecords = useMemo(() => records.filter((row) => new Date(row.check_in_at) >= new Date(startOfTodayIso())), [records]);
  const todayMinutes = useMemo(
    () => todayRecords.reduce((sum, row) => sum + minutesBetween(row.check_in_at, row.check_out_at), 0),
    [todayRecords]
  );
  const trackPresence = useMemo(
    () => activeRecords.filter((row) => row.check_in_location_label === "pista").length,
    [activeRecords]
  );
  const periodMinutes = useMemo(
    () => summaries.reduce((sum, summary) => sum + getNumber(summary.minutes_since_reset), 0),
    [summaries]
  );

  async function loadData() {
    if (!access.ctx || !canView) return;
    setLoading(true);
    setError("");

    try {
      const ctx = access.ctx;
      const since = new Date();
      since.setDate(since.getDate() - 180);
      since.setHours(0, 0, 0, 0);

      const ensureRes = canClockSelf
        ? await supabase.rpc("attendance_ensure_staff_member", { p_team_id: ctx.teamId })
        : ({ data: null, error: null } as any);

      if (ensureRes.error) throw ensureRes.error;

      const [staffRes, recordsRes, eventsRes, summaryRes] = await Promise.all([
        supabase
          .from("team_staff_members")
          .select("*")
          .eq("team_id", ctx.teamId)
          .order("full_name", { ascending: true }),
        supabase
          .from("attendance_records")
          .select(`
            *,
            staff_member:staff_member_id(*),
            event:event_id(id,name,date)
          `)
          .eq("team_id", ctx.teamId)
          .gte("check_in_at", since.toISOString())
          .order("check_in_at", { ascending: false })
          .limit(1000),
        supabase
          .from("events")
          .select("id,name,date")
          .eq("team_id", ctx.teamId)
          .order("date", { ascending: false })
          .limit(80),
        supabase.rpc("attendance_staff_summary", { p_team_id: ctx.teamId }),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (recordsRes.error) throw recordsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (summaryRes.error) throw summaryRes.error;

      const normalizedRecords: AttendanceRecord[] = ((recordsRes.data || []) as any[]).map((row) => ({
        ...row,
        staff_member: normalizeRelation<StaffMember>(row.staff_member),
        event: normalizeRelation<EventOption>(row.event),
      }));

      const normalizedSummaries: AttendanceSummary[] = ((summaryRes.data || []) as any[]).map((row) => ({
        staff_member_id: row.staff_member_id,
        minutes_all_time: getNumber(row.minutes_all_time),
        minutes_since_reset: getNumber(row.minutes_since_reset),
        records_count: getNumber(row.records_count),
        days_worked: getNumber(row.days_worked),
        last_reset_at: row.last_reset_at ?? null,
        last_check_in_at: row.last_check_in_at ?? null,
        latest_record_id: row.latest_record_id ?? null,
        open_record_id: row.open_record_id ?? null,
      }));

      setStaff((staffRes.data || []) as StaffMember[]);
      setRecords(normalizedRecords);
      setEvents((eventsRes.data || []) as EventOption[]);
      setSummaries(normalizedSummaries);
      setCurrentStaff(normalizeRelation<StaffMember>(ensureRes.data));
    } catch (err: any) {
      setError(err.message || "Errore durante il caricamento presenze.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && access.ctx && canView) {
      void loadData();
    }
  }, [access.loading, access.ctx?.teamId, canView]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((member) => {
      const active = activeStaffIds.has(member.id);
      if (statusFilter === "present" && !active) return false;
      if (statusFilter === "absent" && active) return false;
      if (!q) return true;
      return [member.full_name, member.email, member.phone, member.role_label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [activeStaffIds, search, staff, statusFilter]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((row) => {
      if (locationFilter !== "all" && row.check_in_location_label !== locationFilter) return false;
      if (statusFilter === "present" && row.check_out_at) return false;
      if (statusFilter === "absent") return false;
      if (!q) return true;
      return [row.staff_member?.full_name, row.staff_member?.email, row.event?.name, row.check_in_note, row.check_out_note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [locationFilter, records, search, statusFilter]);

  const filteredSummaryRows = useMemo(
    () => filteredStaff.map((member) => ({ member, summary: summaryByStaffId.get(member.id) || null })),
    [filteredStaff, summaryByStaffId]
  );

  async function clockIn() {
    if (!access.ctx || !canClockSelf) return;
    setClockSaving(true);
    setError("");

    try {
      const { error: clockError } = await supabase.rpc("attendance_clock_in", {
        p_team_id: access.ctx.teamId,
        p_location_label: clockLocation,
        p_event_id: clockEventId || null,
        p_note: clockNote.trim() || null,
      });
      if (clockError) throw clockError;
      setClockNote("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Errore durante la timbratura di entrata.");
    } finally {
      setClockSaving(false);
    }
  }

  async function clockOut() {
    if (!access.ctx || !canClockSelf) return;
    setClockSaving(true);
    setError("");

    try {
      const { error: clockError } = await supabase.rpc("attendance_clock_out", {
        p_team_id: access.ctx.teamId,
        p_location_label: clockLocation,
        p_note: clockNote.trim() || null,
      });
      if (clockError) throw clockError;
      setClockNote("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Errore durante la timbratura di uscita.");
    } finally {
      setClockSaving(false);
    }
  }

  function openStaffModal() {
    setStaffForm(EMPTY_STAFF_FORM);
    setStaffModalOpen(true);
  }

  async function saveStaffMember() {
    if (!access.ctx || !canManage) return;
    if (!staffForm.full_name.trim()) {
      setError("Inserisci il nome del dipendente/collaboratore.");
      return;
    }

    setSavingStaff(true);
    setError("");

    try {
      const { error: insertError } = await supabase.from("team_staff_members").insert({
        team_id: access.ctx.teamId,
        full_name: staffForm.full_name.trim(),
        email: staffForm.email.trim() || null,
        phone: staffForm.phone.trim() || null,
        role_label: staffForm.role_label.trim() || null,
        is_active: staffForm.is_active,
        created_by_team_user_id: access.ctx.teamUserId,
      });
      if (insertError) throw insertError;
      setStaffModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Errore durante il salvataggio del membro staff.");
    } finally {
      setSavingStaff(false);
    }
  }

  function openAdminClockModal(member?: StaffMember, mode: AdminClockMode = "in") {
    setAdminClockForm({
      mode,
      staff_member_id: member?.id || "",
      at: toDatetimeLocal(),
      location_label: mode === "out" ? "sede" : clockLocation,
      event_id: mode === "in" ? clockEventId : "",
      note: "",
    });
    setAdminClockModalOpen(true);
  }

  async function saveAdminClock() {
    if (!access.ctx || !canManage || !adminClockForm.staff_member_id) return;
    const atIso = datetimeLocalToIso(adminClockForm.at);
    if (!atIso) {
      setError("Inserisci data e ora valide.");
      return;
    }

    setSavingAdminClock(true);
    setError("");

    try {
      const rpcName = adminClockForm.mode === "in" ? "attendance_admin_clock_in" : "attendance_admin_clock_out";
      const params = adminClockForm.mode === "in"
        ? {
            p_team_id: access.ctx.teamId,
            p_staff_member_id: adminClockForm.staff_member_id,
            p_location_label: adminClockForm.location_label,
            p_event_id: adminClockForm.event_id || null,
            p_note: adminClockForm.note.trim() || null,
            p_check_in_at: atIso,
          }
        : {
            p_team_id: access.ctx.teamId,
            p_staff_member_id: adminClockForm.staff_member_id,
            p_location_label: adminClockForm.location_label,
            p_note: adminClockForm.note.trim() || null,
            p_check_out_at: atIso,
          };

      const { error: rpcError } = await supabase.rpc(rpcName, params as any);
      if (rpcError) throw rpcError;
      setAdminClockModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Errore durante la timbratura amministrativa.");
    } finally {
      setSavingAdminClock(false);
    }
  }

  function openEditRecordModal(record: AttendanceRecord) {
    setEditRecordForm({
      record_id: record.id,
      staff_member_id: record.staff_member_id,
      check_in_at: toDatetimeLocal(record.check_in_at),
      check_out_at: record.check_out_at ? toDatetimeLocal(record.check_out_at) : "",
      check_in_location_label: (record.check_in_location_label as LocationLabel) || "sede",
      check_out_location_label: (record.check_out_location_label as LocationLabel) || ((record.check_in_location_label as LocationLabel) || "sede"),
      event_id: record.event_id || "",
      check_in_note: record.check_in_note || "",
      check_out_note: record.check_out_note || "",
    });
    setEditRecordModalOpen(true);
  }

  async function saveRecordEdit() {
    if (!access.ctx || !canManage || !editRecordForm) return;
    const checkInIso = datetimeLocalToIso(editRecordForm.check_in_at);
    const checkOutIso = editRecordForm.check_out_at ? datetimeLocalToIso(editRecordForm.check_out_at) : null;
    if (!checkInIso) {
      setError("Inserisci una data di entrata valida.");
      return;
    }

    setSavingRecordEdit(true);
    setError("");

    try {
      const { error: rpcError } = await supabase.rpc("attendance_admin_update_record", {
        p_team_id: access.ctx.teamId,
        p_record_id: editRecordForm.record_id,
        p_staff_member_id: editRecordForm.staff_member_id,
        p_event_id: editRecordForm.event_id || null,
        p_check_in_at: checkInIso,
        p_check_out_at: checkOutIso,
        p_check_in_location_label: editRecordForm.check_in_location_label,
        p_check_out_location_label: checkOutIso ? editRecordForm.check_out_location_label : null,
        p_check_in_note: editRecordForm.check_in_note.trim() || null,
        p_check_out_note: editRecordForm.check_out_note.trim() || null,
      });
      if (rpcError) throw rpcError;
      setEditRecordModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Errore durante la modifica della timbratura.");
    } finally {
      setSavingRecordEdit(false);
    }
  }

  function openResetModal(member: StaffMember) {
    setResetForm({
      staff_member_id: member.id,
      reset_at: toDatetimeLocal(),
      notify_user: true,
      note: "",
    });
    setResetModalOpen(true);
  }

  async function saveResetCounter() {
    if (!access.ctx || !canManage || !resetForm.staff_member_id) return;
    const resetIso = datetimeLocalToIso(resetForm.reset_at);
    if (!resetIso) {
      setError("Inserisci data e ora valide per l'azzeramento.");
      return;
    }

    setSavingReset(true);
    setError("");

    try {
      const { error: rpcError } = await supabase.rpc("attendance_reset_counter", {
        p_team_id: access.ctx.teamId,
        p_staff_member_id: resetForm.staff_member_id,
        p_reset_at: resetIso,
        p_note: resetForm.note.trim() || null,
        p_notify_user: resetForm.notify_user,
      });
      if (rpcError) throw rpcError;
      setResetModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Errore durante l'azzeramento del contatore.");
    } finally {
      setSavingReset(false);
    }
  }

  if (access.loading) {
    return <PagePermissionState title="Presenze" subtitle="Timbrature e presenza giornaliera del team" icon={<UsersRound size={22} />} state="loading" />;
  }

  if (access.error) {
    return <PagePermissionState title="Presenze" subtitle="Timbrature e presenza giornaliera del team" icon={<UsersRound size={22} />} state="error" message={access.error} />;
  }

  if (!canView) {
    return (
      <PagePermissionState
        title="Presenze"
        subtitle="Timbrature e presenza giornaliera del team"
        icon={<UsersRound size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo presenze."
      />
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Presenze"
        subtitle="Controllo presenze del team, timbrature in sede o in pista, riepiloghi per utente e contatori periodo azzerabili."
        icon={<UsersRound size={22} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <>
                <Button variant="secondary" onClick={() => openAdminClockModal(undefined, "in")}>Timbratura staff</Button>
                <Button onClick={openStaffModal}>
                  <Plus size={16} className="mr-2" />
                  Nuovo staff
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <QuickStat icon={<CheckCircle2 size={18} />} label="Presenti ora" value={String(activeRecords.length)} tone="green" />
        <QuickStat icon={<MapPin size={18} />} label="In pista" value={String(trackPresence)} tone={trackPresence ? "yellow" : "blue"} />
        <QuickStat icon={<TimerReset size={18} />} label="Ore oggi" value={formatDuration(todayMinutes)} tone="blue" />
        <QuickStat icon={<BarChart3 size={18} />} label="Ore periodo" value={formatDuration(periodMinutes)} tone="yellow" />
        <QuickStat icon={<UsersRound size={18} />} label="Staff attivo" value={String(staff.filter((member) => member.is_active).length)} tone="yellow" />
      </div>

      <SectionCard title="Timbratura rapida" subtitle="Usa questa area dal tuo accesso personale. Owner e admin possono usare anche la timbratura staff." actions={<StatusBadge label={currentOpenRecord ? "Presente" : "Non presente"} tone={currentOpenRecord ? "green" : "neutral"} />}>
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1.5fr_auto]">
          <UiField label="Luogo">
            <select className={uiSelectClassName} value={clockLocation} onChange={(event) => setClockLocation(event.target.value as LocationLabel)} disabled={!!currentOpenRecord}>
              {Object.entries(LOCATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </UiField>

          <UiField label="Evento / pista">
            <select className={uiSelectClassName} value={clockEventId} onChange={(event) => setClockEventId(event.target.value)} disabled={!!currentOpenRecord}>
              <option value="">Nessun evento</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name} · {formatDate(event.date)}</option>)}
            </select>
          </UiField>

          <UiField label="Nota rapida">
            <input className={uiInputClassName} value={clockNote} onChange={(event) => setClockNote(event.target.value)} placeholder={currentOpenRecord ? "Nota uscita..." : "Es. arrivo in circuito, trasferta, officina..."} />
          </UiField>

          <div className="flex items-end">
            {currentOpenRecord ? (
              <Button variant="danger" onClick={clockOut} disabled={clockSaving || !canClockSelf} className="w-full">
                <LogOut size={16} className="mr-2" />
                Uscita
              </Button>
            ) : (
              <Button onClick={clockIn} disabled={clockSaving || !canClockSelf} className="w-full">
                <LogIn size={16} className="mr-2" />
                Entrata
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <MiniInfo icon={<UserRound size={15} />} label="Profilo" value={currentStaff ? getStaffLabel(currentStaff) : "Profilo non collegato"} />
          <MiniInfo icon={<Clock3 size={15} />} label="Ultima entrata" value={currentOpenRecord ? formatDateTime(currentOpenRecord.check_in_at) : "—"} />
          <MiniInfo icon={<CalendarDays size={15} />} label="Evento" value={currentOpenRecord?.event?.name || "—"} />
        </div>
      </SectionCard>

      <SectionCard title="Riepilogo ore per utente" subtitle="Contatore periodo azzerabile senza cancellare lo storico: le ore totali restano sempre tracciate." actions={canExport ? <StatusBadge label="Storico conservato" tone="blue" /> : null}>
        {loading ? (
          <div className="race-card-grid px-5 py-4 text-sm text-[var(--text-secondary)]">Caricamento statistiche...</div>
        ) : filteredSummaryRows.length === 0 ? (
          <EmptyState title="Nessun riepilogo disponibile" description="Aggiungi lo staff o modifica i filtri." />
        ) : (
          <div className="space-y-3">
            {filteredSummaryRows.map(({ member, summary }) => {
              const activeRecord = activeRecords.find((row) => row.staff_member_id === member.id) || null;
              const latestRecord = latestRecordByStaffId.get(member.id) || null;
              return (
                <StaffStatsRow
                  key={member.id}
                  member={member}
                  summary={summary}
                  activeRecord={activeRecord}
                  latestRecord={latestRecord}
                  canManage={canManage}
                  onAdminClock={(mode) => openAdminClockModal(member, mode)}
                  onEditRecord={latestRecord ? () => openEditRecordModal(latestRecord) : undefined}
                  onReset={() => openResetModal(member)}
                />
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Console presenze"
        subtitle="Vista sintetica con stato attuale dello staff e vista schede con storico timbrature modificabile dagli admin."
        actions={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_0.8fr_0.8fr]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input className={`${uiInputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca staff, evento, nota..." />
          </label>

          <select className={uiSelectClassName} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tutti gli stati</option>
            <option value="present">Solo presenti</option>
            <option value="absent">Solo assenti</option>
          </select>

          <select className={uiSelectClassName} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
            <option value="all">Tutti i luoghi</option>
            {Object.entries(LOCATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="race-card-grid px-5 py-4 text-sm text-[var(--text-secondary)]">Caricamento presenze...</div>
          ) : viewMode === "compact" ? (
            <div className="space-y-3">
              {filteredStaff.length === 0 ? (
                <EmptyState title="Nessun membro staff trovato" description="Aggiungi lo staff oppure modifica i filtri." />
              ) : (
                filteredStaff.map((member) => {
                  const activeRecord = activeRecords.find((row) => row.staff_member_id === member.id) || null;
                  const latestRecord = latestRecordByStaffId.get(member.id) || null;
                  return (
                    <StaffRow
                      key={member.id}
                      staff={member}
                      activeRecord={activeRecord}
                      canManage={canManage}
                      onAdminClock={(mode) => openAdminClockModal(member, mode)}
                      onEditRecord={latestRecord ? () => openEditRecordModal(latestRecord) : undefined}
                    />
                  );
                })
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredRecords.length === 0 ? (
                <div className="xl:col-span-2"><EmptyState title="Nessuna timbratura trovata" /></div>
              ) : (
                filteredRecords.map((record) => <AttendanceRecordCard key={record.id} record={record} canManage={canManage} onEdit={() => openEditRecordModal(record)} />)
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {staffModalOpen ? (
        <ModalShell
          title="Nuovo membro staff"
          subtitle="Aggiungi dipendenti o collaboratori che devono comparire nel registro presenze. Gli utenti già invitati alla webapp vengono creati automaticamente."
          onClose={() => setStaffModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setStaffModalOpen(false)} disabled={savingStaff}>Annulla</Button>
              <Button onClick={saveStaffMember} disabled={savingStaff || !staffForm.full_name.trim()}>{savingStaff ? "Salvataggio..." : "Aggiungi staff"}</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UiField label="Nome e cognome">
              <input className={uiInputClassName} value={staffForm.full_name} onChange={(event) => setStaffForm((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Es. Mario Rossi" />
            </UiField>
            <UiField label="Ruolo / mansione">
              <input className={uiInputClassName} value={staffForm.role_label} onChange={(event) => setStaffForm((prev) => ({ ...prev, role_label: event.target.value }))} placeholder="Es. Meccanico, tecnico, logistica..." />
            </UiField>
            <UiField label="Email">
              <input className={uiInputClassName} type="email" value={staffForm.email} onChange={(event) => setStaffForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="nome@email.it" />
            </UiField>
            <UiField label="Telefono">
              <input className={uiInputClassName} value={staffForm.phone} onChange={(event) => setStaffForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="+39..." />
            </UiField>
            <label className="md:col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
              <span className="font-semibold text-[var(--text-primary)]">Staff attivo</span>
              <input type="checkbox" checked={staffForm.is_active} onChange={(event) => setStaffForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
            </label>
          </div>
        </ModalShell>
      ) : null}

      {adminClockModalOpen ? (
        <ModalShell
          title={adminClockForm.mode === "in" ? "Entrata staff" : "Uscita staff"}
          subtitle="Owner e admin possono registrare o correggere rapidamente la timbratura di qualsiasi membro del team."
          onClose={() => setAdminClockModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAdminClockModalOpen(false)} disabled={savingAdminClock}>Annulla</Button>
              <Button onClick={saveAdminClock} disabled={savingAdminClock || !adminClockForm.staff_member_id}>{savingAdminClock ? "Salvataggio..." : "Registra timbratura"}</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UiField label="Tipo timbratura">
              <select className={uiSelectClassName} value={adminClockForm.mode} onChange={(event) => setAdminClockForm((prev) => ({ ...prev, mode: event.target.value as AdminClockMode }))}>
                <option value="in">Entrata</option>
                <option value="out">Uscita</option>
              </select>
            </UiField>
            <UiField label="Membro staff">
              <select className={uiSelectClassName} value={adminClockForm.staff_member_id} onChange={(event) => setAdminClockForm((prev) => ({ ...prev, staff_member_id: event.target.value }))}>
                <option value="">Seleziona membro</option>
                {staff.map((member) => <option key={member.id} value={member.id}>{getStaffLabel(member)}</option>)}
              </select>
            </UiField>
            <UiField label="Data e ora">
              <input className={uiInputClassName} type="datetime-local" value={adminClockForm.at} onChange={(event) => setAdminClockForm((prev) => ({ ...prev, at: event.target.value }))} />
            </UiField>
            <UiField label="Luogo">
              <select className={uiSelectClassName} value={adminClockForm.location_label} onChange={(event) => setAdminClockForm((prev) => ({ ...prev, location_label: event.target.value as LocationLabel }))}>
                {Object.entries(LOCATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </UiField>
            {adminClockForm.mode === "in" ? (
              <UiField label="Evento / pista">
                <select className={uiSelectClassName} value={adminClockForm.event_id} onChange={(event) => setAdminClockForm((prev) => ({ ...prev, event_id: event.target.value }))}>
                  <option value="">Nessun evento</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.name} · {formatDate(event.date)}</option>)}
                </select>
              </UiField>
            ) : null}
            <div className={adminClockForm.mode === "in" ? "" : "md:col-span-2"}>
              <UiField label="Nota">
                <textarea className={uiTextareaClassName} value={adminClockForm.note} onChange={(event) => setAdminClockForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Motivo o dettaglio della timbratura manuale..." />
              </UiField>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {editRecordModalOpen && editRecordForm ? (
        <ModalShell
          title="Modifica timbratura"
          subtitle="Correzione amministrativa: lo storico resta tracciato con data aggiornamento e utente che effettua la modifica."
          onClose={() => setEditRecordModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditRecordModalOpen(false)} disabled={savingRecordEdit}>Annulla</Button>
              <Button onClick={saveRecordEdit} disabled={savingRecordEdit}>{savingRecordEdit ? "Salvataggio..." : "Salva modifiche"}</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UiField label="Membro staff">
              <select className={uiSelectClassName} value={editRecordForm.staff_member_id} onChange={(event) => setEditRecordForm((prev) => prev ? ({ ...prev, staff_member_id: event.target.value }) : prev)}>
                {staff.map((member) => <option key={member.id} value={member.id}>{getStaffLabel(member)}</option>)}
              </select>
            </UiField>
            <UiField label="Evento / pista">
              <select className={uiSelectClassName} value={editRecordForm.event_id} onChange={(event) => setEditRecordForm((prev) => prev ? ({ ...prev, event_id: event.target.value }) : prev)}>
                <option value="">Nessun evento</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name} · {formatDate(event.date)}</option>)}
              </select>
            </UiField>
            <UiField label="Entrata">
              <input className={uiInputClassName} type="datetime-local" value={editRecordForm.check_in_at} onChange={(event) => setEditRecordForm((prev) => prev ? ({ ...prev, check_in_at: event.target.value }) : prev)} />
            </UiField>
            <UiField label="Uscita">
              <input className={uiInputClassName} type="datetime-local" value={editRecordForm.check_out_at} onChange={(event) => setEditRecordForm((prev) => prev ? ({ ...prev, check_out_at: event.target.value }) : prev)} />
            </UiField>
            <UiField label="Luogo entrata">
              <select className={uiSelectClassName} value={editRecordForm.check_in_location_label} onChange={(event) => setEditRecordForm((prev) => prev ? ({ ...prev, check_in_location_label: event.target.value as LocationLabel }) : prev)}>
                {Object.entries(LOCATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </UiField>
            <UiField label="Luogo uscita">
              <select className={uiSelectClassName} value={editRecordForm.check_out_location_label} onChange={(event) => setEditRecordForm((prev) => prev ? ({ ...prev, check_out_location_label: event.target.value as LocationLabel }) : prev)}>
                {Object.entries(LOCATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </UiField>
            <UiField label="Nota entrata">
              <textarea className={uiTextareaClassName} value={editRecordForm.check_in_note} onChange={(event) => setEditRecordForm((prev) => prev ? ({ ...prev, check_in_note: event.target.value }) : prev)} />
            </UiField>
            <UiField label="Nota uscita">
              <textarea className={uiTextareaClassName} value={editRecordForm.check_out_note} onChange={(event) => setEditRecordForm((prev) => prev ? ({ ...prev, check_out_note: event.target.value }) : prev)} />
            </UiField>
          </div>
        </ModalShell>
      ) : null}

      {resetModalOpen ? (
        <ModalShell
          title="Azzera contatore periodo"
          subtitle="L'azzeramento non cancella lo storico: crea solo un nuovo punto di partenza per il contatore ore del membro selezionato."
          onClose={() => setResetModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setResetModalOpen(false)} disabled={savingReset}>Annulla</Button>
              <Button variant="danger" onClick={saveResetCounter} disabled={savingReset || !resetForm.staff_member_id}>{savingReset ? "Salvataggio..." : "Azzera contatore"}</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UiField label="Membro staff">
              <select className={uiSelectClassName} value={resetForm.staff_member_id} onChange={(event) => setResetForm((prev) => ({ ...prev, staff_member_id: event.target.value }))}>
                <option value="">Seleziona membro</option>
                {staff.map((member) => <option key={member.id} value={member.id}>{getStaffLabel(member)}</option>)}
              </select>
            </UiField>
            <UiField label="Data nuovo conteggio">
              <input className={uiInputClassName} type="datetime-local" value={resetForm.reset_at} onChange={(event) => setResetForm((prev) => ({ ...prev, reset_at: event.target.value }))} />
            </UiField>
            <label className="md:col-span-2 flex items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              <span className="flex items-center gap-2 font-semibold">
                <Bell size={16} />
                Registra richiesta notifica all'utente
              </span>
              <input type="checkbox" checked={resetForm.notify_user} onChange={(event) => setResetForm((prev) => ({ ...prev, notify_user: event.target.checked }))} />
            </label>
            <div className="md:col-span-2">
              <UiField label="Nota azzeramento">
                <textarea className={uiTextareaClassName} value={resetForm.note} onChange={(event) => setResetForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Es. chiusura periodo, pagamento ore, consuntivo evento..." />
              </UiField>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function QuickStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "green" | "yellow" | "red" | "blue" }) {
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
        {label}
      </div>
      <div className={`technical-number mt-3 text-3xl font-black leading-none ${toneClass}`}>{value}</div>
    </div>
  );
}

function MiniInfo({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="race-mini-panel p-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-bold leading-5 text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function StaffStatsRow({
  member,
  summary,
  activeRecord,
  latestRecord,
  canManage,
  onAdminClock,
  onEditRecord,
  onReset,
}: {
  member: StaffMember;
  summary: AttendanceSummary | null;
  activeRecord: AttendanceRecord | null;
  latestRecord: AttendanceRecord | null;
  canManage: boolean;
  onAdminClock: (mode: AdminClockMode) => void;
  onEditRecord?: () => void;
  onReset: () => void;
}) {
  return (
    <div className="data-row grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.85fr_0.85fr_0.75fr_1.25fr] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={activeRecord ? "Presente" : "Assente"} tone={activeRecord ? "green" : "neutral"} />
          {activeRecord ? <StatusBadge label={getLocationLabel(activeRecord.check_in_location_label)} tone={activeRecord.check_in_location_label === "pista" ? "yellow" : "blue"} /> : null}
        </div>
        <div className="mt-3 text-base font-black text-[var(--text-primary)]">{getStaffLabel(member)}</div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">{[member.role_label, member.email].filter(Boolean).join(" · ") || "Nessun dettaglio"}</div>
      </div>

      <MetricBlock label="Ore periodo" value={formatDuration(getNumber(summary?.minutes_since_reset))} tone="yellow" />
      <MetricBlock label="Ore totali" value={formatDuration(getNumber(summary?.minutes_all_time))} tone="blue" />
      <MetricBlock label="Timbrature" value={String(summary?.records_count || 0)} tone="green" />

      <div className="flex flex-col gap-2 xl:items-end">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Ultimo reset: <span className="text-[var(--text-secondary)]">{formatDateTime(summary?.last_reset_at)}</span>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          {canManage ? (
            <>
              <Button variant={activeRecord ? "danger" : "secondary"} className="px-3 py-1.5 text-[11px]" onClick={() => onAdminClock(activeRecord ? "out" : "in")}>{activeRecord ? "Uscita" : "Entrata"}</Button>
              <Button variant="secondary" className="px-3 py-1.5 text-[11px]" onClick={onEditRecord} disabled={!latestRecord}>Modifica</Button>
              <Button variant="ghost" className="px-3 py-1.5 text-[11px]" onClick={onReset}>Azzera</Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricBlock({ label, value, tone }: { label: string; value: string; tone: "green" | "yellow" | "blue" }) {
  const toneClass = {
    green: "text-emerald-300",
    yellow: "text-amber-300",
    blue: "text-blue-300",
  }[tone];
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
      <div className={`technical-number mt-1 text-xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function StaffRow({ staff, activeRecord, canManage, onAdminClock, onEditRecord }: { staff: StaffMember; activeRecord: AttendanceRecord | null; canManage: boolean; onAdminClock: (mode: AdminClockMode) => void; onEditRecord?: () => void }) {
  return (
    <div className="data-row flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={activeRecord ? "Presente" : "Assente"} tone={activeRecord ? "green" : "neutral"} />
          {activeRecord ? <StatusBadge label={getLocationLabel(activeRecord.check_in_location_label)} tone={activeRecord.check_in_location_label === "pista" ? "yellow" : "blue"} /> : null}
        </div>
        <div className="mt-3 text-lg font-black text-[var(--text-primary)]">{getStaffLabel(staff)}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
          {[staff.role_label, staff.email, staff.phone].filter(Boolean).join(" · ") || "Nessun dettaglio contatto"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[320px]">
        <MiniInfo icon={<LogIn size={15} />} label="Entrata" value={activeRecord ? formatTime(activeRecord.check_in_at) : "—"} />
        <MiniInfo icon={<Clock3 size={15} />} label="Durata" value={activeRecord ? formatDuration(minutesBetween(activeRecord.check_in_at)) : "—"} />
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant={activeRecord ? "danger" : "secondary"} className="px-3 py-1.5 text-[11px]" onClick={() => onAdminClock(activeRecord ? "out" : "in")}>{activeRecord ? "Uscita admin" : "Entrata admin"}</Button>
          <Button variant="ghost" className="px-3 py-1.5 text-[11px]" onClick={onEditRecord} disabled={!onEditRecord}>Modifica</Button>
        </div>
      ) : null}
    </div>
  );
}

function AttendanceRecordCard({ record, canManage, onEdit }: { record: AttendanceRecord; canManage: boolean; onEdit: () => void }) {
  const isOpen = !record.check_out_at;
  return (
    <div className="race-card-grid p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={isOpen ? "Presente" : "Chiusa"} tone={isOpen ? "green" : "neutral"} />
          <StatusBadge label={getLocationLabel(record.check_in_location_label)} tone={record.check_in_location_label === "pista" ? "yellow" : "blue"} />
          {record.check_in_source === "admin" || record.check_out_source === "admin" ? <StatusBadge label="Corretta admin" tone="purple" /> : null}
        </div>
        {canManage ? (
          <Button variant="secondary" className="px-3 py-1.5 text-[11px]" onClick={onEdit}>
            <Edit3 size={13} className="mr-1.5" />
            Modifica
          </Button>
        ) : null}
      </div>
      <h3 className="mt-4 text-xl font-black text-[var(--text-primary)]">{getStaffLabel(record.staff_member)}</h3>
      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {record.event?.name ? `Evento: ${record.event.name}` : "Nessun evento collegato"}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniInfo icon={<LogIn size={15} />} label="Entrata" value={formatDateTime(record.check_in_at)} />
        <MiniInfo icon={<LogOut size={15} />} label="Uscita" value={formatDateTime(record.check_out_at)} />
        <MiniInfo icon={<TimerReset size={15} />} label="Durata" value={formatDuration(minutesBetween(record.check_in_at, record.check_out_at))} />
      </div>
      {record.check_in_note || record.check_out_note ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
          {[record.check_in_note, record.check_out_note].filter(Boolean).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
