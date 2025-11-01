"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import type { Database } from "@/types/supabase"; // opzionale se hai tipi
import { RotateCcw } from "lucide-react";

// Riutilizziamo la stessa interfaccia dati del page.tsx
type DataRow = {
  id: string;
  event_car_id: string;
  section: "setup";
  data: any;
  created_at: string;
};

// ✅ Componente principale
export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const [setup, setSetup] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [setupHistory, setSetupHistory] = useState<DataRow[]>([]);
  const [activeSetupId, setActiveSetupId] = useState<string | null>(null);
  const [lastSetupTime, setLastSetupTime] = useState<string | null>(null);
  const [setupTick, setSetupTick] = useState(0);

  // -------------------------------
  // Carica storico (ultimi 3 salvataggi)
  // -------------------------------
  useEffect(() => {
    loadHistory();
  }, [eventCarId]);

  async function loadHistory() {
    const { data, error } = await supabase
      .from("event_car_data")
      .select("*")
      .eq("event_car_id", eventCarId)
      .eq("section", "setup")
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Errore caricamento storico setup:", error.message);
      return;
    }

    setSetupHistory(data || []);
  }

  // -------------------------------
  // Salva setup
  // -------------------------------
  async function handleSave() {
    try {
      setSaving(true);
      const payload = { event_car_id: eventCarId, section: "setup", data: setup };
      const { error } = await supabase.from("event_car_data").insert([payload]);
      if (error) throw new Error(error.message);

      await loadHistory();
      setSetupTick((t) => t + 1);
      setLastSetupTime(new Date().toLocaleString());

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
      } as CSSStyleDeclaration);
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (error: any) {
      alert("Errore durante il salvataggio: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------
  // Apri uno dei setup salvati
  // -------------------------------
  function handleLoadSetup(row: DataRow) {
    if (!row?.data) return;
    setSetup(row.data);
    setActiveSetupId(row.id);
    setLastSetupTime(new Date(row.created_at).toLocaleString());
  }

  // -------------------------------
  // Gestione input
  // -------------------------------
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">

        {/* ---------- ZONA 2: ANTERIORE SX + intestazione ---------- */}
        <div className="flex flex-col items-center gap-3">
          <div className="border rounded-lg p-2 w-full text-sm bg-gray-50 mb-2">
            <h3 className="font-semibold text-center mb-1">Info Generali</h3>
            <div className="flex flex-col gap-1">
              <InputShort label="Data" name="data" handleChange={handleChange} setup={setup} wide />
              <InputShort label="Autodromo" name="autodromo" handleChange={handleChange} setup={setup} wide />
              <InputShort label="Telaio" name="telaio" handleChange={handleChange} setup={setup} wide />
            </div>
          </div>

          <Image src="/in-alto-a-sinistra.png" alt="in alto sinistra" width={220} height={100} />

          <ZoneBox
            title="Anteriore SX"
            singleColumn
            fields={[
              { name: "pesoAntSx", label: "Peso", unit: "Kg" },
              { name: "camberAntSxDeg", label: "Camber", unit: "°" },
              { name: "toeOutSxMm", label: "Toe out", unit: "mm" },
              { name: "pressioneAntSx", label: "Pressione", unit: "bar" },
              { name: "antirollAntSx", label: "Antirollio" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>

        {/* ---------- ZONA 1: ALA ANTERIORE ---------- */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/in-alto-al-centro.png" alt="in alto centro" width={360} height={160} />
          <div className="border rounded-lg p-3 w-full text-sm bg-gray-50 text-center">
            <h3 className="font-semibold mb-2">Ala Anteriore</h3>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr>
                  <td className="border px-2 py-1 text-left">Ala</td>
                  <td className="border px-2 py-1">
                    <input type="text" name="alaAntPosizione" value={setup.alaAntPosizione || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                  <td className="border px-2 py-1">
                    <input type="text" name="alaAntGradi" value={setup.alaAntGradi || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- ZONA 3: ANTERIORE DX ---------- */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/in-alto-a-destra.png" alt="in alto destra" width={220} height={100} />
          <ZoneBox
            title="Anteriore DX"
            singleColumn
            fields={[
              { name: "pesoAntDx", label: "Peso", unit: "Kg" },
              { name: "camberAntDxDeg", label: "Camber", unit: "°" },
              { name: "toeOutDxMm", label: "Toe out", unit: "mm" },
              { name: "pressioneAntDx", label: "Pressione", unit: "bar" },
              { name: "antirollAntDx", label: "Antirollio" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>

        {/* ---------- ZONA 4, 5, 6 (posteriori + macchina) ---------- */}
        <div className="flex flex-col items-center gap-3">
          <ZoneBox
            title="Posteriore SX"
            singleColumn
            fields={[
              { name: "pesoPostSx", label: "Peso", unit: "Kg" },
              { name: "camberPostSxDeg", label: "Camber", unit: "°" },
              { name: "pressionePostSx", label: "Pressione", unit: "bar" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <Image src="/in-basso-a-sinistra.png" alt="in basso sinistra" width={220} height={100} />
        </div>

        <div className="flex flex-col items-center gap-3">
          <Image src="/macchina-al-centro.png" alt="macchina" width={460} height={460} className="mx-auto" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <ZoneBox
            title="Posteriore DX"
            singleColumn
            fields={[
              { name: "pesoPostDx", label: "Peso", unit: "Kg" },
              { name: "camberPostDxDeg", label: "Camber", unit: "°" },
              { name: "pressionePostDx", label: "Pressione", unit: "bar" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <Image src="/in-basso-a-destra.png" alt="in basso destra" width={300} height={130} />
        </div>
      </div>

      {/* ---------- NOTE + SALVA ---------- */}
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

      {/* Tasto Salva */}
      <div className="flex justify-center mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-sm"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Salva Setup
          <CheckCircle2 size={18} className="text-green-700" />
        </button>
      </div>

      {lastSetupTime && <p className="text-xs text-gray-500 text-center mb-4">Ultimo salvataggio: {lastSetupTime}</p>}

      {/* Storico ultimi 3 salvataggi */}
      <HistoryBar
        title="Ultimi 3 salvataggi Setup"
        rows={setupHistory}
        onOpen={handleLoadSetup}
        activeId={activeSetupId}
      />
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
        className={`border rounded px-1 py-0.5 text-sm ${wide ? "w-64" : "w-20"}`}
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}

/* ---------- HISTORY BAR (riutilizzata dal page.tsx) ---------- */
function HistoryBar({
  title,
  rows,
  onOpen,
  activeId,
}: {
  title: string;
  rows: DataRow[];
  onOpen: (row: DataRow) => void;
  activeId?: string | null;
}) {
  return (
    <div className="mt-4 border-t pt-3 w-full max-w-6xl">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <RotateCcw size={14} /> Storico
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun salvataggio disponibile.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => {
            const isActive = activeId && r.id === activeId;
            return (
              <li
                key={r.id}
                className={`flex items-center justify-between border rounded px-3 py-2 text-sm cursor-pointer transition-all ${
                  isActive ? "bg-yellow-100 border-yellow-400 shadow-inner" : "hover:bg-gray-50"
                }`}
                onClick={() => onOpen(r)}
                title="Apri questo salvataggio"
              >
                <span>{new Date(r.created_at).toLocaleString()}</span>
                {isActive ? (
                  <span className="text-green-700 font-semibold">✅ Aperto</span>
                ) : (
                  <span className="text-yellow-600 font-semibold">🔄 Apri</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

