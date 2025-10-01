"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle, AlertTriangle, XCircle, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Audiowide } from "next/font/google";

// Font racing
const audiowide = Audiowide({ subsets: ["latin"], weight: "400" });

export default function Dashboard() {
  const [cars, setCars] = useState<any[]>([]);
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: carsData } = await supabase.from("cars").select("*");
      const { data: maintData } = await supabase.from("maintenances").select("*");
      const { data: compsData } = await supabase.from("components").select("*");

      setCars(carsData || []);
      setMaintenances(maintData || []);
      setComponents(compsData || []);
    };

    fetchData();
  }, []);

  // 📊 Calcoli rapidi
  const inOrdine = cars.length;
  const prossime = maintenances.length;
  const urgenze = components.filter((c) => {
    if (!c.expiry_date) return false;
    return new Date(c.expiry_date) <= new Date();
  }).length;

  // 📈 Dati grafico
  const chartData = cars.map((car) => ({
    name: car.name,
    motore: car.engine_hours || 0,
  }));

  return (
    <div className={`p-6 flex flex-col gap-8 bg-gray-100 min-h-screen ${audiowide.className}`}>
      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-800">🏎️ Dashboard</h1>

      {/* Card statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-yellow-500">
          <CheckCircle className="text-yellow-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Auto in ordine</p>
            <p className="text-2xl font-bold text-gray-800">{inOrdine}</p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-yellow-500">
          <AlertTriangle className="text-yellow-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Manutenzioni prossime</p>
            <p className="text-2xl font-bold text-gray-800">{prossime}</p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-yellow-500">
          <XCircle className="text-yellow-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Urgenze</p>
            <p className="text-2xl font-bold text-gray-800">{urgenze}</p>
          </div>
        </div>
      </div>

      {/* Grafico */}
      <div className="bg-white shadow-lg rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Ore motore per vettura</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
              <XAxis dataKey="name" stroke="#333" />
              <YAxis stroke="#333" />
              <Tooltip contentStyle={{ backgroundColor: "#fff", color: "#000" }} />
              <Bar dataKey="motore" fill="#facc15" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scadenze e calendario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scadenze */}
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Prossime Scadenze</h2>
          <ul className="space-y-3">
            {components
              .filter((c) => c.expiry_date)
              .map((c) => {
                const expiry = new Date(c.expiry_date);
                const today = new Date();
                const isPast = expiry <= today;

                return (
                  <li key={c.id} className="flex justify-between border-b border-gray-200 pb-2">
                    <span>{c.type} – {c.identifier}</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        isPast ? "bg-red-500 text-white" : "bg-yellow-400 text-gray-900"
                      }`}
                    >
                      {expiry.toLocaleDateString("it-IT")}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>

        {/* Calendario */}
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
            <Calendar size={20} /> Calendario Eventi
          </h2>
          <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
            📅 Calendario (react-big-calendar qui)
          </div>
        </div>
      </div>
    </div>
  );
}
