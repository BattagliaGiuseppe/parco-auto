"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);

  // Stato dei componenti da compilare
  const [components, setComponents] = useState([
    { type: "motore", identifier: "", expiry_date: null },
    { type: "cambio", identifier: "", expiry_date: null },
    { type: "differenziale", identifier: "", expiry_date: null },
    { type: "cinture", identifier: "", expiry_date: "", withExpiry: true },
    { type: "cavi", identifier: "", expiry_date: "", withExpiry: true },
    { type: "estintore", identifier: "", expiry_date: "", withExpiry: true },
    { type: "serbatoio", identifier: "", expiry_date: "", withExpiry: true },
    { type: "passaporto", identifier: "", expiry_date: "", withExpiry: true },
  ]);

  // Fetch auto
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

  // Add Car
  const addCar = async (e: React.FormEvent) => {
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

    // 2️⃣ Inserisci i componenti con i dati inseriti
    const compsToInsert = components.map((c) => ({
      type: c.type,
      identifier: c.identifier || `${name} - ${c.type}`,
      expiry_date: c.withExpiry ? c.expiry_date : null,
      car_id: newCar.id,
    }));

    await supabase.from("components").insert(compsToInsert);

    // Reset
    setName("");
    setChassis("");
    setComponents(
      components.map((c) => ({
        ...c,
        identifier: "",
        expiry_date: c.withExpiry ? "" : null,
      }))
    );

    setLoading(false);
    fetchCars();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🚗 Aggiungi Auto</h1>

      {/* Form nuova auto */}
      <form onSubmit={addCar} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Form componenti */}
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold">Componenti</h2>
          {components.map((comp, index) => (
            <div key={comp.type} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <label className="font-medium capitalize">{comp.type}</label>
              <input
                type="text"
                placeholder="Numero identificativo"
                className="border p-2 rounded"
                value={comp.identifier}
                onChange={(e) => {
                  const updated = [...components];
                  updated[index].identifier = e.target.value;
                  setComponents(updated);
                }}
              />
              {comp.withExpiry && (
                <input
                  type="date"
                  className="border p-2 rounded"
                  value={comp.expiry_date || ""}
                  onChange={(e) => {
                    const updated = [...components];
                    updated[index].expiry_date = e.target.value;
                    setComponents(updated);
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Salvataggio..." : "Aggiungi Auto con Componenti"}
        </button>
      </form>

      {/* Lista auto */}
      <div className="mt-10 space-y-6">
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
