"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [tempComponents, setTempComponents] = useState<any[]>([]);

  // 📌 componenti base per il form
  const defaultComponents = [
    { type: "motore", identifier: "", expiry_date: "" },
    { type: "cambio", identifier: "", expiry_date: "" },
    { type: "differenziale", identifier: "", expiry_date: "" },
    { type: "cinture", identifier: "", expiry_date: "" },
    { type: "cavi", identifier: "", expiry_date: "" },
    { type: "estintore", identifier: "", expiry_date: "" },
    { type: "serbatoio", identifier: "", expiry_date: "" },
    { type: "passaporto", identifier: "", expiry_date: "" },
  ];

  // 📌 Fetch auto + componenti
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

  // 📌 Aggiungi auto
  const addCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !chassis) return;

    setLoading(true);

    const { data: newCar, error } = await supabase
      .from("cars")
      .insert([{ name, chassis_number: chassis }])
      .select()
      .single();

    if (error) {
      console.error("❌ Errore inserimento auto:", error.message);
      setLoading(false);
      return;
    }

    setSelectedCar(newCar);
    setTempComponents(defaultComponents); // prepara il form componenti
    setName("");
    setChassis("");
    setLoading(false);

    fetchCars();
  };

  // 📌 aggiorna valori dei campi componenti
  const updateTempComponent = (index: number, field: string, value: string) => {
    const updated = [...tempComponents];
    updated[index][field] = value;
    setTempComponents(updated);
  };

  // 📌 salva componenti nel DB
  const saveComponents = async () => {
    if (!selectedCar) return;

    const compsToInsert = tempComponents.map((c) => ({
      type: c.type,
      identifier: c.identifier,
      expiry_date: c.expiry_date ? new Date(c.expiry_date).toISOString() : null,
      car_id: selectedCar.id,
    }));

    const { error } = await supabase.from("components").insert(compsToInsert);

    if (error) {
      console.error("❌ Errore inserimento componenti:", error.message);
      return;
    }

    setSelectedCar(null); // chiude form
    setTempComponents([]);
    fetchCars();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🚗 Gestione Auto</h1>

      {/* Form nuova auto */}
      <form onSubmit={addCar} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
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
        <button type="submit" className="col-span-full bg-blue-600 text-white py-2 rounded" disabled={loading}>
          {loading ? "Salvataggio..." : "Aggiungi Auto"}
        </button>
      </form>

      {/* Form componenti auto appena creata */}
      {selectedCar && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-2">
            Aggiungi componenti per {selectedCar.name}
          </h2>
          {tempComponents.map((comp, index) => (
            <div key={index} className="flex gap-2 mb-2 items-center">
              <span className="w-32 capitalize">{comp.type}</span>
              <input
                type="text"
                placeholder="Identificativo"
                value={comp.identifier}
                onChange={(e) => updateTempComponent(index, "identifier", e.target.value)}
                className="border p-1 rounded flex-1"
              />
              <input
                type="date"
                value={comp.expiry_date || ""}
                onChange={(e) => updateTempComponent(index, "expiry_date", e.target.value)}
                className="border p-1 rounded"
              />
            </div>
          ))}
          <button
            onClick={saveComponents}
            className="bg-green-600 text-white px-4 py-2 rounded mt-2"
          >
            Salva componenti
          </button>
        </div>
      )}

      {/* Lista auto già inserite */}
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
