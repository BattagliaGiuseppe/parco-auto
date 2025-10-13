"use client";

import Image from "next/image";
import { useState } from "react";

export default function SetupScheda() {
  const [setup, setSetup] = useState<any>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSetup((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-4 flex flex-col items-center gap-8 bg-white text-gray-800">
      <h1 className="text-2xl font-bold text-center uppercase">
        Setup Griiip G1 — Scheda Tecnica
      </h1>

      {/* --- GRIGLIA PRINCIPALE --- */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-[950px] mx-auto"
      >
        {/* step 1: colonne laterali più strette (max 240px) */}
        {/* ---------- ZONA 2: ANTERIORE SX + intestazione ---------- */}
        <div className="flex flex-col items-center gap-3 max-w-[240px]">
          {/* Mini tabella Data / Autodromo / Telaio */}
          <div className="border rounded-lg p-2 w-full text-sm bg-gray-50 mb-2">
            <h3 className="font-semibold text-center mb-1">Info Generali</h3>
            <div className="flex flex-col gap-1">
              <InputShort label="Data" name="data" handleChange={handleChange} setup={setup} />
              <InputShort label="Autodromo" name="autodromo" handleChange={handleChange} setup={setup} />
              <InputShort label="Telaio" name="telaio" handleChange={handleChange} setup={setup} />
            </div>
          </div>

          <Image
            src="/in-alto-a-sinistra.png"
            alt="in alto sinistra"
            width={200}
            height={90}
          />

          <ZoneBox
            title="Anteriore SX"
            singleColumn
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

        {/* ---------- ZONA 1: ALA ANTERIORE + MACCHINA + ALA POSTERIORE ---------- */}
        <div className="flex flex-col items-center gap-3">
          {/* Ala Anteriore */}
          <Image
            src="/in-alto-al-centro.png"
            alt="in alto centro"
            width={360}
            height={150}
          />
          <div className="border rounded-lg p-3 w-full text-sm bg-gray-50 text-center">
            <h3 className="font-semibold mb-2">Ala Anteriore</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th></th>
                  <th className="border px-2 py-1">Posizione</th>
                  <th className="border px-2 py-1">Gradi</th>
                </tr>
              </thead>
              <tbody>
                {/* step 3: rimossi simboli ° */}
                <tr>
                  <td className="border px-2 py-1 text-left">Ala</td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="alaAntPosizione"
                      value={setup.alaAntPosizione || ""}
                      onChange={handleChange}
                      className="w-15 border rounded px-1"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="alaAntGradi"
                      value={setup.alaAntGradi || ""}
                      onChange={handleChange}
                      className="w-15 border rounded px-1"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 text-left">Flap</td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="flapAntPosizione"
                      value={setup.flapAntPosizione || ""}
                      onChange={handleChange}
                      className="w-15 border rounded px-1"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="flapAntGradi"
                      value={setup.flapAntGradi || ""}
                      onChange={handleChange}
                      className="w-15 border rounded px-1"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* step 5: macchina centrata tra ali */}
          <div className="relative -mt-16">
            <Image
              src="/macchina-al-centro.png"
              alt="macchina"
              width={440}
              height={440}
              className="mx-auto"
            />
          </div>

          {/* step 5: tabella ala posteriore riallineata */}
          <div className="border rounded-lg p-3 w-full text-sm bg-gray-50 text-center -mt-6">
            <h3 className="font-semibold mb-2">Ala Posteriore</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th></th>
                  <th className="border px-2 py-1">Posizione</th>
                  <th className="border px-2 py-1">Gradi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1 text-left">Beam</td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="beamPosizione"
                      value={setup.beamPosizione || ""}
                      onChange={handleChange}
                      className="w-15 border rounded px-1"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="beamGradi"
                      value={setup.beamGradi || ""}
                      onChange={handleChange}
                      className="w-15 border rounded px-1"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 text-left">Main</td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="mainPosizione"
                      value={setup.mainPosizione || ""}
                      onChange={handleChange}
                      className="w-15 border rounded px-1"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="mainGradi"
                      value={setup.mainGradi || ""}
                      onChange={handleChange}
                      className="w-15 border rounded px-1"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- ZONA 3: ANTERIORE DX ---------- */}
        <div className="flex flex-col items-center gap-3 max-w-[240px]">
          {/* step 4: rialzata solo l’immagine */}
          <Image
            src="/in-alto-a-destra.png"
            alt="in alto destra"
            width={200}
            height={90}
            className="-mt-4"
          />
          <ZoneBox
            title="Anteriore DX"
            singleColumn
            fields={[
              { name: "pesoAntDx", label: "Peso", unit: "Kg" },
              { name: "camberAntDxDeg", label: "Camber", unit: "°" },
              { name: "toeOutDxMm", label: "Toe out", unit: "mm" },
              { name: "pressioneAntDx", label: "Pressione a freddo", unit: "bar" },
              { name: "mollaAntDx", label: "Molla", unit: "Lbs" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- COMPONENTI ---------- */

/* step 2: input più corti (w-15 ovunque) */
function ZoneBox({ title, fields, handleChange, setup, singleColumn = false }: any) {
  return (
    <div className="border rounded-lg p-2 w-full text-sm bg-gray-50">
      <h3 className="font-semibold text-center mb-2">{title}</h3>
      <div className={singleColumn ? "flex flex-col gap-1" : "grid grid-cols-2 gap-1"}>
        {fields.map((f: any) => (
          <div key={f.name} className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-28">{f.label}</label>
            <input
              type="text"
              name={f.name}
              value={setup[f.name] || ""}
              onChange={handleChange}
              className="border rounded px-1 py-0.5 text-sm w-15"
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
        className="border rounded px-1 py-0.5 text-sm w-15"
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}
