"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { List, Grid } from "lucide-react";
import Link from "next/link";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailedView, setDetailedView] = useState(false);

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

    const { error } = await supabase
      .from("cars")
      .insert([{ name, chassis_number: chassis }]);

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
    <div className="p-6 font-[Orbitron] bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          🚗 Gestione Auto
        </h1>
        <button
          onClick={() => setDetailedView(!detailedView)}
          className="bg-gray-800 hover:bg-gray-700 text-[#FFD700] px-3 py-2 rounded-lg flex items-center gap-2"
        >
          {detailedView ? <Grid size={18} /> : <List size={18} />}
          {detailedView ? "Vista sintetica" : "Vista dettagliata"}
        </button>
      </div>

      {/* Form nuova auto */}
      <form
        onSubmit={addCar}
        className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6 bg-white shadow-lg p-4 rounded-xl"
      >
        <input
          type="text"
          placeholder="Nome auto"
          className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Numero telaio"
          className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
          value={chassis}
          onChange={(e) => setChassis(e.target.value)}
          required
        />
        <button
          type="submit"
          className="col-span-full bg-[#FFD700] hover:bg-yellow-500 text-black py-2 rounded font-bold transition"
          disabled={loading}
        >
          {loading ? "Salvataggio..." : "➕ Aggiungi Auto"}
        </button>
      </form>

      {/* Lista auto */}
      <div className="space-y-4">
        {cars.map((car) => (
          <div
            key={car.id}
            className="bg-white shadow-xl rounded-xl p-4 flex flex-col gap-2 border border-gray-200"
          >
            {/* Header card auto */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{car.name}</h2>
                <p className="text-sm text-gray-600">{car.chassis_number}</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-[#FFD700] hover:bg-yellow-500 text-black px-3 py-1 rounded font-semibold">
                  Modifica
                </button>
                <Link
                  href={`/cars/${car.id}`}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded font-semibold"
                >
                  Dettagli
                </Link>
              </div>
            </div>

            {/* Vista dettagliata */}
            {detailedView && (
              <ul className="mt-3 space-y-1 text-sm">
                {car.components?.map((comp: any) => (
                  <li
                    key={comp.id}
                    className="flex justify-between items-center border-b py-1"
                  >
                    <span>
                      {comp.type} – {comp.identifier}
                    </span>
                    {comp.expiry_date && (
                      <span className="text-red-600 font-semibold">
                        ⏳ {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
