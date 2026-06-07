"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  QrCode,
  ShieldCheck,
  TabletSmartphone,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import PagePermissionState from "@/components/PagePermissionState";
import { Button } from "@/components/Button";
import { UiField, uiInputClassName, uiSelectClassName, uiTextareaClassName } from "@/components/UiField";
import StatusBadge from "@/components/StatusBadge";
import { useLanguage } from "@/components/providers/LanguageProvider";

type LocationLabel = "sede" | "pista" | "altro";
type KioskMode = "toggle" | "in" | "out";

type EventOption = {
  id: string;
  name: string;
  date: string | null;
};

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
  event_id: string | null;
};

const LOCATION_LABELS: Record<LocationLabel, string> = {
  sede: "Sede / officina",
  pista: "Pista / evento",
  altro: "Altro luogo",
};

function sanitizeBadge(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

function sanitizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function getStaffLabel(staff: StaffMember | null) {
  if (!staff) return "Membro staff";
  return staff.full_name || staff.email || "Membro staff";
}

export default function AttendanceKioskPage() {
  const access = usePermissionAccess();
  const [badgeCode, setBadgeCode] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [locationLabel, setLocationLabel] = useState<LocationLabel>("sede");
  const [eventId, setEventId] = useState("");
  const [mode, setMode] = useState<KioskMode>("toggle");
  const [note, setNote] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastRecord, setLastRecord] = useState<AttendanceRecord | null>(null);
  const [lastStaff, setLastStaff] = useState<StaffMember | null>(null);

  const canUseKiosk = access.hasPermission("attendance.kiosk", ["owner", "admin"]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const badge = params.get("badge") || "";
    const event = params.get("eventId") || "";
    const location = params.get("location") as LocationLabel | null;
    const requestedMode = params.get("mode") as KioskMode | null;

    if (badge) setBadgeCode(sanitizeBadge(badge));
    if (event) setEventId(event);
    if (location && location in LOCATION_LABELS) setLocationLabel(location);
    if (requestedMode && ["toggle", "in", "out"].includes(requestedMode)) setMode(requestedMode);
  }, []);

  useEffect(() => {
    async function loadEvents() {
      if (!access.ctx || !canUseKiosk) return;
      setLoadingEvents(true);
      try {
        const { data, error: eventsError } = await supabase
          .from("events")
          .select("id,name,date")
          .eq("team_id", access.ctx.teamId)
          .order("date", { ascending: false })
          .limit(80);
        if (eventsError) throw eventsError;
        setEvents((data || []) as EventOption[]);
      } catch (err: any) {
        setError(err.message || "Errore durante il caricamento eventi.");
      } finally {
        setLoadingEvents(false);
      }
    }

    if (!access.loading) void loadEvents();
  }, [access.loading, access.ctx?.teamId, canUseKiosk]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId) || null, [events, eventId]);

  async function submitKioskClock() {
    if (!access.ctx || !canUseKiosk) return;
    if (!badgeCode.trim() && !pinCode.trim()) {
      setError("Inserisci codice badge oppure PIN rapido.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    setLastRecord(null);
    setLastStaff(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("attendance_kiosk_clock", {
        p_team_id: access.ctx.teamId,
        p_badge_code: badgeCode.trim() || null,
        p_pin_code: pinCode.trim() || null,
        p_location_label: locationLabel,
        p_event_id: eventId || null,
        p_note: note.trim() || null,
        p_mode: mode,
      });
      if (rpcError) throw rpcError;

      const record = data as AttendanceRecord;
      let staff: StaffMember | null = null;
      if (record?.staff_member_id) {
        const { data: staffData } = await supabase
          .from("team_staff_members")
          .select("id,full_name,email,role_label")
          .eq("id", record.staff_member_id)
          .single();
        staff = (staffData as StaffMember) || null;
      }

      setLastRecord(record);
      setLastStaff(staff);
      setMessage(record.check_out_at ? `Uscita registrata per ${getStaffLabel(staff)}` : `Entrata registrata per ${getStaffLabel(staff)}`);
      setPinCode("");
      if (!new URLSearchParams(window.location.search).get("badge")) setBadgeCode("");
      setNote("");
    } catch (err: any) {
      setError(err.message || "Errore durante la timbratura kiosk.");
    } finally {
      setSaving(false);
    }
  }

  if (access.loading) {
    return <PagePermissionState title="Kiosk presenze" subtitle="Modalità tablet per badge, PIN e QR evento" icon={<TabletSmartphone size={22} />} state="loading" />;
  }

  if (access.error) {
    return <PagePermissionState title="Kiosk presenze" subtitle="Modalità tablet per badge, PIN e QR evento" icon={<TabletSmartphone size={22} />} state="error" message={access.error} />;
  }

  if (!canUseKiosk) {
    return (
      <PagePermissionState
        title="Kiosk presenze"
        subtitle="Modalità tablet per badge, PIN e QR evento"
        icon={<TabletSmartphone size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso alla modalità kiosk presenze."
      />
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Kiosk presenze"
        subtitle="Schermata rapida per tablet in officina o in pista. Scansiona il badge/QR oppure inserisci il PIN rapido."
        icon={<TabletSmartphone size={22} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { window.location.href = "/attendance"; }}>Torna a Presenze</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Timbratura badge / PIN"
          subtitle="Il kiosk decide automaticamente entrata o uscita in modalità Toggle. In alternativa puoi forzare Entrata o Uscita."
          actions={<StatusBadge label={selectedEvent ? "Evento precompilato" : "Kiosk generale"} tone={selectedEvent ? "yellow" : "blue"} />}
        >
          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              {message}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UiField label="Codice badge">
              <div className="relative">
                <QrCode size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  className={`${uiInputClassName} pl-10 font-mono text-lg tracking-[0.12em]`}
                  value={badgeCode}
                  onChange={(event) => setBadgeCode(sanitizeBadge(event.target.value))}
                  placeholder="Es. A1B2C3D4"
                  autoFocus
                />
              </div>
            </UiField>

            <UiField label="PIN rapido">
              <div className="relative">
                <KeyRound size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  className={`${uiInputClassName} pl-10 font-mono text-lg tracking-[0.18em]`}
                  value={pinCode}
                  onChange={(event) => setPinCode(sanitizePin(event.target.value))}
                  placeholder="••••"
                  inputMode="numeric"
                  type="password"
                />
              </div>
            </UiField>

            <UiField label="Modalità">
              <select className={uiSelectClassName} value={mode} onChange={(event) => setMode(event.target.value as KioskMode)}>
                <option value="toggle">Automatico: entrata/uscita</option>
                <option value="in">Forza entrata</option>
                <option value="out">Forza uscita</option>
              </select>
            </UiField>

            <UiField label="Luogo">
              <select className={uiSelectClassName} value={locationLabel} onChange={(event) => setLocationLabel(event.target.value as LocationLabel)}>
                {Object.entries(LOCATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </UiField>

            <div className="md:col-span-2">
              <UiField label="Evento collegato">
                <select className={uiSelectClassName} value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={loadingEvents}>
                  <option value="">Nessun evento</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.name} · {formatDate(event.date)}</option>)}
                </select>
              </UiField>
            </div>

            <div className="md:col-span-2">
              <UiField label="Nota opzionale">
                <textarea
                  className={uiTextareaClassName}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Es. arrivo in circuito, carico materiale, supporto evento..."
                />
              </UiField>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button onClick={submitKioskClock} disabled={saving} className="min-h-[56px] text-base sm:col-span-2">
              {mode === "out" ? <LogOut size={19} className="mr-2" /> : <LogIn size={19} className="mr-2" />}
              {saving ? "Registrazione..." : "Registra timbratura"}
            </Button>
            <Button variant="secondary" onClick={() => { setBadgeCode(""); setPinCode(""); setNote(""); setMessage(""); setError(""); }} disabled={saving} className="min-h-[56px]">
              Pulisci
            </Button>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Contesto kiosk" subtitle="Queste informazioni vengono salvate insieme alla timbratura.">
            <div className="space-y-3">
              <KioskInfo icon={<MapPin size={16} />} label="Luogo" value={LOCATION_LABELS[locationLabel]} />
              <KioskInfo icon={<CalendarDays size={16} />} label="Evento" value={selectedEvent ? `${selectedEvent.name} · ${formatDate(selectedEvent.date)}` : "Nessun evento"} />
              <KioskInfo icon={<ShieldCheck size={16} />} label="Sicurezza" value="Badge e PIN sono salvati in forma hash nel database." />
            </div>
          </SectionCard>

          {lastRecord ? (
            <SectionCard title="Ultima timbratura" subtitle="Esito dell'ultima registrazione effettuata su questo tablet.">
              <div className="race-card-grid p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={lastRecord.check_out_at ? "Uscita" : "Entrata"} tone={lastRecord.check_out_at ? "red" : "green"} />
                  <StatusBadge label={LOCATION_LABELS[(lastRecord.check_in_location_label as LocationLabel) || locationLabel]} tone={lastRecord.check_in_location_label === "pista" ? "yellow" : "blue"} />
                </div>
                <div className="mt-4 text-2xl font-black text-[var(--text-primary)]">{getStaffLabel(lastStaff)}</div>
                <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Entrata {formatTime(lastRecord.check_in_at)}{lastRecord.check_out_at ? ` · Uscita ${formatTime(lastRecord.check_out_at)}` : ""}
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KioskInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { t } = useLanguage();
  return (
    <div className="race-mini-panel flex items-start gap-3 p-4">
      <div className="mt-0.5 text-[var(--brand-accent)]">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">{t(`ui.${label}`, label)}</div>
        <div className="mt-1 text-sm font-bold leading-5 text-[var(--text-primary)]">{t(`ui.${value}`, value)}</div>
      </div>
    </div>
  );
}
