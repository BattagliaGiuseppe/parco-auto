"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);

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

    // 2️⃣ Componenti base
    const baseComponents = [
      { type: "motore", identifier: `${name} - Motore`, car_id: newCar.id },
      { type: "cambio", identifier: `${name} - Cambio`, car_id: newCar.id },
      { type: "differenziale", identifier: `${name} - Differenziale`, car_id: newCar.id },
    ];

    // 3️⃣ Componenti con scadenza + passaporto
    const today = new Date();
    const expiringComponents = [
      { type: "cinture", identifier: "Cinture di sicurezza", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 5)).toISOString() },
      { type: "cavi", identifier: "Cavi ritenuta ruote", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 2)).toISOString() },
      { type: "estintore", identifier: "Estintore", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 2)).toISOString() },
      { type: "serbatoio", identifier: "Serbatoio carburante", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 5)).toISOString() },
      { type: "passaporto", identifier: "Passaporto tecnico", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 10)).toISOString() },
    ];

    await supabase.from("components").insert([...baseComponents, ...expiringComponents]);

    setName("");
    setChassis("");
    setLoading(false);

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

      {/* Lista auto + componenti */}
      <div className="space-y-6">
        {cars.map((car) => (
          <div key={car.id} className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">
              {car.name} ({car.chassis_number})
            </h2>
            <ul className="ml-4 space-y-1">
              {car.components.map((comp: any) => (
                <li key={comp.id} className="flex justify-between text-sm">
                  <span>{comp.type} – {comp.identifier}</span>
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
