"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Info, List, Grid } from "lucide-react";
import { Audiowide } from "next/font/google";

// Font racing
const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");

  const fetchComponents = async () => {
    const { data, error } = await supabase
      .from("components")
      .select("id, type, identifier, expiry_date, is_active, car_id, cars(name)")
      .order("id", { ascending: true });

    if (!error) setComponents(data || []);
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">⚙️ Componenti</h1>
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

      {/* Lista Componenti */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {components.map((comp) => (
          <div
            key={comp.id}
            className="bg-white shadow-lg rounded-2xl p-6 flex flex-col gap-4 border border-gray-200 hover:shadow-xl transition"
          >
            {view === "sintetica" && (
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{comp.type}</h2>
                  <span className="text-sm text-gray-500">{comp.identifier}</span>
                  {comp.cars && (
                    <p className="text-xs text-gray-400">
                      Auto: {comp.cars.name}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-lg flex items-center gap-2">
                    <Edit size={16} /> Modifica
                  </button>
                  <button className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2">
                    <Info size={16} /> Dettagli
                  </button>
                </div>
              </div>
            )}

            {view === "dettagliata" && (
              <>
                <h2 className="text-xl font-bold text-gray-800">
                  {comp.type} – {comp.identifier}
                </h2>
                <p className="text-sm text-gray-500">
                  Auto assegnata: {comp.cars?.name || "Nessuna"}
                </p>
                {comp.expiry_date && (
                  <p className="text-sm text-red-500 font-medium">
                    Scadenza: {new Date(comp.expiry_date).toLocaleDateString()}
                  </p>
                )}
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
