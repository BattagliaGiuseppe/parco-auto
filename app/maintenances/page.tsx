"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, PlusCircle, X } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // campi form
  const [carId, setCarId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [notes, setNotes] = useState("");

  const [cars, setCars] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  const fetchMaintenances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("maintenances")
      .select("id, date, type, notes, car_id (id, name), component_id (id, identifier)")
      .order("date", { ascending: false });

    if (!error) setMaintenances(data || []);
    setLoading(false);
  };

  const fetchCarsAndComponents = async () => {
    const { data: carsData } = await supabase.from("cars").select("id, name");
    const { data: compsData } = await supabase
      .from("components")
      .select("id, identifier");
    setCars(carsData || []);
    setComponents(compsData || []);
  };

  useEffect(() => {
    fetchMaintenances();
    fetchCarsAndComponents();
  }, []);

  const resetForm = () => {
    setCarId("");
    setComponentId("");
    setDate("");
    setType("");
    setNotes("");
    setEditId(null);
  };

  const openForEdit = (m: any) => {
    setEditId(m.id);
    setCarId(m.car_id?.id || "");
    setComponentId(m.component_id?.id || "");
    setDate(m.date || "");
    setType(m.type || "");
    setNotes(m.notes || "");
    setOpenModal(true);
  };

  const saveMaintenance = async () => {
    if (!carId || !componentId || !date || !type) {
      alert("Compila tutti i campi obbligatori");
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
      } else {
        const { error } = await supabase.from("maintenances").insert([
          {
            car_id: carId,
            component_id: componentId,
            date,
            type,
            notes,
          },
        ]);
        if (error) throw error;
      }

      setOpenModal(false);
      resetForm();
      fetchMaintenances();
    } catch (e) {
      console.error("Errore salvataggio manutenzione:", e);
      alert("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">🛠️ Manutenzioni</h1>
        <button
          onClick={() => setOpenModal(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <PlusCircle size={18} /> Aggiungi manutenzione
        </button>
      </div>

      {/* Lista manutenzioni */}
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {maintenances.map((m) => (
            <div
              key={m.id}
              className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              {/* Header card (stile Auto) */}
              <div className="bg-gray-900 text-yellow-500 px-4 py-3 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">
                    {m.car_id?.name || "Auto sconosciuta"}
                  </h2>
                  <span className="text-sm opacity-80">
                    {m.component_id?.identifier || "—"}
                  </span>
                </div>
              </div>

              {/* Corpo card */}
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
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Edit size={16} /> Modifica
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal manutenzione */}
      {openModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => !saving && setOpenModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {editId ? "Modifica manutenzione" : "Aggiungi manutenzione"}
                </h3>
                <button
                  onClick={() => !saving && setOpenModal(false)}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  <X />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                {/* Auto */}
                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Auto
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
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

                {/* Componente */}
                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Componente
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
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

                {/* Data */}
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

                {/* Tipo */}
                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Tipo
                  </label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-semibold text-yellow-600 mb-1">
                    Note
                  </label>
                  <textarea
                    className="border rounded-lg p-2 w-full"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => setOpenModal(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Annulla
                </button>
                <button
                  onClick={saveMaintenance}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  {saving ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
