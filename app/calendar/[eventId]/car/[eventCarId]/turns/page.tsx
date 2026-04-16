"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Droplets, Pencil, Printer, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import PrintLetterhead from "@/components/PrintLetterhead";

type TurnRow = {
  id: string;
  event_session_id: string | null;
  driver_id: string | null;
  minutes: number | null;
  laps: number | null;
  fuel_start_liters: number | null;
  fuel_end_liters: number | null;
  notes: string | null;
  created_at: string;
};

export default function EventCarTurnsPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const access = usePermissionAccess();
  const canViewEvents = access.hasPermission("events.view");
  const canEditEvents = access.hasPermission("events.edit", ["owner", "admin"]);

  const [eventCar, setEventCar] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [assignedDrivers, setAssignedDrivers] = useState<any[]>([]);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [nextStintMinutes, setNextStintMinutes] = useState("20");
  const [nextStintLaps, setNextStintLaps] = useState("0");
  const [reserveLiters, setReserveLiters] = useState("3");
  const [form, setForm] = useState({
    event_session_id: "",
    driver_id: "",
    minutes: "20",
    laps: "0",
    fuel_start_liters: "0",
    fuel_end_liters: "0",
    notes: "",
  });

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [eventCarRes, sessionsRes, assignedDriversRes, turnsRes] = await Promise.all([
        supabase
          .from("event_cars")
          .select("id,event_id(id,name,date),car_id(id,name)")
          .eq("team_id", ctx.teamId)
          .eq("id", eventCarId)
          .single(),
        supabase
          .from("event_sessions")
          .select("*")
          .eq("team_id", ctx.teamId)
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_car_drivers")
          .select("id,role,driver_id(id,first_name,last_name)")
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId),
        supabase
          .from("event_car_turns")
          .select(
            "id,event_session_id,driver_id,minutes,laps,fuel_start_liters,fuel_end_liters,notes,created_at"
          )
          .eq("team_id", ctx.teamId)
          .eq("event_car_id", eventCarId)
          .order("created_at", { ascending: false }),
      ]);

      setEventCar(eventCarRes.data || null);
      setSessions(sessionsRes.data || []);
      setAssignedDrivers(assignedDriversRes.data || []);
      setTurns((turnsRes.data || []) as TurnRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventCarId && eventId && !access.loading && canViewEvents) {
      void loadAll();
    }
  }, [eventCarId, eventId, access.loading, canViewEvents]);

  const totals = useMemo(() => {
    const totalMinutes = turns.reduce((sum, row) => sum + Number(row.minutes || 0), 0);
    const totalLaps = turns.reduce((sum, row) => sum + Number(row.laps || 0), 0);
    const totalUsed = turns.reduce(
      (sum, row) =>
        sum +
        Math.max(
          0,
          Number(row.fuel_start_liters || 0) - Number(row.fuel_end_liters || 0)
        ),
      0
    );
    const lastTurn = turns.length > 0 ? turns[0] : null;
    const remainingLiters = Number(lastTurn?.fuel_end_liters || 0);

    return {
      totalMinutes,
      totalLaps,
      totalUsed,
      perLap: totalLaps > 0 ? totalUsed / totalLaps : 0,
      perMinute: totalMinutes > 0 ? totalUsed / totalMinutes : 0,
      remainingLiters,
    };
  }, [turns]);

  const fuelPlanner = useMemo(() => {
    const minutes = Number(nextStintMinutes || 0);
    const laps = Number(nextStintLaps || 0);
    const reserve = Number(reserveLiters || 0);

    const basedOnMinutes =
      totals.perMinute > 0 ? totals.perMinute * Math.max(0, minutes) : 0;
    const basedOnLaps = totals.perLap > 0 ? totals.perLap * Math.max(0, laps) : 0;

    const estimatedRequired =
      basedOnMinutes > 0 ? basedOnMinutes + reserve : basedOnLaps + reserve;

    const toAdd = Math.max(0, estimatedRequired - totals.remainingLiters);

    return {
      estimatedRequired,
      toAdd,
      method:
        basedOnMinutes > 0
          ? "calcolo su minuti medi"
          : basedOnLaps > 0
          ? "calcolo su giri medi"
          : "nessun dato storico sufficiente",
    };
  }, [nextStintMinutes, nextStintLaps, reserveLiters, totals]);

  async function saveTurn() {
    if (!canEditEvents) return;
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const payload = {
        team_id: ctx.teamId,
        event_car_id: eventCarId,
        event_session_id: form.event_session_id || null,
        driver_id: form.driver_id || null,
        minutes: Number(form.minutes || 0),
        laps: Number(form.laps || 0),
        fuel_start_liters: Number(form.fuel_start_liters || 0),
        fuel_end_liters: Number(form.fuel_end_liters || 0),
        notes: form.notes || null,
      };

      if (editingTurnId) {
        const { error } = await supabase
          .from("event_car_turns")
          .update(payload)
          .eq("team_id", ctx.teamId)
          .eq("id", editingTurnId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_car_turns").insert([payload]);
        if (error) throw error;
      }

      resetForm();
      await loadAll();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Errore salvataggio turno");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(turn: TurnRow) {
    setEditingTurnId(turn.id);
    setForm({
      event_session_id: turn.event_session_id || "",
      driver_id: turn.driver_id || "",
      minutes: String(turn.minutes || 0),
      laps: String(turn.laps || 0),
      fuel_start_liters: String(turn.fuel_start_liters || 0),
      fuel_end_liters: String(turn.fuel_end_liters || 0),
      notes: turn.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingTurnId(null);
    setForm({
      event_session_id: "",
      driver_id: "",
      minutes: "20",
      laps: "0",
      fuel_start_liters: "0",
      fuel_end_liters: "0",
      notes: "",
    });
  }

  async function deleteTurn(turnId: string) {
    if (!canEditEvents) return;
    if (!confirm("Eliminare questo turno?")) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase
      .from("event_car_turns")
      .delete()
      .eq("team_id", ctx.teamId)
      .eq("id", turnId);

    if (error) {
      alert(error.message);
      return;
    }

    if (editingTurnId === turnId) resetForm();
    await loadAll();
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Turni & fuel"
        subtitle="Analisi consumo, residuo carburante e pianificazione"
        icon={<Droplets size={22} />}
        state="loading"
      />
    );
  }
  if (access.error) {
    return (
      <PagePermissionState
        title="Turni & fuel"
        subtitle="Analisi consumo, residuo carburante e pianificazione"
        icon={<Droplets size={22} />}
        state="error"
        message={access.error}
      />
    );
  }
  if (!canViewEvents) {
    return (
      <PagePermissionState
        title="Turni & fuel"
        subtitle="Analisi consumo, residuo carburante e pianificazione"
        icon={<Droplets size={22} />}
        state="denied"
        message="Il tuo ruolo non può aprire questa sezione."
      />
    );
  }
  if (loading) {
    return <div className="p-6 text-neutral-500">Caricamento turni...</div>;
  }
  if (!eventCar) {
    return <div className="p-6 text-neutral-500">Console turni non trovata.</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 print:p-0">
      <div className="print:hidden">
        <PageHeader
          title={`Turni & fuel · ${eventCar.car_id?.name || "Mezzo"}`}
          subtitle="Consumi, residuo carburante e pianificazione del turno successivo"
          icon={<Droplets size={22} />}
          actions={
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => window.print()}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                <Printer size={16} className="mr-2 inline" />
                Stampa scheda
              </button>
              <Link
                href={`/calendar/${eventId}/car/${eventCarId}`}
                className="rounded-xl bg-neutral-100 px-4 py-2 text-neutral-700 hover:bg-neutral-200"
              >
                <ArrowLeft size={16} className="mr-2 inline" />
                Console mezzo
              </Link>
            </div>
          }
        />
      </div>

      <div className="hidden print:block">
        <PrintLetterhead
          title="Scheda Turni & Fuel"
          subtitle={`${eventCar.car_id?.name || "Mezzo"} · ${eventCar.event_id?.name || "Evento"}`}
          rightMeta={[
            {
              label: "Consumo medio",
              value: totals.perLap > 0 ? `${totals.perLap.toFixed(2)} L/giro` : "—",
            },
            {
              label: "Residuo attuale",
              value: `${totals.remainingLiters.toFixed(1)} L`,
            },
          ]}
        />
      </div>

      {!canEditEvents ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 print:hidden">
          Hai accesso in sola lettura a turni e fuel.
        </div>
      ) : null}

      <SectionCard className="print:border-none print:shadow-none">
        <StatsGrid
          items={[
            { label: "Turni", value: String(turns.length), icon: <Droplets size={18} /> },
            { label: "Minuti", value: String(totals.totalMinutes), icon: <Droplets size={18} /> },
            { label: "Giri", value: String(totals.totalLaps), icon: <Droplets size={18} /> },
            {
              label: "Litri consumati",
              value: `${totals.totalUsed.toFixed(1)} L`,
              icon: <Droplets size={18} />,
            },
          ]}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr] print:grid-cols-1">
        <SectionCard
          title={editingTurnId ? "Modifica turno" : "Nuovo turno"}
          subtitle="Registra sessione, pilota, minuti, giri e carburante"
          className="print:hidden"
        >
          {canEditEvents ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SelectField
                  label="Sessione"
                  value={form.event_session_id}
                  onChange={(value) => setForm({ ...form, event_session_id: value })}
                  options={[
                    { value: "", label: "Seleziona sessione" },
                    ...sessions.map((session) => ({
                      value: session.id,
                      label: session.name,
                    })),
                  ]}
                />
                <SelectField
                  label="Pilota"
                  value={form.driver_id}
                  onChange={(value) => setForm({ ...form, driver_id: value })}
                  options={[
                    { value: "", label: "Seleziona pilota" },
                    ...assignedDrivers.map((row) => ({
                      value: row.driver_id?.id,
                      label: `${row.driver_id?.first_name || ""} ${row.driver_id?.last_name || ""}`.trim(),
                    })),
                  ]}
                />
                <Field
                  label="Durata turno (min)"
                  type="number"
                  value={form.minutes}
                  onChange={(value) => setForm({ ...form, minutes: value })}
                />
                <Field
                  label="Giri"
                  type="number"
                  value={form.laps}
                  onChange={(value) => setForm({ ...form, laps: value })}
                />
                <Field
                  label="Litri inizio turno"
                  type="number"
                  value={form.fuel_start_liters}
                  onChange={(value) => setForm({ ...form, fuel_start_liters: value })}
                />
                <Field
                  label="Litri fine turno"
                  type="number"
                  value={form.fuel_end_liters}
                  onChange={(value) => setForm({ ...form, fuel_end_liters: value })}
                />
                <div className="md:col-span-2">
                  <Label>Note</Label>
                  <textarea
                    className="min-h-28 w-full rounded-xl border px-4 py-3"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Condizioni meteo, traffico, gomme, mappa motore..."
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                {editingTurnId ? (
                  <button
                    onClick={resetForm}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Annulla modifica
                  </button>
                ) : null}
                <button
                  onClick={saveTurn}
                  disabled={saving}
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:opacity-60"
                >
                  <Save size={16} className="mr-2 inline" />
                  {saving ? "Salvataggio..." : editingTurnId ? "Aggiorna turno" : "Salva turno"}
                </button>
              </div>
            </>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Pianificazione fuel"
          subtitle="Calcola residuo e litri da aggiungere per il turno successivo"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 print:grid-cols-3">
            <MetricCard label="Consumo medio / giro" value={totals.perLap > 0 ? `${totals.perLap.toFixed(2)} L` : "—"} />
            <MetricCard label="Consumo medio / minuto" value={totals.perMinute > 0 ? `${totals.perMinute.toFixed(2)} L` : "—"} />
            <MetricCard label="Residuo attuale" value={`${totals.remainingLiters.toFixed(1)} L`} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 print:grid-cols-3">
            <Field
              label="Prossimo turno (min)"
              type="number"
              value={nextStintMinutes}
              onChange={setNextStintMinutes}
            />
            <Field
              label="Target giri"
              type="number"
              value={nextStintLaps}
              onChange={setNextStintLaps}
            />
            <Field
              label="Margine / reserve (L)"
              type="number"
              value={reserveLiters}
              onChange={setReserveLiters}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-semibold text-neutral-900">Suggerimento operativo</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="text-sm text-neutral-700">
                Carburante richiesto:{" "}
                <span className="font-bold text-neutral-900">
                  {fuelPlanner.estimatedRequired > 0
                    ? `${fuelPlanner.estimatedRequired.toFixed(1)} L`
                    : "—"}
                </span>
              </div>
              <div className="text-sm text-neutral-700">
                Litri da aggiungere:{" "}
                <span className="font-bold text-neutral-900">
                  {fuelPlanner.toAdd > 0 ? `${fuelPlanner.toAdd.toFixed(1)} L` : "0.0 L"}
                </span>
              </div>
              <div className="text-sm text-neutral-700">
                Metodo: <span className="font-bold text-neutral-900">{fuelPlanner.method}</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Storico turni"
        subtitle="Stampa inclusa: in stampa resta la tabella riepilogativa"
      >
        {turns.length === 0 ? (
          <EmptyState title="Nessun turno registrato" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="py-3 pr-4 font-semibold text-neutral-700">Sessione</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-700">Pilota</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-700">Min</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-700">Giri</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-700">Inizio</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-700">Fine</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-700">Consumati</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-700">Note</th>
                  <th className="py-3 font-semibold text-neutral-700 print:hidden">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {turns.map((turn) => {
                  const session = sessions.find((row) => row.id === turn.event_session_id);
                  const assigned = assignedDrivers.find(
                    (row) => row.driver_id?.id === turn.driver_id
                  );
                  const consumed = Math.max(
                    0,
                    Number(turn.fuel_start_liters || 0) -
                      Number(turn.fuel_end_liters || 0)
                  );

                  return (
                    <tr key={turn.id} className="border-b border-neutral-100 align-top">
                      <td className="py-3 pr-4">{session?.name || "—"}</td>
                      <td className="py-3 pr-4">
                        {assigned
                          ? `${assigned.driver_id?.first_name || ""} ${assigned.driver_id?.last_name || ""}`.trim()
                          : "—"}
                      </td>
                      <td className="py-3 pr-4">{turn.minutes || 0}</td>
                      <td className="py-3 pr-4">{turn.laps || 0}</td>
                      <td className="py-3 pr-4">{Number(turn.fuel_start_liters || 0).toFixed(1)} L</td>
                      <td className="py-3 pr-4">{Number(turn.fuel_end_liters || 0).toFixed(1)} L</td>
                      <td className="py-3 pr-4">{consumed.toFixed(1)} L</td>
                      <td className="py-3 pr-4 text-neutral-600">{turn.notes || "—"}</td>
                      <td className="py-3 print:hidden">
                        {canEditEvents ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startEdit(turn)}
                              className="inline-flex rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-700 hover:bg-neutral-50"
                              title="Modifica"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => deleteTurn(turn.id)}
                              className="inline-flex rounded-xl bg-red-50 px-3 py-2 text-red-600 hover:bg-red-100"
                              title="Elimina"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-semibold text-neutral-700">
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        className="w-full rounded-xl border px-4 py-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="w-full rounded-xl border px-4 py-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-neutral-900">{value}</div>
    </div>
  );
}
