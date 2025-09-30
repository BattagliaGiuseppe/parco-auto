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

  // 📊 Esempio semplice per contatori
  const inOrdine = cars.length;
  const prossime = maintenances.length;
  const urgenze = components.filter((c) => {
    if (!c.expiry_date) return false;
    const expiry = new Date(c.expiry_date);
    const today = new Date();
    return expiry <= today;
  }).length;

  // 📈 Esempio dati grafico: se la tabella cars ha un campo "engine_hours"
  const chartData = cars.map((car) => ({
    name: car.name,
    motore: car.engine_hours || 0,
  }));

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard Parco Auto</h1>

      {/* Card stato vetture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-green-500">
          <CheckCircle className="text-green-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Auto in ordine</p>
            <p className="text-xl font-bold">{inOrdine}</p>
          </div>
        </div>
        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-yellow-500">
          <AlertTriangle className="text-yellow-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Manutenzioni prossime</p>
            <p className="text-xl font-bold">{prossime}</p>
          </div>
        </div>
        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-red-500">
          <XCircle className="text-red-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Urgenze</p>
            <p className="text-xl font-bold">{urgenze}</p>
          </div>
        </div>
      </div>

      {/* Grafico */}
      <div className="bg-white shadow-lg rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Ore motore per vettura</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="motore" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scadenze (prende i componenti con expiry_date futuro) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Prossime Scadenze</h2>
          <ul className="space-y-3">
            {components
              .filter((c) => c.expiry_date)
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span className="text-gray-700">
                    {c.type} – {c.identifier}
                  </span>
                  <span className="text-sm bg-yellow-100 text-yellow-600 px-3 py-1 rounded-full">
                    {c.expiry_date}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar size={20} /> Calendario Eventi
          </h2>
          <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-lg">
            Calendario qui (es. react-big-calendar)
          </div>
        </div>
      </div>
    </div>
  );
}
