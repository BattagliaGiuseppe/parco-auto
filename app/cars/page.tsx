"use client";

import { useEffect, useState } from "react";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import Link from "next/link";

export default function CarsPage() {
  const session = useSession(); // ✅ Recupera la sessione dal Provider
  const supabase = useSupabaseClient(); // ✅ Usa il client dal Provider

  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");

  const fetchCars = async () => {
    const { data, error } = await supabase.from("cars").select("*");
    if (!error) setCars(data || []);
  };

  const addCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !chassis) return;
    await supabase.from("cars").insert([{ name, chassis_number: chassis }]);
    setName("");
    setChassis("");
    fetchCars();
  };

  const deleteCar = async (id: string) => {
    await supabase.from("cars").delete().eq("id", id);
    fetchCars();
  };

  useEffect(() => {
    if (session) {
      fetchCars();
    }
  }, [session]);

  // 🔒 Se non c’è sessione → chiede login una sola volta
  if (!session) {
    return <p className="p-4">Devi effettuare il login per accedere a questa pagina.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🚗 Gestione Auto</h1>

      {/* Form per aggiungere auto */}
      <form
        onSubmit={addCar}
        className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6"
      >
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
        >
          Aggiungi
        </button>
      </form>

      {/* Lista auto */}
      <ul className="space-y-2">
        {cars.map((car) => (
          <li
            key={car.id}
            className="p-3 border rounded flex justify-between items-center"
          >
            <span>
              {car.name} (Telaio: {car.chassis_number})
            </span>
            <div className="flex gap-2">
              <Link
                href={`/cars/${car.id}`}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Dettagli
              </Link>
              <button
                onClick={() => deleteCar(car.id)}
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Elimina
              </button>
            </div>
          </li>
        ))}
