"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";
import {
  Edit,
  PlusCircle,
  X,
  Wrench,
  CalendarClock,
  CarFront,
  FileText,
  RotateCcw,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type MaintenanceRow = {
  id: string;
  date: string;
  type: string;
  notes: string | null;
  car_id:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  component_id:
    | { id: string; identifier: string }
    | { id: string; identifier: string }[]
    | null;
};

type CarOption = {
  id: string;
  name: string;
};

type ComponentOption = {
  id: string;
  identifier: string;
  hours: number | null;
  life_hours: number | null;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatHours(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)} h`;
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MaintenancesPage() {
  return (
    <Suspense
      fallback={
        <div className={`card-base p-10 text-center text-neutral-500 ${audiowide.className}`}>
          Caricamento manutenzioni...
        </div>
      }
    >
      <MaintenancesPageContent />
    </Suspense>
  );
}

function MaintenancesPageContent() {
  const searchParams = useSearchParams();

  const [maintenances, setMaintenances] = useState<MaintenanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [carId, setCarId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [notes, setNotes] = useState("");

  const [revisionDescription, setRevisionDescription] = useState("");
  const [registerRevisionHistory, setRegisterRevisionHistory] = useState(true);
  const [resetHoursAfterRevision, setResetHoursAfterRevision] = useState(false);

  const [cars, setCars] = useState<CarOption[]>([]);
  const [components, setComponents] = useState<ComponentOption[]>([]);

  const [prefillHandled, setPrefillHandled] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const queryCarId = searchParams.get("carId") || "";
  const queryCarName = searchParams.get("carName") || "";
  const queryComponentId = searchParams.get("componentId") || "";
  const queryComponentName = searchParams.get("componentName") || "";
  const queryType = searchParams.get("type") || "";

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const isRevision = useMemo(() => {
    return type.trim().toLowerCase().includes("revis");
  }, [type]);

  const selectedComponent = useMemo(() => {
    return components.find((c) => c.id === componentId) || null;
  }, [components, componentId]);

  const fetchMaintenances = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("maintenances")
      .select("id, date, type, notes, car_id (id, name), component_id (id, identifier)")
      .order("date", { ascending: false });

    if (!error) {
      const normalized: MaintenanceRow[] = (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        type: row.type,
        notes: row.notes,
        car_id: row.car_id,
        component_id: row.component_id,
      }));

      setMaintenances(normalized);
    }

    setLoading(false);
  };

  const fetchCarsAndComponents = async () => {
    const { data: carsData } = await supabase.from("cars").select("id, name").order("name");

    const { data: compsData } = await supabase
      .from("components")
      .select("id, identifier, hours, life_hours")
      .order("identifier");

    setCars((carsData as CarOption[]) || []);
    setComponents((compsData as ComponentOption[]) || []);
  };

  useEffect(() => {
    fetchMaintenances();
    fetchCarsAndComponents();
  }, []);

  useEffect(() => {
    if (prefillHandled) return;
    if (!cars.length && !components.length) return;

    const hasPrefill =
      Boolean(queryCarId) ||
      Boolean(queryComponentId) ||
      Boolean(queryType) ||
      Boolean(queryCarName) ||
      Boolean(queryComponentName);

    if (!hasPrefill) return;

    resetForm();

    if (queryCarId) setCarId(queryCarId);
    if (queryComponentId) setComponentId(queryComponentId);

    if (queryType === "revisione") {
      setType("Revisione");
      setRegisterRevisionHistory(true);
      setRevisionDescription(
        queryComponentName
          ? `Revisione ${queryComponentName}`
          : "Revisione componente"
      );
    } else if (queryType) {
      setType(queryType);
    } else {
      setType("");
    }

    setDate(todayIso());

    const prefillLines: string[] = [];
    if (queryCarName) prefillLines.push(`Auto: ${queryCarName}`);
    if (queryComponentName) prefillLines.push(`Componente: ${queryComponentName}`);
    if (queryType === "revisione") prefillLines.push("Intervento aperto da dettaglio componente");

    if (prefillLines.length > 0) {
      setNotes(prefillLines.join("\n"));
    }

    setOpenModal(true);
    setPrefillHandled(true);
  }, [
    prefillHandled,
    cars,
    components,
    queryCarId,
    queryComponentId,
    queryType,
    queryCarName,
    queryComponentName,
  ]);

  const totalMaintenances = maintenances.length;

  const maintenancesWithNotes = useMemo(
    () => maintenances.filter((m) => Boolean(m.notes && m.notes.trim())).length,
    [maintenances]
  );

  const distinctCars = useMemo(() => {
    const ids = new Set(
      maintenances
        .map((m) => normalizeRelation(m.car_id)?.id)
        .filter((id): id is string => Boolean(id))
    );
    return ids.size;
  }, [maintenances]);

  const resetForm = () => {
    setCarId("");
    setComponentId("");
    setDate("");
    setType("");
    setNotes("");
    setEditId(null);
    setRevisionDescription("");
    setRegisterRevisionHistory(true);
    setResetHoursAfterRevision(false);
  };

  const closeModal = () => {
    setOpenModal(false);
    resetForm();
  };

  const openForCreate = () => {
    resetForm();
    setDate(todayIso());
    setOpenModal(true);
  };

  const openForEdit = (m: MaintenanceRow) => {
    setEditId(m.id);
    setCarId(normalizeRelation(m.car_id)?.id || "");
    setComponentId(normalizeRelation(m.component_id)?.id || "");
    setDate(m.date || "");
    setType(m.type || "");
    setNotes(m.notes || "");
    setRevisionDescription(
      m.type?.toLowerCase().includes("revis")
        ? `Revisione ${normalizeRelation(m.component_id)?.identifier || ""}`.trim()
        : ""
    );
    setRegisterRevisionHistory(false);
    setResetHoursAfterRevision(false);
    setOpenModal(true);
  };

  const saveMaintenance = async () => {
    if (!carId || !componentId || !date || !type) {
      showToast("Compila tutti i campi obbligatori", "error");
      return;
    }

    setSaving(true);

    try {
      if (editId) {
        const { error } = await supabase
          .from("maintenances")
          .update({
            car_id: carId,
            component_id: componentId,
            date,
            type,
            notes,
          })
          .eq("id", editId);

        if (error) throw error;

        showToast("Manutenzione aggiornata");
      } else {
        const { error: maintenanceError } = await supabase.from("maintenances").insert([
          {
            car_id: carId,
            component_id: componentId,
            date,
            type,
            notes,
          },
        ]);

        if (maintenanceError) throw maintenanceError;

        if (isRevision && registerRevisionHistory) {
          const hoursBefore = Number(selectedComponent?.hours ?? 0);
          const hoursAfter = resetHoursAfterRevision ? 0 : hoursBefore;

          const { error: revisionError } = await supabase
            .from("component_revisions")
            .insert([
              {
                component_id: componentId,
                date,
                description:
                  revisionDescription.trim() ||
                  `Revisione ${selectedComponent?.identifier || "componente"}`,
                notes: notes || null,
                reset_hours: resetHoursAfterRevision,
                hours_before_reset: hoursBefore,
                hours_after_reset: hoursAfter,
                life_hours_at_revision: selectedComponent?.life_hours ?? null,
              },
            ]);

          if (revisionError) throw revisionError;

          const componentUpdatePayload: {
            last_maintenance_date: string;
            hours?: number;
          } = {
            last_maintenance_date: date,
          };

          if (resetHoursAfterRevision) {
            componentUpdatePayload.hours = 0;
          }

          const { error: componentError } = await supabase
            .from("components")
            .update(componentUpdatePayload)
            .eq("id", componentId);

          if (componentError) throw componentError;
        } else {
          const { error: componentError } = await supabase
            .from("components")
            .update({ last_maintenance_date: date })
            .eq("id", componentId);

          if (componentError) throw componentError;
        }

        showToast(isRevision ? "Revisione registrata" : "Manutenzione registrata");
      }

      closeModal();
      await fetchMaintenances();
      await fetchCarsAndComponents();
    } catch (e) {
      console.error("Errore salvataggio manutenzione:", e);
      showToast("Errore nel salvataggio", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <Wrench size={14} />
                Gestione Manutenzioni
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Manutenzioni e interventi
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Registra, modifica e consulta gli interventi effettuati su auto e componenti.
              </p>
            </div>

            <div>
              <button onClick={openForCreate} className="btn-primary">
                <PlusCircle size={18} /> Aggiungi manutenzione
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          {(queryCarId || queryComponentId || queryType) && (
            <div className="mb-5 rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
              Apertura rapida da componente attiva. La manutenzione viene precompilata nel modulo.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Wrench size={18} className="text-yellow-600" />}
              label="Manutenzioni totali"
              value={String(totalMaintenances)}
            />
            <SummaryCard
              icon={<CarFront size={18} className="text-yellow-600" />}
              label="Auto coinvolte"
              value={String(distinctCars)}
            />
            <SummaryCard
              icon={<FileText size={18} className="text-yellow-600" />}
              label="Con note"
              value={String(maintenancesWithNotes)}
            />
            <SummaryCard
              icon={<CalendarClock size={18} className="text-yellow-600" />}
              label="Ultima registrazione"
              value={maintenances[0]?.date ? formatDate(maintenances[0].date) : "—"}
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="card-base p-10 text-center text-neutral-500">Caricamento...</div>
      ) : maintenances.length === 0 ? (
        <div className="card-base p-10 text-center text-neutral-500">
          Nessuna manutenzione registrata.
        </div>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {maintenances.map((m) => (
            <article
              key={m.id}
              className="card-base overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="bg-black text-yellow-500 px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CarFront size={18} />
                    <h2 className="text-lg font-bold truncate">
                      {normalizeRelation(m.car_id)?.name || "Auto sconosciuta"}
                    </h2>
                  </div>

                  <div className="mt-1 text-sm text-yellow-100/80 truncate">
                    {normalizeRelation(m.component_id)?.identifier || "Componente non specificato"}
                  </div>
                </div>

                <button
                  onClick={() => openForEdit(m)}
                  className="btn-primary !px-3 !py-2 !rounded-lg"
                >
                  <Edit size={16} /> Modifica
                </button>
              </div>

              <div className="p-4 md:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MiniInfoCard label="Data" value={formatDate(m.date)} />
                  <MiniInfoCard label="Tipo" value={m.type || "—"} />
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-xs text-neutral-500">Note</div>
                  <div className="mt-2 text-sm text-neutral-800 leading-relaxed whitespace-pre-line">
                    {m.notes?.trim() ? m.notes : "Nessuna nota inserita"}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {openModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40"
            onClick={() => !saving && closeModal()}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-black text-yellow-400">
                <h3 className="text-xl font-bold">
                  {editId ? "Modifica manutenzione" : "Aggiungi manutenzione"}
                </h3>
                <button
                  onClick={() => !saving && closeModal()}
                  className="rounded-lg px-3 py-1 text-yellow-300 hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">
                    Auto
                  </label>
                  <select
                    className="border rounded-xl p-3 w-full bg-white"
                    value={carId}
                    onChange={(e) => setCarId(e.target.value)}
                  >
                    <option value="">-- Seleziona auto --</option>
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">
                    Componente
                  </label>
                  <select
                    className="border rounded-xl p-3 w-full bg-white"
                    value={componentId}
                    onChange={(e) => setComponentId(e.target.value)}
                  >
                    <option value="">-- Seleziona componente --</option>
                    {components.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.identifier}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedComponent && (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                    <div>
                      <span className="font-semibold">Ore attuali:</span>{" "}
                      {formatHours(selectedComponent.hours)}
                    </div>
                    <div className="mt-1">
                      <span className="font-semibold">Ore vita:</span>{" "}
                      {formatHours(selectedComponent.life_hours)}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    className="border rounded-xl p-3 w-full"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">
                    Tipo intervento
                  </label>
                  <input
                    className="border rounded-xl p-3 w-full"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="Es. Controllo, revisione, sostituzione..."
                  />
                </div>

                {isRevision && (
                  <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-yellow-900 font-semibold">
                      <RotateCcw size={16} />
                      Opzioni revisione
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-1">
                        Descrizione revisione
                      </label>
                      <input
                        className="border rounded-xl p-3 w-full bg-white"
                        value={revisionDescription}
                        onChange={(e) => setRevisionDescription(e.target.value)}
                        placeholder="Es. Revisione completa cambio"
                      />
                    </div>

                    <label className="flex items-start gap-3 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={registerRevisionHistory}
                        onChange={(e) => setRegisterRevisionHistory(e.target.checked)}
                        disabled={Boolean(editId)}
                      />
                      <span>
                        Registra anche nello storico revisioni del componente
                        {editId && (
                          <span className="block text-xs text-neutral-500 mt-1">
                            Disponibile solo in creazione per evitare duplicazioni nello storico.
                          </span>
                        )}
                      </span>
                    </label>

                    <label className="flex items-start gap-3 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={resetHoursAfterRevision}
                        onChange={(e) => setResetHoursAfterRevision(e.target.checked)}
                        disabled={!registerRevisionHistory || Boolean(editId)}
                      />
                      <span>
                        Reset ore componente dopo revisione
                        <span className="block text-xs text-neutral-500 mt-1">
                          Se attivo, le ore del componente verranno impostate a 0.
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">
                    Note
                  </label>
                  <textarea
                    className="border rounded-xl p-3 w-full min-h-[120px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Dettagli sull’intervento..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-white">
                <button onClick={closeModal} disabled={saving} className="btn-secondary">
                  Annulla
                </button>
                <button onClick={saveMaintenance} disabled={saving} className="btn-primary">
                  {saving ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-lg font-semibold ${
            toast.type === "success"
              ? "bg-yellow-400 text-black"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}