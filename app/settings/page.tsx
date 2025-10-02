"use client";

import { Settings, Save } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function SettingsPage() {
  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Settings /> Impostazioni
        </h1>
        <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Save size={18} /> Salva
        </button>
      </div>

      {/* Card impostazioni generali */}
      <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200 space-y-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Generali</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-600">Nome Team</label>
            <input
              type="text"
              placeholder="Battaglia Racing"
              className="border rounded-lg p-2 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Colore primario</label>
            <input
              type="color"
              defaultValue="#FFD700"
              className="w-16 h-10 border rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Card notifiche */}
      <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200 space-y-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Notifiche</h2>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="email" className="w-4 h-4" defaultChecked />
          <label htmlFor="email" className="text-sm text-gray-700">
            Ricevi notifiche via email
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="calendar" className="w-4 h-4" />
          <label htmlFor="calendar" className="text-sm text-gray-700">
            Sincronizza con calendario esterno
          </label>
        </div>
      </div>
    </div>
  );
}
