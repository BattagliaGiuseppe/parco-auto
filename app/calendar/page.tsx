"use client";

import { Calendar } from "lucide-react";

export default function CalendarPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Calendar size={24} /> 📅 Calendario Eventi
      </h1>

      <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-lg">
        Qui potrai integrare un calendario (es. react-big-calendar)
      </div>
    </div>
  );
}
