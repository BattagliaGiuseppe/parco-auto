"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Info, Wrench, List, Grid } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");

  const fetchMaintenances = async () => {
    const { data, error } = await supabase
      .from("maintenances")
      .select("id, description, status, date, car_id, cars(name)")
      .order("date", { ascending: false });

    if (!error) setMaintenances(data || []);
  };

  useEffect(() => {
    fetchMaintenances();
  }, []);

  const statusColors: Record<string, string> = {
    completata: "bg-green-100 text-green-800",
    urgente: "bg-red-100 text-red-800",
    pianificata: "bg-yellow-100 text-yellow-800",
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">🛠️ Manutenzioni</h1>
        <button
          onClick={() =>
            setView(view === "sintetica" ? "dettagliata" : "sintetica")
          }
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
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

      {/* Lista Manutenzioni */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {maintenances.map((m) => (
          <div
            key={m.id}
            className="bg-white shadow-lg rounded-2xl p-6 flex flex-col gap-4 border border-gray-200 hover:shadow-xl transition"
          >
            {view === "sintetica" && (
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {m.description}
                  </h2>
                  <span className="text-sm text-gray-500">
                    {new Date(m.date).toLocaleDateString()}
                  </span>
                  {m.cars && (
                    <p className="text-xs text-gray-400">
                      Auto: {m.cars.name}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                      statusColors[m.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {m.status}
                  </span>
                  <button className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2">
                    <Info size={16} /> Dettagli
                  </button>
                </div>
              </div>
            )}

            {view === "dettagliata" && (
              <>
                <h2 className="text-xl font-bold text-gray-800">
                  {m.description}
                </h2>
                <p className="text-sm text-gray-500">
                  Data: {new Date(m.date).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">
                  Auto: {m.cars?.name || "N/A"}
                </p>
                <span
                  className={`px-2 py-1 rounded-lg text-xs font-semibold w-fit ${
                    statusColors[m.status] || "bg-gray-100 text-gray-800"
                  }`}
                >
                  {m.status}
                </span>
                <div className="flex justify-end">
                  <button className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-lg flex items-center gap-2">
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
