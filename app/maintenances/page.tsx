"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, Edit, X } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // campi form
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [carId, setCarId] = useState("");
  const [componentId, setComponentId] = useState("");

  const [cars, setCars] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  const fetchMaintenances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("maintenances")
      .select("id, date, type, description, notes, car_id(name), component_id(identifier)")
      .order("date", { ascending: false });

    if (!error) setMaintenances(data || []);
    setLoading(false);
  };

  const fetchCarsAndComponents = async () => {
    const { data: carsData } = await supabase.from("cars").select("id, name");
    const { data: compsData } = await supabase.from("components").select("id, identifier");
    setCars(carsData || []);
    setComponents(compsData || []);
  };

  useEffect(() => {
    fetchMaintenances();
    fetchCarsAndComponents();
  }, []);

  // preload dati quando si modifica
  useEffect(() => {
    if (editing) {
      setDate(editing.date || "");
      setType(editing.type || "");
      setDescription(editing.description || "");
      setNotes(editing.notes || "");
      setCarId(editing.car_id?.id || "");          // prende id corretto
      setComponentId(editing.component_id?.id || "");
    } else {
      setDate("");
      setType("");
      setDescription("");
      setNotes("");
      setCarId("");
      setComponentId("");
    }
  }, [editing]);

  const onSaveMaintenance = async () => {
    if (!date || !description) return;
    setSaving(true);
    try {
      const payload = {
        date,
        type,
        description,
        notes,
        car_id: carId || null,
        component_id: componentId || null,
      };

      if (editing) {
        // UPDATE
        const { error } = await supabase
          .from("maintenances")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        // INSERT
        const { error } = await supabase.from("maintenances").insert([payload]);
        if (error) throw error;
      }

      setOpenModal(false);
      setEditing(null);
      fetchMaintenances();
    } catch (e) {
      console.error("Errore salvataggio manutenzione:", e);
      alert("Errore nel salvataggio. Controlla la console.");
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
          onClick={() => {
            setEditing(null);
            setOpenModal(true);
          }}
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
              <div className="bg-gray-900 text-yellow-500 px-4 py-3 flex justify-between items-center">
                <h2 className="text-lg font-bold">{m.car_id?.name || "—"}</h2>
                <span className="text-sm opacity-80">{m.component_id?.identifier || "—"}</span>
              </div>

              <div className="p-4 flex flex-col gap-3">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Tipo:</span> {m.type || "—"}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Descrizione:</span> {m.description}
                </p>
                {m.notes && (
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold">Note:</span> {m.notes}
                  </p>
                )}
                <p className="text-xs text-gray-600">
                  📅 {new Date(m.date).toLocaleDateString("it-IT")}
                </p>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setEditing(m);
                      setOpenModal(true);
                    }}
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

      {/* MODAL add/edit */}
      {openModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => !saving && setOpenModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {editing ? "Modifica manutenzione" : "Aggiungi manutenzione"}
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
                <label className="text-sm font-semibold">Auto</label>
                <select
                  className="border rounded-lg p-2"
                  value={carId}
                  onChange={(e) => setCarId(e.target.value)}
                >
                  <option value="">—</option>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Componente */}
                <label className="text-sm font-semibold">Componente</label>
                <select
                  className="border rounded-lg p-2"
                  value={componentId}
                  onChange={(e) => setComponentId(e.target.value)}
                >
                  <option value="">—</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.identifier}
                    </option>
                  ))}
                </select>

                <label className="text-sm font-semibold">Data</label>
                <input
                  type="date"
                  className="border rounded-lg p-2"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />

                <label className="text-sm font-semibold">Tipo</label>
                <input
                  type="text"
                  className="border rounded-lg p-2"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                />

                <label className="text-sm font-semibold">Descrizione</label>
                <textarea
                  className="border rounded-lg p-2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <label className="text-sm font-semibold">Note</label>
                <textarea
                  className="border rounded-lg p-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
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
                  onClick={onSaveMaintenance}
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
