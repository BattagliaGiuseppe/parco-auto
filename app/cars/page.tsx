"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedCar, setExpandedCar] = useState<number | null>(null);

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

    if (!error) {
      setName("");
      setChassis("");
      fetchCars();
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6 flex items-center gap-2">
        🚗 Gestione Auto
      </h1>

      {/* Form nuova auto */}
      <form
        onSubmit={addCar}
        className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6 bg-white shadow-lg p-4 rounded-lg"
      >
        <input
          type="text"
          placeholder="Nome auto"
          className="border p-2 rounded w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Numero telaio"
          className="border p-2 rounded w-full"
          value={chassis}
          onChange={(e) => setChassis(e.target.value)}
          required
        />
        <button
          type="submit"
          className="col-span-full btn-primary"
          disabled={loading}
        >
          {loading ? "Salvataggio..." : "➕ Aggiungi Auto"}
        </button>
      </form>

      {/* Lista auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cars.map((car) => (
          <div
            key={car.id}
            className="bg-white shadow-lg p-4 rounded-lg hover:shadow-xl transition"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                {car.name} ({car.chassis_number})
              </h2>
              <button
                className="text-sm text-[var(--color-primary)] underline"
                onClick={() =>
                  setExpandedCar(expandedCar === car.id ? null : car.id)
                }
              >
                {expandedCar === car.id ? "Nascondi dettagli" : "Dettagli"}
              </button>
            </div>

            {/* Dettagli componenti */}
            {expandedCar === car.id && (
              <ul className="mt-4 space-y-2">
                {car.components.map((comp: any) => (
                  <li
                    key={comp.id}
                    className="flex justify-between text-sm border-b pb-1"
                  >
                    <span>
                      {comp.type} – {comp.identifier}
                    </span>
                    {comp.expiry_date && (
                      <span className="text-red-500">
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
