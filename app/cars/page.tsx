"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Info, List, Grid } from "lucide-react";
import { Russo_One } from "next/font/google";

// Font racing
const russo = Russo_One({ subsets: ["latin"], weight: "400" });

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");

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

  return (
    <div className={`p-6 flex flex-col gap-8 ${russo.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">🏎️ Gestione Auto</h1>
        <button
          onClick={() =>
            setView(view === "sintetica" ? "dettagliata" : "sintetica")
          }
          className="bg-[#FFD700] hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          {view === "sintetica" ? (
            <>
              <Grid size={18} /> Vista dettagliata
            </>
          ) : (
            <>
              <List size={18} /> Vista sintetica
            </>
          )}
        </button>
      </div>

      {/* Lista Auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cars.map((car) => (
          <div
            key={car.id}
            className="bg-white shadow-lg rounded-2xl p-6 flex flex-col gap-4 border border-gray-200 hover:shadow-xl transition"
          >
            {/* Vista SINTETICA */}
            {view === "sintetica" && (
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{car.name}</h2>
                  <span className="text-sm text-gray-600">{car.chassis_number}</span>
                </div>
                <div className="flex gap-2">
                  <button className="bg-[#FFD700] hover:bg-yellow-500 text-black font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition">
                    <Edit size={16} /> Modifica
                  </button>
                  <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition">
                    <Info size={16} /> Dettagli
                  </button>
                </div>
              </div>
            )}

            {/* Vista DETTAGLIATA */}
            {view === "dettagliata" && (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">{car.name}</h2>
                  <span className="text-sm text-gray-600">{car.chassis_number}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {car.components.map((comp: any) => (
                    <div
                      key={comp.id}
                      className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg"
                    >
                      <span>
                        {comp.type} – {comp.identifier}
                      </span>
                      {comp.expiry_date && (
                        <span className="text-red-600 font-bold">
                          ⏳ {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button className="bg-[#FFD700] hover:bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition">
                    <Edit size={16} /> Modifica
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
