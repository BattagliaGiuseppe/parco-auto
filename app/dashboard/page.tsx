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
      const { data: carsData } = await supabase
        .from("cars")
        .select("id, name, engine_hours");
      const { data: maintData } = await supabase
        .from("maintenances")
        .select("id");
      const { data: compsData } = await supabase
        .from("components")
        .select("id, type, identifier, expiry_date");

      if (carsData) setCars(carsData);
      if (maintData) setMaintenances(maintData);
      if (compsData) setComponents(compsData);
    };

    fetchData();
  }, []);

  // Contatori
  const inOrdine = cars.length;
  const prossime = maintenances.length;
  const urgenze = components.filter((c) => {
    if (!c.expiry_date) return false;
    const expiry = new Date(c.expiry_date);
    return expiry <= new Date();
  }).length;

  // Dati grafico: ore motore
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
    </div>
  );
}
