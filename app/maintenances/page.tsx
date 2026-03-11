"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Edit,
  PlusCircle,
  X,
  Wrench,
  CarFront,
  CheckCircle,
  XCircle,
  Search,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CarItem = {
  id: string;
  name: string;
};

type ComponentItem = {
  id: string;
  identifier: string;
  type: string;
};

type MaintenanceRow = {
  id: string;
  date: string;
  type: string;
  notes: string | null;
  car_id: string | null;
  component_id: string | null;
};

type MaintenanceView = MaintenanceRow & {
  carName: string;
  componentLabel: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

const MAINTENANCE_TYPES = [
  "controllo",
  "manutenzione ordinaria",
  "manutenzione straordinaria",
  "riparazione",
  "sostituzione",
  "ispezione",
] as const;

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<MaintenanceRow[]>([]);
  const [cars, setCars] = useState<CarItem[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [carId, setCarId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const resetForm = () => {
    setCarId("");
    setComponentId("");
    setDate(new Date().toISOString().split("T")[0]);
    setType("");
    setNotes("");
    setEditId(null);
  };

  const closeModal = () => {
    setOpenModal(false);
    resetForm();
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const [
        { data: maintData, error: maintError },
        { data: carsData, error: carsError },
        { data: compsData, error: compsError },
      ] = await Promise.all([
        supabase
          .from("maintenances")
          .select("id, date, type, notes, car_id, component_id")
          .order("date", { ascending: false }),
        supabase.from("cars").select("id, name").order("name", { ascending: true }),
        supabase
          .from("components")
          .select("id, identifier, type")
          .order("identifier", { ascending: true }),
      ]);

      if (maintError) throw maintError;
      if (carsError) throw carsError;
      if (compsError) throw compsError;

      setMaintenances((maintData || []) as MaintenanceRow[]);
      setCars((carsData || []) as CarItem[]);
      setComponents((compsData || []) as ComponentItem[]);
    } catch (error: any) {
      showToast(`Errore caricamento manutenzioni: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resetForm();
    fetchData();
  }, []);

  const maintenancesView = useMemo<MaintenanceView[]>(() => {
    return maintenances.map((m) => {
      const car = cars.find((c) => c.id === m.car_id);
      const component = components.find((c) => c.id === m.component_id);

      return {
        ...m,
        carName: car?.name || "—",
        componentLabel: component
          ? `${component.type} – ${component.identifier}`
          : "—",
      };
    });
  }, [maintenances, cars, components]);

  const filteredMaintenances = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return maintenancesView;

    return maintenancesView.filter((m) => {
      return (
        m.carName.toLowerCase().includes(needle) ||
        m.componentLabel.toLowerCase().includes(needle) ||
        (m.type || "").toLowerCase().includes(needle) ||
        (m.notes || "").toLowerCase().includes(needle)
      );
    });
  }, [maintenancesView, search]);

  const openCreateModal = () => {
    resetForm();
    setOpenModal(true);
  };

  const openForEdit = (m: MaintenanceRow) => {
    setEditId(m.id);
    setCarId(m.car_id || "");
    setComponentId(m.component_id || "");
    setDate(m.date || "");
    setType(m.type || "");
    setNotes(m.notes || "");
    setOpenModal(true);
  };

  const saveMaintenance = async () => {
    if (!date || !type.trim()) {
      showToast("Compila almeno data e tipo", "error");
      return;
    }

    if (!carId && !componentId) {
      showToast("Seleziona almeno un'auto o un componente", "error");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        car_id: carId || null,
        component_id: componentId || null,
        date,
        type: type.trim(),
        notes: notes.trim() || null,
      };

      if (editId) {
        const { error } = await supabase
          .from("maintenances")
          .update(payload)
          .eq("id", editId);

        if (error) throw error;
        showToast("Manutenzione aggiornata");
      } else {
        const { error } = await supabase.from("maintenances").insert([payload]);
        if (error) throw error;
        showToast("Manutenzione registrata");
      }

      closeModal();
      await fetchData();
    } catch (e: any) {
      console.error("Errore salvataggio manutenzione:", e);
      showToast(`Errore salvataggio: ${e.message || "sconosciuto"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Wrench className="text-yellow-500" size={30} />
          Manutenzioni
        </h1>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per auto, componente, tipo o note..."
              className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm pl-9 focus:ring-2 focus:ring-yellow-400"
            />
            <Search
              size={16}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>

          <button
            onClick={openCreateModal}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg flex items-center gap-2 font-semibold"
          >
            <PlusCircle size={18} /> Aggiungi manutenzione
          </button>
        </div>
      </div>

      {loading ? (
        <p>Caricamento...</p>
      ) : filteredMaintenances.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-gray-500">
          Nessuna manutenzione registrata.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaintenances.map((m) => (
            <div
              key={m.id}
              className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              <div className="bg-gray-900 text-yellow-500 px-4 py-3 flex justify-between items-start gap-3">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <CarFront size={16} />
                    {m.carName}
                  </h2>
                  <span className="text-sm opacity-80">{m.componentLabel}</span>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-2">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Data:</span>{" "}
                  {new Date(m.date).toLocaleDateString("it-IT")}
                </p>

                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Tipo:</span> {m.type}
                </p>

                {m.notes && (
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Note:</span> {m.notes}
                  </p>
                )}

                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => openForEdit(m)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-2 rounded-lg flex items-center gap-2 font-semibold"
                  >
                    <Edit size={16} /> Modifica
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => !saving && closeModal()}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {editId ? "Modifica manutenzione" : "Aggiungi manutenzione"}
                </h3>
                <button
                  onClick={() => !saving && closeModal()}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  <X />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Auto
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={carId}
                    onChange={(e) => setCarId(e.target.value)}
                  >
                    <option value="">-- Nessuna auto selezionata --</option>
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Componente
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={componentId}
                    onChange={(e) => setComponentId(e.target.value)}
                  >
                    <option value="">-- Nessun componente selezionato --</option>
                    {components.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.type} – {c.identifier}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    className="border rounded-lg p-2 w-full"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Tipo
                  </label>
                  <input
                    list="maintenance-types"
                    className="border rounded-lg p-2 w-full"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="Es. manutenzione ordinaria"
                  />
                  <datalist id="maintenance-types">
                    {MAINTENANCE_TYPES.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Note
                  </label>
                  <textarea
                    className="border rounded-lg p-2 w-full min-h-[120px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Annulla
                </button>
                <button
                  onClick={saveMaintenance}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                >
                  {saving ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 z-[999] ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
