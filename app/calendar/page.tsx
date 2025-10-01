"use client";

import { Calendar as CalendarIcon, Clock, List } from "lucide-react";
import { Audiowide } from "next/font/google";
import { useState } from "react";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function CalendarPage() {
  const [events] = useState([
    {
      id: 1,
      title: "Revisione Auto #12",
      date: "2025-10-10",
      status: "urgente",
    },
    {
      id: 2,
      title: "Cambio motore Auto #5",
      date: "2025-10-15",
      status: "programmato",
    },
  ]);

  const statusColors: Record<string, string> = {
    urgente: "bg-red-100 text-red-800",
    programmato: "bg-yellow-100 text-yellow-800",
    completato: "bg-green-100 text-green-800",
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon /> Calendario
        </h1>
      </div>

      {/* Lista Eventi */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="bg-white shadow-lg rounded-2xl p-6 flex flex-col gap-4 border border-gray-200 hover:shadow-xl transition"
          >
            <h2 className="text-xl font-bold text-gray-800">{ev.title}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock size={16} /> {new Date(ev.date).toLocaleDateString()}
            </div>
            <span
              className={`px-2 py-1 rounded-lg text-xs font-semibold w-fit ${
                statusColors[ev.status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {ev.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
