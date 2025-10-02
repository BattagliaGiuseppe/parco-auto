"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, PlusCircle, Wrench } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMaintenances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("maintenances")
      .select("id, description, date, km, component_id (type, identifier, car_id(name))")
      .order("date", { ascending: false });

    if (!error) setMaintenances(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMaintenances();
  }, []);

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Wrench /> Manutenzioni
        </h1>
        <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <PlusCircle size={18} /> Aggiungi manutenzione
        </button>
      </div>

      {/* Lista manutenzioni */}
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {maintenances.map((m) => (
            <div
              key={m.id}
              className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              {/* Header card */}
              <div className="bg-gray-900 text-yellow-500 px-4 py-3 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">
                    {m.component_id?.type || "—"} – {m.component_id?.identifier}
                  </h2>
                  <span className="text-sm opacity-80">
                    {m.component_id?.car_id?.name || "Senza auto"}
                  </span>
                </div>
              </div>

              {/* Corpo card */}
              <div className="p-4 flex flex-col gap-3">
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Descrizione:</span> {m.description}
                </p>
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Data:</span>{" "}
                  {new Date(m.date).toLocaleDateString("it-IT")}
                </p>
                {m.km && (
                  <p className="text-gray-700 text-sm">
                    <span className="font-semibold">KM:</span> {m.km}
                  </p>
                )}

                <div className="flex justify-end">
                  <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg flex items-center gap-2">
                    <Edit size={16} /> Modifica
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
