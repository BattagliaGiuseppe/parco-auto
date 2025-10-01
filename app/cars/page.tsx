"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);

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

    const { data: newCar, error } = await supabase
      .from("cars")
      .insert([{ name, chassis_number: chassis }])
      .select()
      .single();

    if (!error && newCar) {
      setCars([...cars, newCar]);
      setName("");
      setChassis("");
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <img src="/auto.png" alt="Auto" className="w-8 h-8" />
        Gestione Auto
      </h1>

      {/* Form nuova auto */}
      <form onSubmit={addCar} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
        <input
          type="text"
          placeholder="Nome auto"
          className="border-2 border-gray-300 focus:border-gold focus:ring focus:ring-gold-light rounded p-2 w-full transition"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Numero telaio"
          className="border-2 border-gray-300 focus:border-gold focus:ring focus:ring-gold-light rounded p-2 w-full transition"
          value={chassis}
          onChange={(e) => setChassis(e.target.value)}
          required
        />
        <button
          type="submit"
          className="col-span-full bg-gold hover:bg-gold-dark text-black font-semibold py-2 rounded transition shadow-md"
          disabled={loading}
        >
          {loading ? "Salvataggio..." : "Aggiungi Auto"}
        </button>
      </form>

      {/* Lista auto */}
      <div className="space-y-6">
        {cars.map((car) => (
          <div key={car.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-gold">
            <h2 className="text-lg font-semibold mb-2">
              {car.name} ({car.chassis_number})
            </h2>
            <ul className="ml-4 space-y-1">
              {car.components?.map((comp: any) => (
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
