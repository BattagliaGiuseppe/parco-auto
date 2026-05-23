"use client";

import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Fuel,
  Info,
  PlusCircle,
  Save,
  Settings2,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import { UiField, uiInputClassName, uiTextareaClassName } from "@/components/UiField";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function EventCarPage() {
  const { eventId, eventCarId } = useParams() as {
    eventId: string;
    eventCarId: string;
  };

  const access = usePermissionAccess();
  const canViewEvents = access.hasPermission("events.view");
  const canEditEvents = access.hasPermission("events.edit", ["owner", "admin"]);

  const [eventCar, setEventCar] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [assignedDrivers, setAssignedDrivers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [turns, setTurns] = useState<any[]>([]);
  const [setupFields, setSetupFields] = useState<any[]>([]);
  const [setupData, setSetupData] = useState<Record<string, any>>({});
  const [checklists, setChecklists] = useState<any[]>([]);
  const [checkData, setCheckData] = useState<Record<string, { status: string; note: string }>>({});

  const [selectedDriver, setSelectedDriver] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [turnForm, setTurnForm] = useState({
    event_session_id: "",
    driver_id: "",
    minutes: "",
    laps: "",
    fuel_start_liters: "",
    fuel_end_liters: "",
    notes: "",
  });

  async function loadAll() {
    const ctx = await getCurrentTeamContext();

    const [
      eventCarRes,
      driversRes,
      assignedRes,
      sessionsRes,
      turnsRes,
      setupFieldsRes,
      setupDataRes,
      checklistGroupsRes,
      checklistItemsRes,
      checkDataRes,
    ] = await Promise.all([
      supabase
        .from("event_cars")
        .select("id,status,notes,event_id(id,name,date),car_id(id,name)")
        .eq("team_id", ctx.teamId)
        .eq("id", eventCarId)
        .single(),
      supabase
        .from("drivers")
        .select("id,first_name,last_name")
        .eq("team_id", ctx.teamId)
        .order("last_name", { ascending: true }),
      supabase
        .from("event_car_drivers")
        .select("id,role,driver_id(id,first_name,last_name)")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId),
      supabase
        .from("event_sessions")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_car_turns")
        .select(
          "id,event_session_id,driver_id,minutes,laps,fuel_start_liters,fuel_end_liters,notes,created_at"
        )
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .order("created_at", { ascending: false }),
      supabase
        .from("team_setup_fields")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("order_index", { ascending: true }),
      supabase
        .from("event_car_data")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .eq("section", "setup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("team_checklists")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("order_index", { ascending: true }),
      supabase
        .from("team_checklist_items")
        .select("*")
        .eq("team_id", ctx.teamId)
        .order("order_index", { ascending: true }),
      supabase
        .from("event_car_data")
        .select("*")
        .eq("team_id", ctx.teamId)
        .eq("event_car_id", eventCarId)
        .eq("section", "checkup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setEventCar(
      eventCarRes.data
        ? {
            ...eventCarRes.data,
            event_id: normalizeRelation(eventCarRes.data.event_id),
            car_id: normalizeRelation(eventCarRes.data.car_id),
          }
        : null
    );
    setDrivers(driversRes.data || []);
    setAssignedDrivers(
      (assignedRes.data || []).map((row: any) => ({
        ...row,
        driver_id: normalizeRelation(row.driver_id),
      }))
    );
    setSessions(sessionsRes.data || []);
    setTurns(turnsRes.data || []);
    setSetupFields(setupFieldsRes.data || []);
    setSetupData((setupDataRes.data as any)?.data || {});

    const groups = checklistGroupsRes.data || [];
    const items = checklistItemsRes.data || [];
    setChecklists(
      groups.map((group: any) => ({
        ...group,
        items: items.filter((item: any) => item.checklist_id === group.id),
      }))
    );
    setCheckData((checkDataRes.data as any)?.data || {});
  }

  useEffect(() => {
    if (eventCarId && eventId && !access.loading && canViewEvents) {
      void loadAll();
    }
  }, [eventCarId, eventId, access.loading, canViewEvents]);

  const fuelSummary = useMemo(() => {
    const totalUsed = turns.reduce(
      (acc, row) =>
        acc +
        Math.max(
          0,
          Number(row.fuel_start_liters || 0) - Number(row.fuel_end_liters || 0)
        ),
      0
    );
    const totalLaps = turns.reduce((acc, row) => acc + Number(row.laps || 0), 0);
    const totalMinutes = turns.reduce((acc, row) => acc + Number(row.minutes || 0), 0);
    return {
      totalUsed,
      totalLaps,
      totalMinutes,
      perLap: totalLaps > 0 ? totalUsed / totalLaps : 0,
      perMinute: totalMinutes > 0 ? totalUsed / totalMinutes : 0,
    };
  }, [turns]);

  const stats = useMemo(
    () => [
      {
        label: "Piloti associati",
        value: String(assignedDrivers.length),
        icon: <Users size={18} />,
        helper: "Driver disponibili per il mezzo in evento",
      },
      {
        label: "Sessioni",
        value: String(sessions.length),
        icon: <CalendarDays size={18} />,
        helper: "Sessioni collegate al weekend corrente",
      },
      {
        label: "Turni registrati",
        value: String(turns.length),
        icon: <Fuel size={18} />,
        helper: "Turni già salvati per questo mezzo",
      },
      {
        label: "Consumo medio",
        value: fuelSummary.perLap > 0 ? `${fuelSummary.perLap.toFixed(2)} L/giro` : "—",
        icon: <Fuel size={18} />,
        helper: fuelSummary.perMinute > 0 ? `${fuelSummary.perMinute.toFixed(2)} L/min` : "Dato non disponibile",
      },
    ],
    [assignedDrivers.length, sessions.length, turns.length, fuelSummary.perLap, fuelSummary.perMinute]
  );

  async function addDriver() {
    if (!canEditEvents || !selectedDriver) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const { error } = await supabase.from("event_car_drivers").insert([
      {
        team_id: ctx.teamId,
        event_car_id: eventCarId,
        driver_id: selectedDriver,
        role: "primary",
      },
    ]);
    if (error) {
      setFeedback({ type: "error", message: error.message });
      return;
    }
    setSelectedDriver("");
    await loadAll();
    setFeedback({ type: "success", message: "Pilota associato correttamente all'evento." });
  }

  async function saveTurn() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const payload = {
      team_id: ctx.teamId,
      event_car_id: eventCarId,
      event_session_id: turnForm.event_session_id || null,
      driver_id: turnForm.driver_id || null,
      minutes: Number(turnForm.minutes || 0),
      laps: Number(turnForm.laps || 0),
      fuel_start_liters: Number(turnForm.fuel_start_liters || 0),
      fuel_end_liters: Number(turnForm.fuel_end_liters || 0),
      notes: turnForm.notes || null,
      created_by_team_user_id: ctx.teamUserId,
    };
    const { error } = await supabase.from("event_car_turns").insert([payload]);
    if (error) {
      setFeedback({ type: "error", message: error.message });
      return;
    }
    setTurnForm({
      event_session_id: "",
      driver_id: "",
      minutes: "",
      laps: "",
      fuel_start_liters: "",
      fuel_end_liters: "",
      notes: "",
    });
    await loadAll();
    setFeedback({ type: "success", message: "Turno registrato correttamente." });
  }

  async function saveSetup() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const { error } = await supabase
      .from("event_car_data")
      .insert([{ team_id: ctx.teamId, event_car_id: eventCarId, section: "setup", data: setupData }]);

    if (error) setFeedback({ type: "error", message: error.message });
    else setFeedback({ type: "success", message: "Setup salvato correttamente." });
  }

  async function saveCheckup() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);
    const { error } = await supabase
      .from("event_car_data")
      .insert([{ team_id: ctx.teamId, event_car_id: eventCarId, section: "checkup", data: checkData }]);

    if (error) setFeedback({ type: "error", message: error.message });
    else setFeedback({ type: "success", message: "Check-up tecnico salvato." });
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Console mezzo"
        subtitle="Piloti, setup, check-up, turni e fuel"
        icon={<CalendarDays size={22} />}
        state="loading"
      />
    );
  }
  if (access.error) {
    return (
      <PagePermissionState
        title="Console mezzo"
        subtitle="Piloti, setup, check-up, turni e fuel"
        icon={<CalendarDays size={22} />}
        state="error"
        message={access.error}
      />
    );
  }
  if (!canViewEvents) {
    return (
      <PagePermissionState
        title="Console mezzo"
        subtitle="Piloti, setup, check-up, turni e fuel"
        icon={<CalendarDays size={22} />}
        state="denied"
        message="Il tuo ruolo non può aprire la console mezzo dell'evento."
      />
    );
  }
  if (!eventCar) {
    return (
      <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
        <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-5 text-sm text-neutral-500 shadow-sm">
          Caricamento console mezzo...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title={`${eventCar.car_id?.name || "Mezzo"} · ${eventCar.event_id?.name || "Evento"}`}
        subtitle="Console mezzo in evento: piloti, setup, check-up, turni e fuel"
        icon={<CalendarDays size={22} />}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/calendar/${eventId}/car/${eventCarId}/turns`}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
            >
              Turni & fuel avanzato
            </Link>
            <Link
              href={`/calendar/${eventId}`}
              className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50"
            >
              <ArrowLeft size={16} className="mr-2 inline" />
              Evento
            </Link>
          </div>
        }
      />

      {!canEditEvents ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura a questa console mezzo.
        </div>
      ) : null}

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Questa è la console tecnica del mezzo dentro l'evento."
      >
        <InfoBlock>
          Qui lavori sul singolo mezzo del weekend: associ i piloti, registri i turni rapidi,
          salvi il setup e chiudi il check-up tecnico. Quando ti serve una vista più dettagliata
          su turni, fuel e stampa scheda, usa il modulo <strong>Turni & fuel avanzato</strong>.
        </InfoBlock>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Piloti associati"
          subtitle="Qui associ un pilota già registrato nell'anagrafica Piloti."
        >
          {canEditEvents ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px]">
              <UiField label="Pilota registrato">
                <select
                  className={uiInputClassName}
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                >
                  <option value="">Seleziona pilota già registrato</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </option>
                  ))}
                </select>
              </UiField>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addDriver}
                  disabled={!selectedDriver}
                  className={`w-full rounded-xl px-4 py-2 font-bold transition ${
                    selectedDriver
                      ? "bg-yellow-400 text-black hover:bg-yellow-500"
                      : "cursor-not-allowed bg-neutral-200 text-neutral-500"
                  }`}
                >
                  <PlusCircle size={16} className="mr-2 inline" />
                  Associa pilota
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {assignedDrivers.length === 0 ? (
              <EmptyState
                title="Nessun pilota associato"
                description="Associa almeno un pilota per poterlo usare nelle sessioni del mezzo."
              />
            ) : (
              assignedDrivers.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="font-bold text-neutral-900">
                    {row.driver_id?.first_name} {row.driver_id?.last_name}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">Ruolo {row.role}</div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Turni e fuel rapidi"
          subtitle="Registrazione veloce del turno; per residui, stima rabbocco e stampa usa il modulo avanzato."
        >
          {canEditEvents ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <UiField label="Sessione">
                  <select
                    className={uiInputClassName}
                    value={turnForm.event_session_id}
                    onChange={(e) => setTurnForm({ ...turnForm, event_session_id: e.target.value })}
                  >
                    <option value="">Sessione</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                      </option>
                    ))}
                  </select>
                </UiField>

                <UiField label="Pilota">
                  <select
                    className={uiInputClassName}
                    value={turnForm.driver_id}
                    onChange={(e) => setTurnForm({ ...turnForm, driver_id: e.target.value })}
                  >
                    <option value="">Pilota</option>
                    {assignedDrivers.map((row) => (
                      <option key={row.id} value={row.driver_id?.id}>
                        {row.driver_id?.first_name} {row.driver_id?.last_name}
                      </option>
                    ))}
                  </select>
                </UiField>

                <UiField label="Minuti turno">
                  <input
                    type="number"
                    className={uiInputClassName}
                    placeholder="Es. 20"
                    value={turnForm.minutes}
                    onChange={(e) => setTurnForm({ ...turnForm, minutes: e.target.value })}
                  />
                </UiField>

                <UiField label="Giri">
                  <input
                    type="number"
                    className={uiInputClassName}
                    placeholder="Es. 12"
                    value={turnForm.laps}
                    onChange={(e) => setTurnForm({ ...turnForm, laps: e.target.value })}
                  />
                </UiField>

                <UiField label="Litri inizio turno">
                  <input
                    type="number"
                    className={uiInputClassName}
                    placeholder="Es. 22"
                    value={turnForm.fuel_start_liters}
                    onChange={(e) =>
                      setTurnForm({ ...turnForm, fuel_start_liters: e.target.value })
                    }
                  />
                </UiField>

                <UiField label="Litri fine turno">
                  <input
                    type="number"
                    className={uiInputClassName}
                    placeholder="Es. 7"
                    value={turnForm.fuel_end_liters}
                    onChange={(e) =>
                      setTurnForm({ ...turnForm, fuel_end_liters: e.target.value })
                    }
                  />
                </UiField>

                <div className="md:col-span-2">
                  <UiField label="Note turno">
                    <textarea
                      className={uiTextareaClassName}
                      placeholder="Annotazioni su gomme, pista, bilanciamento, problemi o riferimenti utili."
                      value={turnForm.notes}
                      onChange={(e) => setTurnForm({ ...turnForm, notes: e.target.value })}
                    />
                  </UiField>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={saveTurn}
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                >
                  <Save size={16} className="mr-2 inline" />
                  Salva turno
                </button>
              </div>
            </>
          ) : null}

          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="font-semibold text-neutral-900">Riepilogo fuel evento</div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                Litri consumati:{" "}
                <span className="font-semibold">{fuelSummary.totalUsed.toFixed(1)} L</span>
              </div>
              <div>
                Consumo medio:{" "}
                <span className="font-semibold">
                  {fuelSummary.perLap > 0 ? `${fuelSummary.perLap.toFixed(2)} L/giro` : "—"}
                </span>
              </div>
              <div>
                Per minuto:{" "}
                <span className="font-semibold">
                  {fuelSummary.perMinute > 0 ? `${fuelSummary.perMinute.toFixed(2)} L/min` : "—"}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Setup dinamico"
          subtitle="Campi configurabili da Impostazioni, adattabili a mezzo e team."
        >
          {setupFields.length === 0 ? (
            <EmptyState
              title="Nessun campo setup configurato"
              description="Configura i campi setup dal Control Center per vederli qui."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {setupFields.map((field) => (
                <UiField key={field.id} label={field.label}>
                  {field.field_type === "textarea" ? (
                    <textarea
                      disabled={!canEditEvents}
                      className={`${uiTextareaClassName} ${!canEditEvents ? "bg-neutral-100 text-neutral-500" : ""}`}
                      value={setupData[field.field_key] || ""}
                      onChange={(e) =>
                        setSetupData({ ...setupData, [field.field_key]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      disabled={!canEditEvents}
                      className={`${uiInputClassName} ${!canEditEvents ? "bg-neutral-100 text-neutral-500" : ""}`}
                      value={setupData[field.field_key] || ""}
                      onChange={(e) =>
                        setSetupData({ ...setupData, [field.field_key]: e.target.value })
                      }
                    />
                  )}
                </UiField>
              ))}
            </div>
          )}
          {canEditEvents ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveSetup}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
              >
                <Settings2 size={16} className="mr-2 inline" />
                Salva setup
              </button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Check-up tecnico"
          subtitle="Checklist configurabile dalle Impostazioni."
        >
          {checklists.length === 0 ? (
            <EmptyState
              title="Nessuna checklist configurata"
              description="Configura i gruppi di check-up dal Control Center."
            />
          ) : (
            <div className="space-y-4">
              {checklists.map((group) => (
                <div
                  key={group.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="font-bold text-neutral-900">{group.name}</div>
                  <div className="mt-3 space-y-3">
                    {group.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px]"
                      >
                        <div>
                          <div className="text-sm font-semibold text-neutral-800">
                            {item.label}
                          </div>
                          <textarea
                            disabled={!canEditEvents}
                            className={`mt-2 min-h-20 w-full rounded-xl border p-3 ${!canEditEvents ? "bg-neutral-100 text-neutral-500" : ""}`}
                            placeholder="Nota tecnica"
                            value={checkData[item.id]?.note || ""}
                            onChange={(e) =>
                              setCheckData({
                                ...checkData,
                                [item.id]: {
                                  status: checkData[item.id]?.status || "ok",
                                  note: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                        <UiField label="Esito">
                          <select
                            disabled={!canEditEvents}
                            className={`${uiInputClassName} ${!canEditEvents ? "bg-neutral-100 text-neutral-500" : ""}`}
                            value={checkData[item.id]?.status || "ok"}
                            onChange={(e) =>
                              setCheckData({
                                ...checkData,
                                [item.id]: {
                                  status: e.target.value,
                                  note: checkData[item.id]?.note || "",
                                },
                              })
                            }
                          >
                            <option value="ok">OK</option>
                            <option value="check">Da controllare</option>
                            <option value="problem">Problema</option>
                          </select>
                        </UiField>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {canEditEvents ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveCheckup}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
              >
                <ClipboardCheck size={16} className="mr-2 inline" />
                Salva check-up
              </button>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
