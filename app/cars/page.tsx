"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type ComponentForm = {
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

  // Struttura componenti base + con scadenza
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

  // Quando inserisco nome + telaio → preparo i componenti
  const prepareComponents = () => {
    setComponents(
      defaultComponents.map((c) => ({
        ...c,
        identifier: c.identifier || `${name} - ${c.type}`,
      }))
    );
  };

  const addCarWithComponents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !chassis) return;

    setLoading(true);

    // 1️⃣ Inserisci auto
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

    // 2️⃣ Inserisci i componenti collegati
    const compsToInsert = components.map((c) => ({
      type: c.type,
      identifier: c.identifier,
      expiry_date: c.expiry_date || null,
      car_id: newCar.id,
    }));

    await supabase.from("components").insert(compsToInsert);

    // reset
    setName("");
    setChassis("");
    setComponents([]);
    setLoading(false);

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

        {/* Bottone per generare i componenti */}
        {components.length === 0 && (
          <button
            type="button"
            onClick={prepareComponents}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            Prosegui con i componenti
          </button>
        )}

        {/* Form componenti */}
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

      {/* Lista auto esistenti */}
      <div className="space-y-6">
        {cars.map((car) => (
          <div key={car.id} className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">
              {car.name} ({car.chassis_number})
            </h2>
            <ul className="ml-4 space-y-1">
              {car.components.map((comp: any) => (
                <li key={comp.id} className="flex justify-between text-sm">
                  <span>
                    {comp.type} – {comp.identifier}
                  </span>
                  {comp.expiry_date && (
                    <span className="text-red-500">
                      Scade: {new Date(comp.expiry_date).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
