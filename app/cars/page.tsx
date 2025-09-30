"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type ComponentForm = {
  id?: number;
  type: string;
  identifier: string;
  expiry_date?: string;
};

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [components, setComponents] = useState<ComponentForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingComp, setEditingComp] = useState<ComponentForm | null>(null);

  const defaultComponents: ComponentForm[] = [
    { type: "motore", identifier: "" },
    { type: "cambio", identifier: "" },
    { type: "differenziale", identifier: "" },
    { type: "cinture", identifier: "", expiry_date: "" },
    { type: "cavi", identifier: "", expiry_date: "" },
    { type: "estintore", identifier: "", expiry_date: "" },
    { type: "serbatoio", identifier: "", expiry_date: "" },
    { type: "passaporto", identifier: "", expiry_date: "" },
  ];

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("id, name, chassis_number, components(id, type, identifier, expiry_date)")
      .order("id", { ascending: true });

    if (!error) setCars(data || []);
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const prepareComponents = () => {
    setComponents(
      defaultComponents.map((c) => ({
        ...c,
        identifier: `${name} - ${c.type}`,
      }))
    );
  };

  const addCarWithComponents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !chassis || components.length === 0) return;

    setLoading(true);

    const { data: newCar, error } = await supabase
      .from("cars")
      .insert([{ name, chassis_number: chassis }])
      .select()
      .single();

    if (error) {
      console.error("Errore inserimento auto:", error.message);
      setLoading(false);
      return;
    }

    const compsToInsert = components.map((c) => ({
      type: c.type,
      identifier: c.identifier,
      expiry_date: c.expiry_date || null,
      car_id: newCar.id,
    }));

    await supabase.from("components").insert(compsToInsert);

    setName("");
    setChassis("");
    setComponents([]);
    setLoading(false);

    fetchCars();
  };

  const saveComponentEdit = async () => {
    if (!editingComp) return;

    await supabase
      .from("components")
      .update({
        identifier: editingComp.identifier,
        expiry_date: editingComp.expiry_date || null,
      })
      .eq("id", editingComp.id);

    setEditingComp(null);
    fetchCars();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🚗 Gestione Auto</h1>

      {/* Form nuova auto */}
      <form onSubmit={addCarWithComponents} className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Nome auto"
            className="border p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Numero telaio"
            className="border p-2 rounded"
            value={chassis}
            onChange={(e) => setChassis(e.target.value)}
            required
          />
        </div>

        {components.length === 0 && (
          <button
            type="button"
            onClick={prepareComponents}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            Prosegui con i componenti
          </button>
        )}

        {components.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Componenti</h2>
            {components.map((comp, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center"
              >
                <input
                  type="text"
                  className="border p-2 rounded col-span-1"
                  value={comp.type}
                  disabled
                />
                <input
                  type="text"
                  placeholder="Identificativo"
                  className="border p-2 rounded col-span-1"
                  value={comp.identifier}
                  onChange={(e) => {
                    const newComps = [...components];
                    newComps[idx].identifier = e.target.value;
                    setComponents(newComps);
                  }}
                />
                {"expiry_date" in comp && (
                  <input
                    type="date"
                    className="border p-2 rounded col-span-1"
                    value={comp.expiry_date || ""}
                    onChange={(e) => {
                      const newComps = [...components];
                      newComps[idx].expiry_date = e.target.value;
                      setComponents(newComps);
                    }}
                  />
                )}
              </div>
            ))}

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? "Salvataggio..." : "Aggiungi Auto con Componenti"}
            </button>
          </div>
        )}
      </form>

      {/* Lista auto */}
      <div className="space-y-6">
        {cars.map((car) => (
          <div key={car.id} className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">
              {car.name} ({car.chassis_number})
            </h2>
            <ul className="ml-4 space-y-1">
              {car.components.map((comp: any) => (
                <li key={comp.id} className="flex justify-between items-center text-sm">
                  <span>
                    {comp.type} – {comp.identifier}{" "}
                    {comp.expiry_date && (
                      <span className="text-red-500">
                        (Scade: {new Date(comp.expiry_date).toLocaleDateString()})
                      </span>
                    )}
                  </span>
                  <button
                    className="text-blue-600 text-xs underline"
                    onClick={() => setEditingComp(comp)}
                  >
                    ✏️ Modifica
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Modale modifica componente */}
      {editingComp && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 space-y-4">
            <h2 className="text-lg font-bold">Modifica {editingComp.type}</h2>
            <input
              type="text"
              className="border p-2 rounded w-full"
              value={editingComp.identifier}
              onChange={(e) =>
                setEditingComp({ ...editingComp, identifier: e.target.value })
              }
            />
            {editingComp.expiry_date !== undefined && (
              <input
                type="date"
                className="border p-2 rounded w-full"
                value={editingComp.expiry_date || ""}
                onChange={(e) =>
                  setEditingComp({ ...editingComp, expiry_date: e.target.value })
                }
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded"
                onClick={() => setEditingComp(null)}
              >
                Annulla
              </button>
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded"
                onClick={saveComponentEdit}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
