"use client";

import Image from "next/image";
import { useState } from "react";

export default function SetupScheda() {
  const [setupData, setSetupData] = useState({
    frontWing: "",
    rearWing: "",
    rake: "",
    camberFront: "",
    camberRear: "",
    toeFront: "",
    toeRear: "",
    pressuresFront: "",
    pressuresRear: "",
    springsFront: "",
    springsRear: "",
    antirollFront: "",
    antirollRear: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSetupData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-4 md:p-8 flex flex-col gap-8 bg-white rounded-xl border shadow-sm">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 text-center uppercase tracking-wider">
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

      {/* --- Tabelle / campi valori --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
        {/* Aero */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2 border-b pb-1">
            Aerodinamica
          </h3>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-700">Ala anteriore</label>
            <input
              name="frontWing"
              value={setupData.frontWing}
              onChange={handleChange}
              placeholder="°"
              className="border rounded-md p-2"
            />

            <label className="text-sm text-gray-700">Ala posteriore</label>
            <input
              name="rearWing"
              value={setupData.rearWing}
              onChange={handleChange}
              placeholder="°"
              className="border rounded-md p-2"
            />

            <label className="text-sm text-gray-700">Rake</label>
            <input
              name="rake"
              value={setupData.rake}
              onChange={handleChange}
              placeholder="mm"
              className="border rounded-md p-2"
            />
          </div>
        </div>

        {/* Geometrie */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2 border-b pb-1">
            Geometrie
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-700">Camber ant.</label>
              <input
                name="camberFront"
                value={setupData.camberFront}
                onChange={handleChange}
                placeholder="°"
                className="border rounded-md p-2 w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Camber post.</label>
              <input
                name="camberRear"
                value={setupData.camberRear}
                onChange={handleChange}
                placeholder="°"
                className="border rounded-md p-2 w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Toe ant.</label>
              <input
                name="toeFront"
                value={setupData.toeFront}
                onChange={handleChange}
                placeholder="mm"
                className="border rounded-md p-2 w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Toe post.</label>
              <input
                name="toeRear"
                value={setupData.toeRear}
                onChange={handleChange}
                placeholder="mm"
                className="border rounded-md p-2 w-full"
              />
            </div>
          </div>
        </div>

        {/* Pressioni */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2 border-b pb-1">
            Pressioni
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-700">Ant.</label>
              <input
                name="pressuresFront"
                value={setupData.pressuresFront}
                onChange={handleChange}
                placeholder="bar"
                className="border rounded-md p-2 w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Post.</label>
              <input
                name="pressuresRear"
                value={setupData.pressuresRear}
                onChange={handleChange}
                placeholder="bar"
                className="border rounded-md p-2 w-full"
              />
            </div>
          </div>
        </div>

        {/* Sospensioni */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2 border-b pb-1">
            Sospensioni
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-700">Molle ant.</label>
              <input
                name="springsFront"
                value={setupData.springsFront}
                onChange={handleChange}
                placeholder="N/mm"
                className="border rounded-md p-2 w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Molle post.</label>
              <input
                name="springsRear"
                value={setupData.springsRear}
                onChange={handleChange}
                placeholder="N/mm"
                className="border rounded-md p-2 w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Antirollio ant.</label>
              <input
                name="antirollFront"
                value={setupData.antirollFront}
                onChange={handleChange}
                placeholder="soft / hard"
                className="border rounded-md p-2 w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Antirollio post.</label>
              <input
                name="antirollRear"
                value={setupData.antirollRear}
                onChange={handleChange}
                placeholder="soft / hard"
                className="border rounded-md p-2 w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pulsanti fittizi */}
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        <button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg shadow">
          💾 Salva Setup
        </button>
        <button className="bg-gray-900 hover:bg-gray-800 text-yellow-400 border border-yellow-400 font-bold px-6 py-3 rounded-lg shadow">
          📤 Esporta PDF
        </button>
      </div>
    </div>
  );
}
