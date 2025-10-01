"use client";

import { useState } from "react";
import { Settings, Save } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function SettingsPage() {
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("it");

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Settings /> Impostazioni
        </h1>
      </div>

      {/* Form impostazioni */}
      <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-col gap-6 border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tema
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="border p-2 rounded-lg w-full"
          >
            <option value="light">Chiaro</option>
            <option value="dark">Scuro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lingua
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="border p-2 rounded-lg w-full"
          >
            <option value="it">Italiano</option>
            <option value="en">Inglese</option>
          </select>
        </div>

        <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Save size={18} /> Salva
        </button>
      </div>
    </div>
  );
}
