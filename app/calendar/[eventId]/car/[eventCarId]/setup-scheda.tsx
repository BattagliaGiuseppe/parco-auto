"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SetupData = Record<string, any>;
type HistoryEntry = { id: string; created_at: string; extras: SetupData };

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const [setup, setSetup] = useState<SetupData>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Carica dati correnti + ultimi 5 salvataggi
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("event_car_setup")
        .select("extras")
        .eq("event_car_id", eventCarId)
        .maybeSingle();

      if (data?.extras) setSetup(data.extras);

      const { data: historyData } = await supabase
        .from("event_car_setup_history")
        .select("id, created_at, extras")
        .eq("event_car_id", eventCarId)
        .order("created_at", { ascending: false })
        .limit(5);

      setHistory(historyData || []);
    })();
  }, [eventCarId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSetup((prev) => ({ ...prev, [name]: value }));
  };

  async function saveToDB() {
    setSaving(true);
    const payload = { event_car_id: eventCarId, extras: setup };
    const { error } = await supabase.from("event_car_setup").upsert(payload);
    if (!error) {
      await supabase.from("event_car_setup_history").insert([
        { event_car_id: eventCarId, extras: setup },
      ]);
      const { data: historyData } = await supabase
        .from("event_car_setup_history")
        .select("id, created_at, extras")
        .eq("event_car_id", eventCarId)
        .order("created_at", { ascending: false })
        .limit(5);
      setHistory(historyData || []);
      alert("✅ Scheda salvata");
    } else alert("❌ Errore salvataggio: " + error.message);
    setSaving(false);
  }

  function exportPDF() {
    window.print();
  }

  function loadHistory(entry: HistoryEntry) {
    if (confirm("Vuoi caricare questo setup salvato?")) setSetup(entry.extras);
  }

  return (
    <div className="print-container p-4 flex flex-col gap-4 bg-white text-gray-800">

      {/* HEADER (solo su schermo, non in stampa) */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl md:text-2xl font-bold uppercase">Gestione Setup Griiip G1</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={saveToDB}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold"
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

      {/* LOGO (solo stampa) */}
      <div className="hidden print:flex justify-center mb-2">
        <Image src="/logo-stampa.png" alt="Logo Battaglia Racing" width={180} height={120} />
      </div>

      {/* TITOLO */}
      <h1 className="text-2xl font-bold text-center uppercase">Setup Griiip G1 — Scheda Tecnica</h1>

      {/* --- GRIGLIA PRINCIPALE --- */}
      <div className="scheda-grid mx-auto text-sm">

        {/* ---------- ANTERIORE SX ---------- */}
        <div>
          <div className="border rounded-lg p-2 w-full text-sm bg-gray-50 mb-1">
            <h3 className="font-semibold text-center mb-1">Info Generali</h3>
            <InputShort label="Data" name="data" handleChange={handleChange} setup={setup} />
            <InputShort label="Autodromo" name="autodromo" handleChange={handleChange} setup={setup} />
            <InputShort label="Telaio" name="telaio" handleChange={handleChange} setup={setup} />
          </div>
          <Image src="/in-alto-a-sinistra.png" alt="in alto sinistra" width={220} height={100} />
          <ZoneBox
            title="Anteriore SX"
            fields={[
              { name: "pesoAntSx", label: "Peso", unit: "Kg" },
              { name: "camberAntSxDeg", label: "Camber", unit: "°" },
              { name: "camberAntSxMm", label: "Camber", unit: "mm" },
              { name: "toeOutSxMm", label: "Toe out", unit: "mm" },
              { name: "toeOutSxDeg", label: "Toe out", unit: "°" },
              { name: "pressioneAntSx", label: "Pressione", unit: "bar" },
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

        {/* ---------- CENTRO ALTO: ALA ANT + MACCHINA ---------- */}
        <div>
          <Image src="/in-alto-al-centro.png" alt="in alto centro" width={360} height={140} />
          <WingTable
            title="Ala Anteriore"
            rows={[
              { label: "Ala", pos: "alaAntPosizione", gradi: "alaAntGradi" },
              { label: "Flap", pos: "flapAntPosizione", gradi: "flapAntGradi" },
            ]}
            setup={setup}
            onChange={handleChange}
          />
          <Image
            src="/macchina-al-centro.png"
            alt="macchina"
            width={440}
            height={440}
            className="mx-auto -mt-4"
          />
        </div>

        {/* ---------- ANTERIORE DX ---------- */}
        <div>
          <Image src="/in-alto-a-destra.png" alt="in alto destra" width={220} height={100} />
          <ZoneBox
            title="Anteriore DX"
            fields={[
              { name: "pesoAntDx", label: "Peso", unit: "Kg" },
              { name: "camberAntDxDeg", label: "Camber", unit: "°" },
              { name: "camberAntDxMm", label: "Camber", unit: "mm" },
              { name: "toeOutDxMm", label: "Toe out", unit: "mm" },
              { name: "toeOutDxDeg", label: "Toe out", unit: "°" },
              { name: "pressioneAntDx", label: "Pressione", unit: "bar" },
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

        {/* ---------- POSTERIORE SX ---------- */}
        <div>
          <ZoneBox
            title="Posteriore SX"
            fields={[
              { name: "pesoPostSx", label: "Peso", unit: "Kg" },
              { name: "camberPostSxDeg", label: "Camber", unit: "°" },
              { name: "camberPostSxMm", label: "Camber", unit: "mm" },
              { name: "toeInSxMm", label: "Toe in", unit: "mm" },
              { name: "toeInSxDeg", label: "Toe in", unit: "°" },
              { name: "pressionePostSx", label: "Pressione", unit: "bar" },
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
          <Image src="/in-basso-a-sinistra.png" alt="in basso sinistra" width={220} height={100} />
          <div className="border rounded-lg p-2 w-full text-sm bg-gray-50">
            <h3 className="font-semibold text-center mb-2">Ripartizione e Rake</h3>
            <InputShort label="Ripartitore" name="ripartitore" unit="%" handleChange={handleChange} setup={setup} />
            <InputShort label="Rake" name="rake" unit="°" handleChange={handleChange} setup={setup} />
          </div>
        </div>

        {/* ---------- CENTRO BASSO: ALA POST ---------- */}
        <div>
          <WingTable
            title="Ala Posteriore"
            rows={[
              { label: "Beam", pos: "beamPosizione", gradi: "beamGradi" },
              { label: "Main", pos: "mainPosizione", gradi: "mainGradi" },
            ]}
            setup={setup}
            onChange={handleChange}
          />
        </div>

        {/* ---------- POSTERIORE DX ---------- */}
        <div>
          <ZoneBox
            title="Posteriore DX"
            fields={[
              { name: "pesoPostDx", label: "Peso", unit: "Kg" },
              { name: "camberPostDxDeg", label: "Camber", unit: "°" },
              { name: "camberPostDxMm", label: "Camber", unit: "mm" },
              { name: "toeInDxMm", label: "Toe in", unit: "mm" },
              { name: "toeInDxDeg", label: "Toe in", unit: "°" },
              { name: "pressionePostDx", label: "Pressione", unit: "bar" },
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
          <Image src="/in-basso-a-destra.png" alt="in basso destra" width={300} height={130} />
        </div>
      </div>

      {/* NOTE */}
      <div className="border rounded-lg p-4 w-full max-w-6xl bg-gray-50 mx-auto">
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
        .scheda-grid {
          display: grid;
          grid-template-columns: 280px 440px 280px;
          grid-template-rows: auto auto;
          justify-content: center;
          align-items: start;
          column-gap: 1.5rem;
          row-gap: 1.5rem;
        }
        .scheda-grid > div {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .scheda-grid img {
          max-width: 100%;
          height: auto !important;
          object-fit: contain;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 1.2cm;
          }
          aside, nav, footer, button {
            display: none !important;
          }
          body, main, div {
            background: white !important;
            box-shadow: none !important;
          }
          .print-container {
            max-width: 19cm !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------- COMPONENTI ---------------- */

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
              className="border rounded px-1 py-0.5 text-sm w-16"
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

function WingTable({ title, rows, setup, onChange }: any) {
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
          {rows.map((r: any) => (
            <tr key={r.label}>
              <td className="border px-2 py-1 text-left">{r.label}</td>
              <td className="border px-2 py-1">
                <input type="text" name={r.pos} value={setup[r.pos] || ""} onChange={onChange} className="w-20 border rounded px-1" />
              </td>
              <td className="border px-2 py-1">
                <input type="text" name={r.gradi} value={setup[r.gradi] || ""} onChange={onChange} className="w-20 border rounded px-1" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
