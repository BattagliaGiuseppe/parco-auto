"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("id, name, chassis_number, components(id, type, identifier, expiry_date, is_active)")
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

    setName("");
    setChassis("");
    setLoading(false);
    fetchCars();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <img src="/mia-auto.jpg" alt="Logo Auto" className="w-8 h-8" />
        🚗 Gestione Auto
      </h1>

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
        <button
          type="submit"
          className="col-span-full bg-[#FFD700] text-black font-semibold py-2 rounded hover:bg-[#e6c200] transition"
          disabled={loading}
        >
          {loading ? "Salvataggio..." : "Aggiungi Auto"}
        </button>
      </form>

      {/* Lista auto */}
      <div className="space-y-4">
        {cars.map((car) => (
          <div key={car.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">{car.name} ({car.chassis_number})</h2>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/cars/${car.id}`}
                className="bg-[#FFD700] text-black font-semibold px-3 py-1 rounded hover:bg-[#e6c200] transition"
              >
                Dettagli
              </Link>
              <button
                className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition"
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
