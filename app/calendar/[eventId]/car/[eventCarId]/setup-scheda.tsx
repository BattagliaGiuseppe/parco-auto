"use client";

import Image from "next/image";
import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

type Field = { name: string; label: string; unit?: string };

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const [setup, setSetup] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSetup((prev) => ({ ...prev, [name]: value }));
  };

  async function saveToDB() {
    setSaving(true);
    // Salva tutto dentro event_car_setup.extras per l'eventCarId
    const payload = { event_car_id: eventCarId, extras: setup };
    const { error } = await supabase.from("event_car_setup").upsert(payload);
    setSaving(false);
    if (error) {
      alert("Errore salvataggio: " + error.message);
    } else {
      alert("✅ Scheda salvata");
    }
  }

  function exportPDF() {
    window.print();
  }

  // campi di utilità ridotti
  const InputW = "w-14"; // input compatti (~55-60px)
  const LabelW = "w-28";

  return (
    <div className="print-container p-4 flex flex-col gap-4 bg-white text-gray-800">
      {/* Header + azioni */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold uppercase">
          Setup Griiip G1 — Scheda Tecnica
        </h1>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={saveToDB}
            className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
            disabled={saving}
          >
            {saving ? "Salvo…" : "💾 Salva su DB"}
          </button>
          <button
            onClick={exportPDF}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
          >
            📤 Esporta / Stampa
          </button>
        </div>
      </div>

      {/* GRIGLIA 3 COLONNE: col SX, col CENTRALE (ala ant + macchina + ala post), col DX */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mx-auto">
        {/* COLONNA SINISTRA: Info + Ant SX + Post SX (+ immagini + Rip/Rake) */}
        <div className="flex flex-col items-center gap-3 md:w-[85%] xl:w-[75%] mx-auto">
          {/* Info generali */}
          <div className="border rounded-lg p-2 w-full text-sm bg-gray-50">
            <h3 className="font-semibold text-center mb-1">Info Generali</h3>
            <div className="flex flex-col gap-1">
              <InputShort
                label="Data"
                name="data"
                handleChange={handleChange}
                setup={setup}
                LabelW={LabelW}
                InputW={InputW}
              />
              <InputShort
                label="Autodromo"
                name="autodromo"
                handleChange={handleChange}
                setup={setup}
                LabelW={LabelW}
                InputW={InputW}
              />
              <InputShort
                label="Telaio"
                name="telaio"
                handleChange={handleChange}
                setup={setup}
                LabelW={LabelW}
                InputW={InputW}
              />
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
            fields={fieldsAntSx}
            handleChange={handleChange}
            setup={setup}
            LabelW={LabelW}
            InputW={InputW}
          />

          {/* Posteriore SX */}
          <ZoneBox
            title="Posteriore SX"
            singleColumn
            fields={fieldsPostSx}
            handleChange={handleChange}
            setup={setup}
            LabelW={LabelW}
            InputW={InputW}
          />

          <Image
            src="/in-basso-a-sinistra.png"
            alt="in basso sinistra"
            width={200}
            height={90}
          />

          {/* Ripartitore / Rake */}
          <div className="border rounded-lg p-2 w-full text-sm bg-gray-50">
            <h3 className="font-semibold text-center mb-2">Ripartizione e Rake</h3>
            <div className="flex flex-col gap-2 items-center">
              <InputShort
                label="Ripartitore"
                name="ripartitore"
                unit="%"
                handleChange={handleChange}
                setup={setup}
                LabelW={LabelW}
                InputW={InputW}
              />
              <InputShort
                label="Rake"
                name="rake"
                unit=""
                handleChange={handleChange}
                setup={setup}
                LabelW={LabelW}
                InputW={InputW}
              />
            </div>
          </div>
        </div>

        {/* COLONNA CENTRALE: Ala Anteriore -> Macchina (centrata) -> Ala Posteriore */}
        <div className="flex flex-col items-center gap-3">
          {/* TOP: immagine + Ala Anteriore */}
          <div className="flex flex-col items-center gap-3 w-full">
            <Image
              src="/in-alto-al-centro.png"
              alt="in alto centro"
              width={360}
              height={150}
            />
            <WingTable
              title="Ala Anteriore"
              row1Label="Ala"
              row2Label="Flap"
              posName1="alaAntPosizione"
              degName1="alaAntGradi"
              posName2="flapAntPosizione"
              degName2="flapAntGradi"
              setup={setup}
              onChange={handleChange}
              InputW={InputW}
            />
          </div>

          {/* CENTER: macchina centrata tra le due tabelle */}
          <div className="flex-1 w-full flex items-center justify-center my-2">
            <Image
              src="/macchina-al-centro.png"
              alt="macchina"
              width={460}
              height={460}
            />
          </div>

          {/* BOTTOM: Ala Posteriore */}
          <div className="flex flex-col items-center gap-2 w-full">
            <WingTable
              title="Ala Posteriore"
              row1Label="Beam"
              row2Label="Main"
              posName1="beamPosizione"
              degName1="beamGradi"
              posName2="mainPosizione"
              degName2="mainGradi"
              setup={setup}
              onChange={handleChange}
              InputW={InputW}
            />
          </div>
        </div>

        {/* COLONNA DESTRA: Ant DX + Post DX (+ immagine) */}
        <div className="flex flex-col items-center gap-3 md:w-[85%] xl:w-[75%] mx-auto">
          <Image
            src="/in-alto-a-destra.png"
            alt="in alto destra"
            width={200}
            height={90}
          />

          <ZoneBox
            title="Anteriore DX"
            singleColumn
            fields={fieldsAntDx}
            handleChange={handleChange}
            setup={setup}
            LabelW={LabelW}
            InputW={InputW}
          />

          <ZoneBox
            title="Posteriore DX"
            singleColumn
            fields={fieldsPostDx}
            handleChange={handleChange}
            setup={setup}
            LabelW={LabelW}
            InputW={InputW}
          />

          <Image
            src="/in-basso-a-destra.png"
            alt="in basso destra"
            width={280}
            height={110}
          />
        </div>
      </div>

      {/* NOTE (larga 3 colonne) */}
      <div className="border rounded-lg p-4 w-full max-w-5xl bg-gray-50 mx-auto">
        <h3 className="font-semibold mb-2">Note</h3>
        <textarea
          name="note"
          value={setup.note || ""}
          onChange={handleChange}
          rows={3}
          className="w-full border rounded p-2 text-sm"
          placeholder="Annotazioni, modifiche, sensazioni del pilota..."
        />
      </div>

      {/* STILI DI STAMPA */}
      <style jsx global>{`
        @media print {
          aside,
          button[aria-label='Apri menu'],
          nav,
          footer {
            display: none !important;
          }
          body,
          main,
          div {
            background: white !important;
            box-shadow: none !important;
          }
          .print-container {
            margin: 0 auto !important;
            width: 95% !important;
            max-width: 1000px !important;
          }
        }
      `}</style>
    </div>
  );
}

/* --------------------- CAMPI DEFINITI --------------------- */

const fieldsAntSx: Field[] = [
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
];

const fieldsAntDx: Field[] = [
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
];

const fieldsPostSx: Field[] = [
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
];

const fieldsPostDx: Field[] = [
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
];

/* --------------------- COMPONENTI UI --------------------- */

function ZoneBox({
  title,
  fields,
  handleChange,
  setup,
  singleColumn = false,
  LabelW,
  InputW,
}: {
  title: string;
  fields: Field[];
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setup: Record<string, any>;
  singleColumn?: boolean;
  LabelW: string;
  InputW: string;
}) {
  return (
    <div className="border rounded-lg p-2 w-full text-sm bg-gray-50">
      <h3 className="font-semibold text-center mb-2">{title}</h3>
      <div className={singleColumn ? "flex flex-col gap-1" : "grid grid-cols-2 gap-1"}>
        {fields.map((f) => (
          <div key={f.name} className="flex items-center gap-2">
            <label className={`text-xs text-gray-600 ${LabelW}`}>{f.label}</label>
            <input
              type="text"
              name={f.name}
              value={setup[f.name] || ""}
              onChange={handleChange}
              className={`border rounded px-1 py-0.5 text-sm ${InputW}`}
            />
            {f.unit && <span className="text-xs text-gray-500">{f.unit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InputShort({
  label,
  name,
  unit,
  handleChange,
  setup,
  LabelW,
  InputW,
}: {
  label: string;
  name: string;
  unit?: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setup: Record<string, any>;
  LabelW: string;
  InputW: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className={`text-xs text-gray-600 ${LabelW}`}>{label}</label>
      <input
        type="text"
        name={name}
        value={setup[name] || ""}
        onChange={handleChange}
        className={`border rounded px-1 py-0.5 text-sm ${InputW}`}
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}

function WingTable({
  title,
  row1Label,
  row2Label,
  posName1,
  degName1,
  posName2,
  degName2,
  setup,
  onChange,
  InputW,
}: {
  title: string;
  row1Label: string;
  row2Label: string;
  posName1: string;
  degName1: string;
  posName2: string;
  degName2: string;
  setup: Record<string, any>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  InputW: string;
}) {
  return (
    <div className="border rounded-lg p-3 w-full text-sm bg-gray-50 text-center">
      <h3 className="font-semibold mb-2">{title}</h3>
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
            <td className="border px-2 py-1 text-left">{row1Label}</td>
            <td className="border px-2 py-1">
              <input
                type="text"
                name={posName1}
                value={setup[posName1] || ""}
                onChange={onChange}
                className={`border rounded px-1 ${InputW}`}
              />
            </td>
            <td className="border px-2 py-1">
              <input
                type="text"
                name={degName1}
                value={setup[degName1] || ""}
                onChange={onChange}
                className={`border rounded px-1 ${InputW}`}
              />
            </td>
          </tr>
          <tr>
            <td className="border px-2 py-1 text-left">{row2Label}</td>
            <td className="border px-2 py-1">
              <input
                type="text"
                name={posName2}
                value={setup[posName2] || ""}
                onChange={onChange}
                className={`border rounded px-1 ${InputW}`}
              />
            </td>
            <td className="border px-2 py-1">
              <input
                type="text"
                name={degName2}
                value={setup[degName2] || ""}
                onChange={onChange}
                className={`border rounded px-1 ${InputW}`}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
