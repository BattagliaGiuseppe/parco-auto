"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);

  // 📌 Fetch auto + componenti attivi
  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("id, name, chassis_number, components(id, type, identifier, expiry_date, is_active)")
      .order("id", { ascending: true });

    if (error) {
      console.error("❌ Errore fetch cars:", error.message);
    } else {
      setCars(data || []);
    }
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const addCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !chassis) return;

    setLoading(true);

    // 1️⃣ Inserisci auto
    const { data: newCar, error: carError } = await supabase
      .from("cars")
      .insert([{ name, chassis_number: chassis }])
      .select()
      .single();

    if (carError) {
      console.error("❌ Errore inserimento auto:", carError.message);
      setLoading(false);
      return;
    }

    // 2️⃣ Componenti base
    const baseComponents = [
      { type: "motore", identifier: `${name} - Motore`, car_id: newCar.id, is_active: true },
      { type: "cambio", identifier: `${name} - Cambio`, car_id: newCar.id, is_active: true },
      { type: "differenziale", identifier: `${name} - Differenziale`, car_id: newCar.id, is_active: true },
    ];

    // 3️⃣ Componenti con scadenza + passaporto
    const now = new Date();
    const expiringComponents = [
      { type: "cinture", identifier: "Cinture di sicurezza", car_id: newCar.id, expiry_date: new Date(now.getFullYear() + 5, now.getMonth(), now.getDate()).toISOString(), is_active: true },
      { type: "cavi", identifier: "Cavi ritenuta ruote", car_id: newCar.id, expiry_date: new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()).toISOString(), is_active: true },
      { type: "estintore", identifier: "Estintore", car_id: newCar.id, expiry_date: new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()).toISOString(), is_active: true },
      { type: "serbatoio", identifier: "Serbatoio carburante", car_id: newCar.id, expiry_date: new Date(now.getFullYear() + 5, now.getMonth(), now.getDate()).toISOString(), is_active: true },
      { type: "passaporto", identifier: "Passaporto tecnico", car_id: newCar.id, expiry_date: new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()).toISOString(), is_active: true },
    ];

    const { error: compError } = await supabase
      .from("components")
      .insert([...baseComponents, ...expiringComponents]);

    if (compError) {
      console.error("❌ Errore inserimento componenti:", compError.message);
    }

    setName("");
    setChassis("");
    setLoading(false);

    fetchCars();
  };

  const deactivateComponent = async (id: string) => {
    const { error } = await supabase.from("components").update({ is_active: false }).eq("id", id);
    if (error) {
      console.error("❌ Errore disattivazione:", error.message);
    } else {
      fetchCars();
    }
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
              {car.components
                .filter((comp: any) => comp.is_active) // 🔥 mostra solo attivi
                .map((comp: any) => (
                  <li key={comp.id} className="flex justify-between text-sm">
                    <span>
                      {comp.type} – {comp.identifier}
                      {comp.expiry_date && (
                        <span className="ml-2 text-red-500">
                          Scade: {new Date(comp.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => deactivateComponent(comp.id)}
                      className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                    >
                      Disattiva
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
