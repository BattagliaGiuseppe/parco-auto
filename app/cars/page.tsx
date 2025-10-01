"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit, Trash2, Info } from "lucide-react";

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
      console.error("❌ Errore inserimento auto:", error.message);
      setLoading(false);
      return;
    }

    setName("");
    setChassis("");
    setLoading(false);
    fetchCars();
  };

  return (
    <div className="p-6 flex flex-col gap-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">🚗 Gestione Auto</h1>
        <form onSubmit={addCar} className="flex gap-3">
          <input
            type="text"
            placeholder="Nome auto"
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-yellow-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Numero telaio"
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-yellow-500"
            value={chassis}
            onChange={(e) => setChassis(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            disabled={loading}
          >
            <Plus size={18} /> {loading ? "Salvataggio..." : "Aggiungi"}
          </button>
        </form>
      </div>

      {/* Lista Auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cars.map((car) => (
          <div
            key={car.id}
            className="bg-white shadow-lg rounded-2xl p-6 flex flex-col gap-4 border border-gray-200 hover:shadow-xl transition"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                {car.name}
              </h2>
              <span className="text-sm text-gray-500">
                Telaio: {car.chassis_number}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {car.components.slice(0, 3).map((comp: any) => (
                <div
                  key={comp.id}
                  className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg"
                >
                  <span>
                    {comp.type} – {comp.identifier}
                  </span>
                  {comp.expiry_date && (
                    <span className="text-red-500 font-medium">
                      {new Date(comp.expiry_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
              {car.components.length > 3 && (
                <button className="text-yellow-600 text-sm mt-2 flex items-center gap-1 hover:underline">
                  <Info size={14} /> Vedi tutti i componenti
                </button>
              )}
            </div>

            {/* Azioni */}
            <div className="flex gap-3 mt-3">
              <button className="flex-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-lg flex items-center justify-center gap-2">
                <Edit size={16} /> Modifica
              </button>
              <button className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg flex items-center justify-center gap-2">
                <Trash2 size={16} /> Elimina
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
