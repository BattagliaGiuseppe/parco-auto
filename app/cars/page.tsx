"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CarsPage() {
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);

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

    // 2️⃣ Componenti tecnici principali
    const baseComponents = [
      { type: "motore", identifier: `${name} - Motore`, car_id: newCar.id },
      { type: "cambio", identifier: `${name} - Cambio`, car_id: newCar.id },
      { type: "differenziale", identifier: `${name} - Differenziale`, car_id: newCar.id },
    ];

    // 3️⃣ Componenti con scadenza (aggiungi tu le date reali)
    const today = new Date();
    const expiringComponents = [
      { type: "cinture", identifier: "Cinture di sicurezza", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 5)).toISOString() },
      { type: "cavi", identifier: "Cavi ritenuta ruote", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 2)).toISOString() },
      { type: "estintore", identifier: "Estintore", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 2)).toISOString() },
      { type: "serbatoio", identifier: "Serbatoio carburante", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 5)).toISOString() },
      { type: "passaporto", identifier: "Passaporto tecnico", car_id: newCar.id, expiry_date: new Date(today.setFullYear(today.getFullYear() + 10)).toISOString() },
    ];

    // 4️⃣ Inserisci tutti i componenti
    const { error: compError } = await supabase
      .from("components")
      .insert([...baseComponents, ...expiringComponents]);

    if (compError) {
      console.error("Errore inserimento componenti:", compError.message);
    } else {
      console.log("✅ Auto e componenti inseriti correttamente");
      setName("");
      setChassis("");
    }

    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🚗 Aggiungi nuova Auto</h1>

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
        <button
          type="submit"
          className="col-span-full bg-blue-600 text-white py-2 rounded"
          disabled={loading}
        >
          {loading ? "Salvataggio..." : "Aggiungi Auto"}
        </button>
      </form>
    </div>
  );
}
