
"use client";

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

const data = [
  { name: "Auto #12", motore: 80 },
  { name: "Auto #8", motore: 55 },
  { name: "Auto #5", motore: 30 },
  { name: "Auto #3", motore: 95 },
];

export default function Dashboard() {
  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard Parco Auto</h1>

      {/* Card stato vetture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-green-500">
          <CheckCircle className="text-green-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Auto in ordine</p>
            <p className="text-xl font-bold">5</p>
          </div>
        </div>
        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-yellow-500">
          <AlertTriangle className="text-yellow-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Manutenzioni prossime</p>
            <p className="text-xl font-bold">2</p>
          </div>
        </div>
        <div className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4 border-red-500">
          <XCircle className="text-red-500" size={32} />
          <div>
            <p className="text-sm text-gray-500">Urgenze</p>
            <p className="text-xl font-bold">1</p>
          </div>
        </div>
      </div>

      {/* Grafico */}
      <div className="bg-white shadow-lg rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Ore motore per vettura</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="motore" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scadenze + Calendario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Prossime Scadenze</h2>
          <ul className="space-y-3">
            <li className="flex items-center justify-between">
              <span className="text-gray-700">Cambio motore Auto #12</span>
              <span className="text-sm bg-red-100 text-red-600 px-3 py-1 rounded-full">Urgente</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-gray-700">Revisione sospensioni Auto #8</span>
              <span className="text-sm bg-yellow-100 text-yellow-600 px-3 py-1 rounded-full">Tra 7 giorni</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-gray-700">Tagliando Auto #5</span>
              <span className="text-sm bg-green-100 text-green-600 px-3 py-1 rounded-full">Ok</span>
            </li>
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
