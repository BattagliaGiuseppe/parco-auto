"use client";

import Image from "next/image";
import { useState } from "react";

export default function SetupScheda() {
  const [setup, setSetup] = useState<any>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSetup((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-4 flex flex-col items-center gap-8 bg-white text-gray-800">
      <h1 className="text-2xl font-bold text-center uppercase">
        Setup Griiip G1 — Scheda Tecnica
      </h1>

      {/* --- GRIGLIA 3x2 --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">

        {/* ---------- ZONA 2: ANTERIORE SX ---------- */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/in-alto-a-sinistra.png"
            alt="in alto sinistra"
            width={220}
            height={100}
          />
          <ZoneBox
            title="Anteriore SX"
            fields={[
              { name: "pesoAntSx", label: "Peso", unit: "Kg" },
              { name: "camberAntSxDeg", label: "Camber", unit: "°" },
              { name: "camberAntSxMm", label: "Camber", unit: "mm" },
              { name: "toeOutSxMm", label: "Toe out", unit: "mm" },
              { name: "toeOutSxDeg", label: "Toe out", unit: "°" },
              { name: "pressioneAntSx", label: "Pressione a freddo", unit: "bar" },
              { name: "antirollAntSx", label: "Antirollio" },
              { name: "altezzaStaggiaAntSx", label: "Altezza a staggia", unit: "mm" },
              { name: "altezzaSuoloAntSx", label: "Altezza da suolo", unit: "mm" },
              { name: "mollaAntSx", label: "Molla", unit: "Lbs" },
              { name: "precaricoAntSx", label: "Precarico", unit: "giri" },
              { name: "idraulicaAntSx", label: "Idraulica", unit: "click" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>

        {/* ---------- ZONA 1: ALA ANTERIORE ---------- */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/in-alto-al-centro.png"
            alt="in alto centro"
            width={240}
            height={110}
          />
          <ZoneBox
            title="Ala Anteriore"
            fields={[
              { name: "posizioneAlaAnt", label: "Posizione", unit: "°" },
              { name: "gradiAlaAnt", label: "Gradi", unit: "°" },
              { name: "alaAnt", label: "Ala", unit: "°" },
              { name: "flapAnt", label: "Flap", unit: "°" },
              { name: "pesoAlaAntSx", label: "Peso SX", unit: "Kg" },
              { name: "pesoAlaAntDx", label: "Peso DX", unit: "Kg" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>

        {/* ---------- ZONA 3: ANTERIORE DX ---------- */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/in-alto-a-destra.png"
            alt="in alto destra"
            width={220}
            height={100}
          />
          <ZoneBox
            title="Anteriore DX"
            fields={[
              { name: "pesoAntDx", label: "Peso", unit: "Kg" },
              { name: "camberAntDxDeg", label: "Camber", unit: "°" },
              { name: "camberAntDxMm", label: "Camber", unit: "mm" },
              { name: "toeOutDxMm", label: "Toe out", unit: "mm" },
              { name: "toeOutDxDeg", label: "Toe out", unit: "°" },
              { name: "pressioneAntDx", label: "Pressione a freddo", unit: "bar" },
              { name: "antirollAntDx", label: "Antirollio" },
              { name: "altezzaStaggiaAntDx", label: "Altezza a staggia", unit: "mm" },
              { name: "altezzaSuoloAntDx", label: "Altezza da suolo", unit: "mm" },
              { name: "mollaAntDx", label: "Molla", unit: "Lbs" },
              { name: "precaricoAntDx", label: "Precarico", unit: "giri" },
              { name: "idraulicaAntDx", label: "Idraulica", unit: "click" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>

        {/* ---------- ZONA 4: POSTERIORE SX ---------- */}
        <div className="flex flex-col items-center gap-3">
          <ZoneBox
            title="Posteriore SX"
            fields={[
              { name: "pesoPostSx", label: "Peso", unit: "Kg" },
              { name: "camberPostSxDeg", label: "Camber", unit: "°" },
              { name: "camberPostSxMm", label: "Camber", unit: "mm" },
              { name: "toeInSxMm", label: "Toe in", unit: "mm" },
              { name: "toeInSxDeg", label: "Toe in", unit: "°" },
              { name: "pressionePostSx", label: "Pressione a freddo", unit: "bar" },
              { name: "antirollPostSx", label: "Antirollio" },
              { name: "altezzaStaggiaPostSx", label: "Altezza a staggia", unit: "mm" },
              { name: "altezzaSuoloPostSx", label: "Altezza da suolo", unit: "mm" },
              { name: "mollaPostSx", label: "Molla", unit: "Lbs" },
              { name: "precaricoPostSx", label: "Precarico", unit: "giri" },
              { name: "idraulicaPostSx", label: "Idraulica", unit: "click" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <Image
            src="/in-basso-a-sinistra.png"
            alt="in basso sinistra"
            width={220}
            height={100}
          />
          <div className="border rounded-lg p-2 mt-2 w-full text-sm bg-gray-50">
            <h3 className="font-semibold text-center mb-2">
              Ripartizione e Rake
            </h3>
            <div className="flex flex-col gap-2 items-center">
              <InputShort
                label="Ripartitore"
                name="ripartitore"
                unit="%"
                handleChange={handleChange}
                setup={setup}
              />
              <InputShort
                label="Rake"
                name="rake"
                unit="°"
                handleChange={handleChange}
                setup={setup}
              />
            </div>
          </div>
        </div>

        {/* ---------- ZONA 5: ALA POSTERIORE ---------- */}
        <div className="flex flex-col items-center gap-3">
          <div className="my-2">
            <Image
              src="/macchina-al-centro.png"
              alt="macchina"
              width={350}
              height={350}
              className="mx-auto"
            />
          </div>
          <ZoneBox
            title="Ala Posteriore"
            fields={[
              { name: "posizioneAlaPost", label: "Posizione", unit: "°" },
              { name: "gradiAlaPost", label: "Gradi", unit: "°" },
              { name: "beam", label: "Beam", unit: "°" },
              { name: "main", label: "Main", unit: "°" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>

        {/* ---------- ZONA 6: POSTERIORE DX ---------- */}
        <div className="flex flex-col items-center gap-3">
          <ZoneBox
            title="Posteriore DX"
            fields={[
              { name: "pesoPostDx", label: "Peso", unit: "Kg" },
              { name: "camberPostDxDeg", label: "Camber", unit: "°" },
              { name: "camberPostDxMm", label: "Camber", unit: "mm" },
              { name: "toeInDxMm", label: "Toe in", unit: "mm" },
              { name: "toeInDxDeg", label: "Toe in", unit: "°" },
              { name: "pressionePostDx", label: "Pressione a freddo", unit: "bar" },
              { name: "antirollPostDx", label: "Antirollio" },
              { name: "altezzaStaggiaPostDx", label: "Altezza a staggia", unit: "mm" },
              { name: "altezzaSuoloPostDx", label: "Altezza da suolo", unit: "mm" },
              { name: "mollaPostDx", label: "Molla", unit: "Lbs" },
              { name: "precaricoPostDx", label: "Precarico", unit: "giri" },
              { name: "idraulicaPostDx", label: "Idraulica", unit: "click" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <Image
            src="/in-basso-a-destra.png"
            alt="in basso destra"
            width={220}
            height={100}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- COMPONENTI ---------- */

function ZoneBox({ title, fields, handleChange, setup }: any) {
  return (
    <div className="border rounded-lg p-2 w-full text-sm bg-gray-50">
      <h3 className="font-semibold text-center mb-2">{title}</h3>
      <div className="flex flex-col gap-1">
        {fields.map((f: any) => (
          <div key={f.name} className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-28">{f.label}</label>
            <input
              type="text"
              name={f.name}
              value={setup[f.name] || ""}
              onChange={handleChange}
              className="border rounded px-1 py-0.5 text-sm w-20"
            />
            {f.unit && <span className="text-xs text-gray-500">{f.unit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InputShort({ label, name, unit, handleChange, setup }: any) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 w-24">{label}</label>
      <input
        type="text"
        name={name}
        value={setup[name] || ""}
        onChange={handleChange}
        className="border rounded px-1 py-0.5 text-sm w-20"
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}
