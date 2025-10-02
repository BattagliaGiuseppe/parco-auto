"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, PlusCircle } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");

  const fetchComponents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("components")
      .select("id, type, identifier, expiry_date, is_active, last_maintenance_date, car_id (name)")
      .order("id", { ascending: true });

    if (!error) setComponents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  const getExpiryColor = (date: string) => {
    const expiry = new Date(date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());

    if (months > 12) return "text-green-500";
    if (months > 6) return "text-yellow-500";
    return "text-red-500";
  };

  // filtro in base allo stato
  const filteredComponents = components.filter((c) => {
    if (!c.expiry_date) return true;
    const expiry = new Date(c.expiry_date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());

    if (filter === "all") return true;
    if (filter === "expiring") return months <= 6 && months >= 0;
    if (filter === "expired") return expiry < now;
    return true;
  });

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800">🔧 Componenti</h1>

        <div className="flex gap-3 items-center">
          {/* Filtro scadenze */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
          >
            <option value="all">Tutti</option>
            <option value="expiring">In scadenza (≤ 6 mesi)</option>
            <option value="expired">Scaduti</option>
          </select>

          {/* Aggiungi componente */}
          <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <PlusCircle size={18} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Lista componenti */}
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredComponents.map((comp) => (
            <div
              key={comp.id}
              className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              {/* Header card */}
              <div className="bg-gray-900 text-yellow-500 px-4 py-3 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold capitalize">{comp.type}</h2>
                  <span className="text-sm opacity-80">{comp.car_id?.name || "—"}</span>
                </div>
              </div>

              {/* Corpo card */}
              <div className="p-4 flex flex-col gap-3">
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Identificativo:</span>{" "}
                  {comp.identifier}
                </p>

                {comp.expiry_date && (
                  <p
                    className={`font-semibold ${getExpiryColor(comp.expiry_date)}`}
                  >
                    Scadenza:{" "}
                    {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                  </p>
                )}

                {comp.last_maintenance_date && (
                  <p className="text-sm text-gray-600">
                    Ultima manutenzione:{" "}
                    <span className="font-semibold text-blue-600">
                      {new Date(comp.last_maintenance_date).toLocaleDateString("it-IT")}
                    </span>
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
