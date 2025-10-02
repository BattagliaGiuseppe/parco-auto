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

  const inOrdine = cars.length;
  const prossime = maintenances.length;
  const urgenze = components.filter((c) => {
    if (!c.expiry_date) return false;
    const expiry = new Date(c.expiry_date);
    const today = new Date();
    return expiry <= today;
  }).length;

  const chartData = cars.map((car) => ({
    name: car.name,
    motore: car.engine_hours || 0,
  }));

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      <h1 className="text-3xl font-bold text-gray-800 mb-4">🏁 Dashboard</h1>

      {/* Cards principali */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Auto in ordine
          </div>
          <div className="flex items-center gap-3 p-6">
            <CheckCircle className="text-green-500" size={36} />
            <span className="text-2xl font-bold">{inOrdine}</span>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Manutenzioni prossime
          </div>
          <div className="flex items-center gap-3 p-6">
            <AlertTriangle className="text-yellow-500" size={36} />
            <span className="text-2xl font-bold">{prossime}</span>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Urgenze
          </div>
          <div className="flex items-center gap-3 p-6">
            <XCircle className="text-red-500" size={36} />
            <span className="text-2xl font-bold">{urgenze}</span>
          </div>
        </div>
      </div>

      {/* Grafico */}
      <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
        <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
          Ore motore per vettura
        </div>
        <div className="h-64 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="motore" fill="#facc15" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scadenze & Calendario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg">
            Prossime Scadenze
          </div>
          <ul className="space-y-3 p-4">
            {components
              .filter((c) => c.expiry_date)
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span className="text-gray-700">
                    {c.type} – {c.identifier}
                  </span>
                  <span className="text-sm bg-yellow-100 text-yellow-600 px-3 py-1 rounded-full">
                    {new Date(c.expiry_date).toLocaleDateString("it-IT")}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-black text-yellow-500 px-4 py-2 font-bold text-lg flex items-center gap-2">
            <Calendar size={20} /> Calendario Eventi
          </div>
          <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-lg m-4">
            Calendario qui (es. react-big-calendar)
          </div>
        </div>
      </div>
    </div>
  );
}
