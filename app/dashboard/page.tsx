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
const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

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

  // Contatori
  const inOrdine = cars.length;
  const prossime = maintenances.length;
  const urgenze = components.filter((c) => {
    if (!c.expiry_date) return false;
    const expiry = new Date(c.expiry_date);
    const today = new Date();
    return expiry <= today;
  }).length;

  // Dati grafico
  const chartData = cars.map((car) => ({
    name: car.name,
    motore: car.engine_hours || 0,
  }));

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        🏎️ Dashboard Parco Auto
      </h1>

      {/* Cards stato */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black text-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-yellow-500">
          <CheckCircle className="text-yellow-400" size={32} />
          <div>
            <p className="text-sm opacity-80">Auto in ordine</p>
            <p className="text-2xl font-bold">{inOrdine}</p>
          </div>
        </div>
        <div className="bg-black text-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-yellow-500">
          <AlertTriangle className="text-yellow-400" size={32} />
          <div>
            <p className="text-sm opacity-80">Manutenzioni prossime</p>
            <p className="text-2xl font-bold">{prossime}</p>
          </div>
        </div>
        <div className="bg-black text-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-yellow-500">
          <XCircle className="text-yellow-400" size={32} />
          <div>
            <p className="text-sm opacity-80">Urgenze</p>
            <p className="text-2xl font-bold">{urgenze}</p>
          </div>
        </div>
      </div>

      {/* Grafico */}
      <div className="bg-black text-white shadow-lg rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 text-yellow-400">
          Ore motore per vettura
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip
                contentStyle={{ backgroundColor: "#111", color: "#fff" }}
              />
              <Bar dataKey="motore" fill="#facc15" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scadenze + Calendario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-black text-white shadow-lg rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-yellow-400">
            Prossime Scadenze
          </h2>
          <ul className="space-y-3">
            {components
              .filter((c) => c.expiry_date)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between border-b border-gray-700 pb-2"
                >
                  <span>{c.type} – {c.identifier}</span>
                  <span className="text-yellow-400">
                    {new Date(c.expiry_date).toLocaleDateString()}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        <div className="bg-black text-white shadow-lg rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-yellow-400">
            <Calendar size={20} /> Calendario Eventi
          </h2>
          <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-700 rounded-lg">
            📅 Calendario qui (es. react-big-calendar)
          </div>
        </div>
      </div>
    </div>
  );
}
