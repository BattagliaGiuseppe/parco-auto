"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { supabase } from "../../../../../lib/supabase";
import { Loader2, Save, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "../../../../../components/Button";

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const [setup, setSetup] = useState<any>({});
  const [setupHistory, setSetupHistory] = useState<any[]>([]);
  const [activeSetupId, setActiveSetupId] = useState<string | null>(null);
  const [lastSetupTime, setLastSetupTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSetup((prev: any) => ({ ...prev, [name]: value }));
  };

  // Caricamento ultimo setup e storico
  useEffect(() => {
    (async () => {
      const { data: lastSetup } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "setup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSetup?.data) {
        setSetup(lastSetup.data);
        if (lastSetup?.id) setActiveSetupId(lastSetup.id);
        if (lastSetup?.created_at)
          setLastSetupTime(new Date(lastSetup.created_at).toLocaleString());
      }

      const { data: hist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "setup")
        .order("created_at", { ascending: false })
        .limit(3);

      setSetupHistory(hist || []);
    })();
  }, [eventCarId]);

  // Salvataggio setup
  async function onSaveSetup() {
    try {
      setSaving(true);
      const payload = { event_car_id: eventCarId, section: "setup", data: setup };
      const { error } = await supabase.from("event_car_data").insert([payload]);
      if (error) throw new Error(error.message);

      const { data: hist } = await supabase
        .from("event_car_data")
        .select("*")
        .eq("event_car_id", eventCarId)
        .eq("section", "setup")
        .order("created_at", { ascending: false })
        .limit(3);

      setSetupHistory(hist || []);
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
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (e: any) {
      alert("Errore salvataggio setup: " + e.message);
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
        {/* ---------- INFO GENERALI ---------- */}
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
              { name: "pressioneAntSx", label: "Pressione a freddo", unit: "bar" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>

        {/* ---------- ZONA CENTRALE CON AUTO ---------- */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/macchina-al-centro.png"
            alt="macchina"
            width={460}
            height={460}
            className="mx-auto"
          />
        </div>

        {/* ---------- POSTERIORE DX ---------- */}
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
          <CheckCircle2 size={18} className={`transition-opacity ${saving ? "opacity-0" : "opacity-100"}`} />
        </button>
      </div>

      {lastSetupTime && (
        <p className="text-xs text-gray-500 text-center mb-4">
          Ultimo salvataggio: {lastSetupTime}
        </p>
      )}

      {/* ---------- STORICO ---------- */}
      <div className="border-t pt-3 w-full max-w-6xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800 text-sm">Ultimi 3 salvataggi Setup</h3>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <RotateCcw size={14} /> Storico
          </div>
        </div>
        {setupHistory.length === 0 ? (
          <p className="text-sm text-gray-500 text-center">Nessun salvataggio disponibile.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {setupHistory.map((r) => {
              const isActive = r.id === activeSetupId;
              return (
                <li
                  key={r.id}
                  className={`flex items-center justify-between border rounded px-3 py-2 text-sm cursor-pointer transition-all ${
                    isActive
                      ? "bg-yellow-100 border-yellow-400 shadow-inner"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setSetup(r.data);
                    setActiveSetupId(r.id);
                    setLastSetupTime(new Date(r.created_at).toLocaleString());
                  }}
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
        className={`border rounded px-1 py-0.5 text-sm ${wide ? "w-52" : "w-20"}`}
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}
