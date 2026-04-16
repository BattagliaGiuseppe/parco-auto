"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Fuel,
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
  const [turnForm, setTurnForm] = useState({
    event_session_id: "",
    driver_id: "",
    minutes: "0",
    laps: "0",
    fuel_start_liters: "0",
    fuel_end_liters: "0",
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

    setEventCar(eventCarRes.data);
    setDrivers(driversRes.data || []);
    setAssignedDrivers(assignedRes.data || []);
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
      },
      { label: "Sessioni", value: String(sessions.length), icon: <CalendarDays size={18} /> },
      { label: "Turni registrati", value: String(turns.length), icon: <Fuel size={18} /> },
      {
        label: "Consumo medio",
        value: fuelSummary.perLap > 0 ? `${fuelSummary.perLap.toFixed(2)} L/giro` : "—",
        icon: <Fuel size={18} />,
      },
    ],
    [assignedDrivers.length, sessions.length, turns.length, fuelSummary.perLap]
  );

  async function addDriver() {
    if (!canEditEvents || !selectedDriver) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase.from("event_car_drivers").insert([
      {
        team_id: ctx.teamId,
        event_car_id: eventCarId,
        driver_id: selectedDriver,
        role: "primary",
      },
    ]);
    if (error) {
      alert(error.message);
      return;
    }
    setSelectedDriver("");
    await loadAll();
  }

  async function saveTurn() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
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
      alert(error.message);
      return;
    }
    setTurnForm({
      event_session_id: "",
      driver_id: "",
      minutes: "0",
      laps: "0",
      fuel_start_liters: "0",
      fuel_end_liters: "0",
      notes: "",
    });
    await loadAll();
  }

  async function saveSetup() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase
      .from("event_car_data")
      .insert([{ team_id: ctx.teamId, event_car_id: eventCarId, section: "setup", data: setupData }]);

    if (error) alert(error.message);
    else alert("Setup salvato");
  }

  async function saveCheckup() {
    if (!canEditEvents) return;
    const ctx = await getCurrentTeamContext();
    const { error } = await supabase
      .from("event_car_data")
      .insert([{ team_id: ctx.teamId, event_car_id: eventCarId, section: "checkup", data: checkData }]);

    if (error) alert(error.message);
    else alert("Check-up salvato");
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
    return <div className="p-6 text-neutral-500">Caricamento console mezzo...</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
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
              className="rounded-xl bg-neutral-100 px-4 py-2 text-neutral-700 hover:bg-neutral-200"
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

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Piloti associati"
          subtitle="Qui associ un pilota già registrato nell'anagrafica Piloti. Se devi creare un nuovo pilota usa prima il modulo Piloti."
        >
          {canEditEvents ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px]">
              <select
                className="rounded-xl border p-3"
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
              <button
                onClick={addDriver}
                className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500"
              >
                <PlusCircle size={16} className="mr-2 inline" />
                Associa pilota
              </button>
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            {assignedDrivers.length === 0 ? (
              <EmptyState title="Nessun pilota associato" />
            ) : (
              assignedDrivers.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
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
          subtitle="Per calcoli residuo, carburante da aggiungere e stampa usa il modulo dedicato Turni & fuel avanzato."
        >
          {canEditEvents ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className="rounded-xl border p-3"
                  value={turnForm.event_session_id}
                  onChange={(e) => setTurnForm({ ...turnForm, event_session_id: e.target.value })}
                >
                  <option value="">Sessione</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border p-3"
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
                <input
                  type="number"
                  className="rounded-xl border p-3"
                  placeholder="Minuti turno"
                  value={turnForm.minutes}
                  onChange={(e) => setTurnForm({ ...turnForm, minutes: e.target.value })}
                />
                <input
                  type="number"
                  className="rounded-xl border p-3"
                  placeholder="Giri"
                  value={turnForm.laps}
                  onChange={(e) => setTurnForm({ ...turnForm, laps: e.target.value })}
                />
                <input
                  type="number"
                  className="rounded-xl border p-3"
                  placeholder="Litri inizio turno"
                  value={turnForm.fuel_start_liters}
                  onChange={(e) =>
                    setTurnForm({ ...turnForm, fuel_start_liters: e.target.value })
                  }
                />
                <input
                  type="number"
                  className="rounded-xl border p-3"
                  placeholder="Litri fine turno"
                  value={turnForm.fuel_end_liters}
                  onChange={(e) =>
                    setTurnForm({ ...turnForm, fuel_end_liters: e.target.value })
                  }
                />
                <textarea
                  className="min-h-24 rounded-xl border p-3 md:col-span-2"
                  placeholder="Note turno"
                  value={turnForm.notes}
                  onChange={(e) => setTurnForm({ ...turnForm, notes: e.target.value })}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={saveTurn}
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                >
                  <Save size={16} className="mr-2 inline" />
                  Salva turno
                </button>
              </div>
            </>
          ) : null}

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="font-semibold text-neutral-900">Riepilogo fuel evento</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>Litri consumati: <span className="font-semibold">{fuelSummary.totalUsed.toFixed(1)} L</span></div>
              <div>Consumo medio: <span className="font-semibold">{fuelSummary.perLap > 0 ? `${fuelSummary.perLap.toFixed(2)} L/giro` : "—"}</span></div>
              <div>Per minuto: <span className="font-semibold">{fuelSummary.perMinute > 0 ? `${fuelSummary.perMinute.toFixed(2)} L/min` : "—"}</span></div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Setup dinamico"
          subtitle="Campi configurabili da Impostazioni, adattabili a mezzo e team"
        >
          {setupFields.length === 0 ? (
            <EmptyState title="Nessun campo setup configurato" />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {setupFields.map((field) => (
                <div key={field.id}>
                  <label className="mb-1 block text-sm font-semibold text-neutral-700">
                    {field.label}
                  </label>
                  {field.field_type === "textarea" ? (
                    <textarea
                      disabled={!canEditEvents}
                      className={`min-h-24 w-full rounded-xl border p-3 ${
                        !canEditEvents ? "bg-neutral-100 text-neutral-500" : ""
                      }`}
                      value={setupData[field.field_key] || ""}
                      onChange={(e) =>
                        setSetupData({ ...setupData, [field.field_key]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      disabled={!canEditEvents}
                      className={`w-full rounded-xl border p-3 ${
                        !canEditEvents ? "bg-neutral-100 text-neutral-500" : ""
                      }`}
                      value={setupData[field.field_key] || ""}
                      onChange={(e) =>
                        setSetupData({ ...setupData, [field.field_key]: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {canEditEvents ? (
            <div className="mt-4 flex justify-end">
              <button
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
          subtitle="Checklist configurabile dalle Impostazioni"
        >
          {checklists.length === 0 ? (
            <EmptyState title="Nessuna checklist configurata" />
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
                        className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]"
                      >
                        <div>
                          <div className="text-sm font-semibold text-neutral-800">
                            {item.label}
                          </div>
                          <textarea
                            disabled={!canEditEvents}
                            className={`mt-2 min-h-20 w-full rounded-xl border p-3 ${
                              !canEditEvents ? "bg-neutral-100 text-neutral-500" : ""
                            }`}
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
                        <select
                          disabled={!canEditEvents}
                          className={`rounded-xl border p-3 ${
                            !canEditEvents ? "bg-neutral-100 text-neutral-500" : ""
                          }`}
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
