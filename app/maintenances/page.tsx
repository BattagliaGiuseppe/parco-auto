"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, Edit, X } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // modal
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // form fields
  const [carId, setCarId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const fetchMaintenances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("maintenances")
      .select("id, type, date, notes, car_id(name), component_id(identifier, type)")
      .order("date", { ascending: false });

    if (!error) setMaintenances(data || []);
    setLoading(false);
  };

  const fetchCars = async () => {
    const { data } = await supabase.from("cars").select("id, name");
    setCars(data || []);
  };

  const fetchComponents = async () => {
    const { data } = await supabase.from("components").select("id, type, identifier, car_id");
    setComponents(data || []);
  };

  useEffect(() => {
    fetchMaintenances();
    fetchCars();
    fetchComponents();
  }, []);

  const onSave = async () => {
    if (!carId || !componentId || !type || !date) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("maintenances").insert([
        {
          car_id: carId,
          component_id: componentId,
          type,
          date,
          notes,
        },
      ]);
      if (error) throw error;

      // reset
      setOpenAdd(false);
      setCarId("");
      setComponentId("");
      setType("");
      setDate("");
      setNotes("");

      fetchMaintenances();
    } catch (e) {
      console.error("Errore salvataggio manutenzione:", e);
      alert("Errore durante il salvataggio!");
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
          onClick={() => setOpenAdd(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <PlusCircle size={18} /> Aggiungi manutenzione
        </button>
      </div>

      {/* Lista manutenzioni */}
      {loading ? (
        <p>Caricamento...</p>
      ) : maintenances.length === 0 ? (
        <p className="text-gray-500">Nessuna manutenzione registrata.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {maintenances.map((m) => (
            <div
              key={m.id}
              className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              {/* Header */}
              <div className="bg-gray-900 text-yellow-500 px-4 py-3">
                <h2 className="text-lg font-bold">{m.type}</h2>
                <span className="text-sm opacity-80">
                  {new Date(m.date).toLocaleDateString("it-IT")}
                </span>
              </div>

              {/* Corpo */}
              <div className="p-4 flex flex-col gap-2 text-sm text-gray-700">
                <p>
                  <span className="font-semibold">Auto:</span>{" "}
                  {m.car_id?.name || "—"}
                </p>
                <p>
                  <span className="font-semibold">Componente:</span>{" "}
                  {m.component_id?.identifier} ({m.component_id?.type})
                </p>
                {m.notes && (
                  <p>
                    <span className="font-semibold">Note:</span> {m.notes}
                  </p>
                )}
                <div className="flex justify-end">
                  <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg flex items-center gap-2">
                    <Edit size={16} /> Modifica
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL aggiungi manutenzione */}
      {openAdd && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => !saving && setOpenAdd(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h3 className="text-xl font-bold">Aggiungi manutenzione</h3>
                <button onClick={() => !saving && setOpenAdd(false)}>
                  <X />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold">Auto</label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={carId}
                    onChange={(e) => setCarId(e.target.value)}
                  >
                    <option value="">Seleziona auto</option>
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold">
                    Componente
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={componentId}
                    onChange={(e) => setComponentId(e.target.value)}
                  >
                    <option value="">Seleziona componente</option>
                    {components
                      .filter((c) => c.car_id === carId)
                      .map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.identifier} ({comp.type})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold">Tipo</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="Es. Revisione motore"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold">Data</label>
                  <input
                    type="date"
                    className="border rounded-lg p-2 w-full"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold">Note</label>
                  <textarea
                    className="border rounded-lg p-2 w-full"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => setOpenAdd(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  Annulla
                </button>
                <button
                  onClick={onSave}
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
