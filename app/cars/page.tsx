"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");

  const fetchCars = async () => {
    const { data, error } = await supabase.from("cars").select("*").order("created_at", { ascending: false });
    if (!error) setCars(data || []);
  };

  const addCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await supabase.from("cars").insert([{ name }]);
    setName("");
    fetchCars();
  };

  const deleteCar = async (id: string) => {
    await supabase.from("cars").delete().eq("id", id);
    fetchCars();
  };

  useEffect(() => {
    fetchCars();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🚗 Auto</h1>
      <form onSubmit={addCar} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nome auto"
          className="border p-2 rounded flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Aggiungi</button>
      </form>

      <ul className="space-y-2">
        {cars.map((car) => (
          <li key={car.id} className="flex justify-between items-center border p-2 rounded">
            {car.name}
            <button onClick={() => deleteCar(car.id)} className="bg-red-500 text-white px-3 py-1 rounded">
              Elimina
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
