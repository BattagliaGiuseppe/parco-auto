"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { List, Grid } from "lucide-react"; // icone toggle
import Link from "next/link";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailedView, setDetailedView] = useState(false); // toggle vista

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
    <div className="p-6 font-[Orbitron]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          🚗 Gestione Auto
        </h1>
        <button
          onClick={() => setDetailedView(!detailedView)}
          className="bg-gray-200 hover:bg-gray-300 p-2 rounded-lg"
          title={detailedView ? "Vista sintetica" : "Vista dettagliata"}
        >
          {detailedView ? <Grid size={20} /> : <List size={20} />}
        </button>
      </div>

      {/* Form nuova auto */}
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
          className="col-span-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded"
          disabled={loading}
        >
          {loading ? "Salvataggio..." : "Aggiungi Auto"}
        </button>
      </form>

      {/* Lista auto */}
      <div className="space-y-4">
        {cars.map((car) => (
          <div
            key={car.id}
            className="bg-white shadow-lg rounded-xl p-4 flex flex-col gap-2 border border-gray-200"
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{car.name}</h2>
                <p className="text-sm text-gray-500">{car.chassis_number}</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/cars/${car.id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                >
                  Dettagli
                </Link>
                <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">
                  Modifica
                </button>
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
                      <span className="text-red-500 text-xs">
                        Scade:{" "}
                        {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
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
