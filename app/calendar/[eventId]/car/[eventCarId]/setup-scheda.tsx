"use client";

import Image from "next/image";
import { useState } from "react";
import { supabase } from "../../../../../lib/supabase";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const [setup, setSetup] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSetup((prev: any) => ({ ...prev, [name]: value }));
  };

  async function onSaveSetup() {
    try {
      setSaving(true);
      const { error } = await supabase.from("event_car_setup").insert([
        {
          event_car_id: eventCarId,
          setup,
        },
      ]);
      if (error) throw new Error(error.message);

      // Feedback visivo
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      const toast = document.createElement("div");
      toast.textContent = "💾 Setup salvato con successo";
      Object.assign(toast.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        background: "#facc15",
        padding: "8px 14px",
        borderRadius: "8px",
        fontWeight: "600",
        color: "#222",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        zIndex: "9999",
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (e: any) {
      alert("Errore durante il salvataggio: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 flex flex-col items-center gap-8 bg-white text-gray-800">
      <h1 className="text-2xl font-bold text-center uppercase">
        Setup Griiip G1 — Scheda Tecnica
      </h1>

      {/* --- GRIGLIA PRINCIPALE --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
        {/* ---------- ZONA 2: ANTERIORE SX + intestazione ---------- */}
        <div className="flex flex-col items-center gap-3">
          {/* Info generali */}
          <div className="border rounded-lg p-2 w-full text-sm bg-gray-50 mb-2">
            <h3 className="font-semibold text-center mb-1">Info Generali</h3>
            <div className="flex flex-col gap-1">
              <InputShort
                label="Data"
                name="data"
                handleChange={handleChange}
                setup={setup}
                wide
              />
              <InputShort
                label="Autodromo"
                name="autodromo"
                handleChange={handleChange}
                setup={setup}
                wide
              />
              <InputShort
                label="Telaio"
                name="telaio"
                handleChange={handleChange}
                setup={setup}
                wide
              />
            </div>
          </div>

          <Image src="/in-alto-a-sinistra.png" alt="in alto sinistra" width={220} height={100} />

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

        {/* ---------- ZONA 1: CENTRALE CON AUTO ---------- */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/macchina-al-centro.png"
            alt="macchina"
            width={460}
            height={460}
            className="mx-auto"
          />
        </div>

        {/* ---------- ZONA 3: POSTERIORE DX ---------- */}
        <div className="flex flex-col items-center gap-3">
          <ZoneBox
            title="Posteriore DX"
            singleColumn
            fields={[
              { name: "pesoPostDx", label: "Peso", unit: "Kg" },
              { name: "camberPostDxDeg", label: "Camber", unit: "°" },
              { name: "toeInDxMm", label: "Toe in", unit: "mm" },
              { name: "pressionePostDx", label: "Pressione a freddo", unit: "bar" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <Image src="/in-basso-a-destra.png" alt="in basso destra" width={300} height={130} />
        </div>
      </div>

      {/* ---------- NOTE ---------- */}
      <div className="border rounded-lg p-4 w-full max-w-6xl bg-gray-50">
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

      {/* ---------- SALVA ---------- */}
      <div className="flex justify-center mt-6 mb-2">
        <button
          onClick={onSaveSetup}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-sm"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Salva Setup
          <CheckCircle2
            size={18}
            className={`transition-opacity ${saved ? "opacity-100 text-green-600" : "opacity-0"}`}
          />
        </button>
      </div>
    </div>
  );
}

/* ---------- COMPONENTI ---------- */

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
              className="border rounded px-1 py-0.5 text-sm w-20"
            />
            {f.unit && <span className="text-xs text-gray-500">{f.unit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InputShort({ label, name, unit, handleChange, setup, wide = false }: any) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 w-24">{label}</label>
      <input
        type="text"
        name={name}
        value={setup[name] || ""}
        onChange={handleChange}
        className={`border rounded px-1 py-0.5 text-sm ${wide ? "w-72" : "w-20"}`} // ← più largo
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}
