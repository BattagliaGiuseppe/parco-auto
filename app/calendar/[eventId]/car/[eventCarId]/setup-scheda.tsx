"use client";

import Image from "next/image";
import { useState } from "react";

export default function SetupScheda() {
  const [setupData, setSetupData] = useState({
    frontWing: "",
    rearWing: "",
    rake: "",
    camber: "",
    toe: "",
    pressures: "",
    springs: "",
    antiroll: "",
  });

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-neutral-950 min-h-screen text-yellow-400 rounded-2xl border border-yellow-600 shadow-[0_0_25px_rgba(255,214,0,0.1)]">
      <h1 className="text-2xl md:text-3xl font-bold text-center uppercase tracking-widest">
        Setup Griiip G1 — Scheda Tecnica
      </h1>

      {/* --- Immagini in alto --- */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-5xl mx-auto">
        <Image
          src="/in-alto-a-sinistra.png"
          alt="in alto sinistra"
          width={250}
          height={120}
          className="mx-auto rounded-lg"
        />
        <Image
          src="/in-alto-al-centro.png"
          alt="in alto centro"
          width={250}
          height={120}
          className="mx-auto rounded-lg"
        />
        <Image
          src="/in-alto-a-destra.png"
          alt="in alto destra"
          width={250}
          height={120}
          className="mx-auto rounded-lg"
        />
      </div>

      {/* --- Macchina centrale --- */}
      <div className="flex justify-center items-center my-6">
        <Image
          src="/macchina-al-centro.png"
          alt="macchina"
          width={700}
          height={800}
          className="max-w-full h-auto"
        />
      </div>

      {/* --- Immagini in basso --- */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-3xl mx-auto">
        <Image
          src="/in-basso-a-sinistra.png"
          alt="in basso sinistra"
          width={300}
          height={150}
          className="mx-auto rounded-lg"
        />
        <Image
          src="/in-basso-a-destra.png"
          alt="in basso destra"
          width={300}
          height={150}
          className="mx-auto rounded-lg"
        />
      </div>

      {/* --- Campi valori principali --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mx-auto mt-8">
        {[
          { label: "Ala anteriore", key: "frontWing" },
          { label: "Ala posteriore", key: "rearWing" },
          { label: "Rake", key: "rake" },
          { label: "Camber", key: "camber" },
          { label: "Toe", key: "toe" },
          { label: "Pressioni", key: "pressures" },
          { label: "Molle", key: "springs" },
          { label: "Barre antirollio", key: "antiroll" },
        ].map(({ label, key }) => (
          <div key={key} className="flex flex-col">
            <label className="text-sm font-semibold mb-1">{label}</label>
            <input
              type="text"
              value={(setupData as any)[key]}
              onChange={(e) =>
                setSetupData((prev) => ({ ...prev, [key]: e.target.value }))
              }
              placeholder="Inserisci valore"
              className="bg-neutral-800 border border-yellow-700 text-yellow-200 px-3 py-2 rounded-lg"
            />
          </div>
        ))}
      </div>

      {/* --- Pulsanti (fittizi per ora) --- */}
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        <button className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl shadow-md">
          💾 Salva Setup
        </button>
        <button className="bg-neutral-800 border border-yellow-600 hover:bg-neutral-700 text-yellow-400 font-bold px-6 py-3 rounded-xl shadow-md">
          📤 Esporta PDF
        </button>
      </div>
    </div>
  );
}
