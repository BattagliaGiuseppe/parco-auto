"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, LogIn, LogOut, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissionAccess } from "@/lib/permissions";
import PagePermissionState from "@/components/PagePermissionState";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { uiSelectClassName } from "@/components/UiField";
import { brandConfig } from "@/lib/brand";

type LocationLabel = "sede" | "pista" | "altro";

type StaffMember = {
  id: string;
  full_name: string;
  email: string | null;
  role_label: string | null;
};

type AttendanceRecord = {
  id: string;
  staff_member_id: string;
  check_in_at: string;
  check_out_at: string | null;
  check_in_location_label: string | null;
  check_out_location_label: string | null;
};

const LOCATION_LABELS: Record<LocationLabel, string> = {
  sede: "Sede / officina",
  pista: "Pista / evento",
  altro: "Altro luogo",
};

const LOCATION_STORAGE_KEY = "parcoauto.attendance.quick.location";

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
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

function formatDurationFrom(start: string | null | undefined) {
  if (!start) return "—";
  const diff = Math.max(0, Date.now() - new Date(start).getTime());
  const totalMinutes = Math.round(diff / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h}h ${m}m`;
}

function getLocationLabel(value: string | null | undefined) {
  if (!value) return "—";
  return LOCATION_LABELS[value as LocationLabel] || value;
}

export default function QuickAttendancePage() {
  const access = usePermissionAccess();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [openRecord, setOpenRecord] = useState<AttendanceRecord | null>(null);
  const [latestRecord, setLatestRecord] = useState<AttendanceRecord | null>(null);
  const [location, setLocation] = useState<LocationLabel>("sede");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canClockSelf = access.hasPermission("attendance.clock_self", ["owner", "admin", "engineer", "mechanic", "viewer"]);
  const isPresent = !!openRecord;

  const statusCopy = useMemo(() => {
    if (isPresent) {
      return {
        title: "PRESENTE",
        subtitle: `Entrata registrata alle ${formatTime(openRecord?.check_in_at)}`,
        tone: "green" as const,
      };
    }

    return {
      title: "NON PRESENTE",
      subtitle: latestRecord?.check_out_at
        ? `Ultima uscita: ${formatDateTime(latestRecord.check_out_at)}`
        : "Nessuna timbratura aperta",
      tone: "neutral" as const,
    };
  }, [isPresent, latestRecord?.check_out_at, openRecord?.check_in_at]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LOCATION_STORAGE_KEY) as LocationLabel | null;
    if (stored && Object.prototype.hasOwnProperty.call(LOCATION_LABELS, stored)) {
      setLocation(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCATION_STORAGE_KEY, location);
  }, [location]);

  async function loadQuickStatus() {
    if (!access.ctx || !canClockSelf) return;
    setLoading(true);
    setError("");

    try {
      const { data: staffData, error: staffError } = await supabase.rpc("attendance_ensure_staff_member", {
        p_team_id: access.ctx.teamId,
      });

      if (staffError) throw staffError;

      const currentStaff = staffData as StaffMember | null;
      setStaff(currentStaff);

      if (!currentStaff?.id) {
        setOpenRecord(null);
        setLatestRecord(null);
        return;
      }

      const [openRes, latestRes] = await Promise.all([
        supabase
          .from("attendance_records")
          .select("id, staff_member_id, check_in_at, check_out_at, check_in_location_label, check_out_location_label")
          .eq("team_id", access.ctx.teamId)
          .eq("staff_member_id", currentStaff.id)
          .is("check_out_at", null)
          .order("check_in_at", { ascending: false })
          .limit(1),
        supabase
          .from("attendance_records")
          .select("id, staff_member_id, check_in_at, check_out_at, check_in_location_label, check_out_location_label")
          .eq("team_id", access.ctx.teamId)
          .eq("staff_member_id", currentStaff.id)
          .order("check_in_at", { ascending: false })
          .limit(1),
      ]);

      if (openRes.error) throw openRes.error;
      if (latestRes.error) throw latestRes.error;

      setOpenRecord(((openRes.data || [])[0] as AttendanceRecord | undefined) || null);
      setLatestRecord(((latestRes.data || [])[0] as AttendanceRecord | undefined) || null);
    } catch (err: any) {
      setError(err.message || "Errore durante il caricamento della timbratura rapida.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && access.ctx && canClockSelf) {
      void loadQuickStatus();
    } else if (!access.loading) {
      setLoading(false);
    }
  }, [access.loading, access.ctx?.teamId, canClockSelf]);

  async function submitClock() {
    if (!access.ctx || !canClockSelf) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (openRecord) {
        const { data, error: rpcError } = await supabase.rpc("attendance_clock_out", {
          p_team_id: access.ctx.teamId,
          p_location_label: location,
          p_note: null,
        });
        if (rpcError) throw rpcError;
        const closed = data as AttendanceRecord | null;
        setSuccess(`Uscita registrata alle ${formatTime(closed?.check_out_at || new Date().toISOString())}.`);
      } else {
        const { data, error: rpcError } = await supabase.rpc("attendance_clock_in", {
          p_team_id: access.ctx.teamId,
          p_location_label: location,
          p_event_id: null,
          p_note: null,
        });
        if (rpcError) throw rpcError;
        const created = data as AttendanceRecord | null;
        setSuccess(`Entrata registrata alle ${formatTime(created?.check_in_at || new Date().toISOString())}.`);
      }

      await loadQuickStatus();
    } catch (err: any) {
      setError(err.message || "Errore durante la timbratura.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (access.loading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] p-6 text-[var(--text-secondary)]">
        Caricamento timbratura rapida...
      </div>
    );
  }

  if (access.error) {
    return <PagePermissionState title="Timbratura rapida" subtitle="Entrata e uscita personale" icon={<Clock3 size={22} />} state="error" message={access.error} />;
  }

  if (!canClockSelf) {
    return (
      <PagePermissionState
        title="Timbratura rapida"
        subtitle="Entrata e uscita personale"
        icon={<Clock3 size={22} />}
        state="denied"
        message="Il tuo profilo non è abilitato alla timbratura personale. Contatta un amministratore."
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-page)] px-4 py-6 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-xl flex-col justify-center">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
              <img src={brandConfig.logoPath} alt={brandConfig.appName} className="h-12 w-12 object-contain" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--brand-accent)]">Presenze</div>
              <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)]">Timbratura rapida</h1>
            </div>
          </div>
          <button onClick={signOut} className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            Esci
          </button>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.085),rgba(255,255,255,0.045))] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
          <div className="border-b border-white/10 px-6 py-6 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
                  <UserRound size={16} />
                  {staff?.full_name || staff?.email || "Membro staff"}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className={`h-4 w-4 rounded-full ${isPresent ? "bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.55)]" : "bg-white/35"}`} />
                  <div>
                    <div className="text-3xl font-black tracking-tight sm:text-4xl">{statusCopy.title}</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">{statusCopy.subtitle}</div>
                  </div>
                </div>
              </div>
              <StatusBadge label={isPresent ? "in turno" : "fuori turno"} tone={statusCopy.tone} />
            </div>
          </div>

          <div className="space-y-5 px-6 py-6 sm:px-8">
            {error ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                {success}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                <MapPin size={14} />
                Luogo timbratura
              </span>
              <select className={`${uiSelectClassName} h-14 text-base font-black`} value={location} onChange={(event) => setLocation(event.target.value as LocationLabel)} disabled={saving}>
                {Object.entries(LOCATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <span className="mt-2 block text-xs font-semibold text-[var(--text-muted)]">
                Di default resta selezionata la sede/officina. Cambiala solo se inizi o chiudi fuori sede.
              </span>
            </label>

            <Button
              onClick={submitClock}
              disabled={saving}
              variant={isPresent ? "danger" : "primary"}
              className="h-20 w-full rounded-3xl text-xl shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
            >
              {isPresent ? <LogOut size={24} className="mr-3" /> : <LogIn size={24} className="mr-3" />}
              {saving ? "SALVATAGGIO..." : isPresent ? "USCITA" : "ENTRATA"}
            </Button>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/18 px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  <Clock3 size={14} />
                  Durata attuale
                </div>
                <div className="mt-2 text-lg font-black text-[var(--text-primary)]">
                  {isPresent ? formatDurationFrom(openRecord?.check_in_at) : "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  <MapPin size={14} />
                  Luogo entrata
                </div>
                <div className="mt-2 text-lg font-black text-[var(--text-primary)]">
                  {isPresent ? getLocationLabel(openRecord?.check_in_location_label) : "—"}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-4 text-xs leading-5 text-[var(--text-secondary)]">
              <div className="mb-1 flex items-center gap-2 font-black uppercase tracking-[0.12em] text-[var(--brand-accent)]">
                <ShieldCheck size={14} />
                Accesso personale
              </div>
              Questa pagina permette solo la tua entrata/uscita. Riepiloghi, modifiche e statistiche restano riservati ad owner/admin.
            </div>
          </div>
        </div>

        <a href="/dashboard" className="mx-auto mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)] hover:text-[var(--brand-accent)]">
          Vai alla dashboard
          <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
