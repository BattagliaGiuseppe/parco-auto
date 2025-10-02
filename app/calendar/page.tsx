"use client";

import { CalendarDays, PlusCircle } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function CalendarPage() {
  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarDays /> Calendario
        </h1>
        <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <PlusCircle size={18} /> Aggiungi evento
        </button>
      </div>

      {/* Placeholder calendario */}
      <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200">
        <div className="h-[500px] flex items-center justify-center text-gray-400 border-2 border-dashed rounded-xl">
          Calendario in arrivo (integrazione con react-big-calendar)
        </div>
      </div>
    </div>
  );
}
