"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Save, RotateCcw, CheckCircle2, Trash2 } from "lucide-react";

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const [setup, setSetup] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [setupHistory, setSetupHistory] = useState<any[]>([]);
  const [activeSetupId, setActiveSetupId] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSetup((prev: any) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    loadHistory();
  }, [eventCarId]);

async function loadHistory() {
  const { data, error } = await supabase
    .from("event_car_data")
    .select("id, created_at, section, setup")
    .eq("event_car_id", eventCarId)
    .eq("section", "setup")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    console.error("Errore caricamento storico:", error.message);
    return;
  }

  console.log("📜 Storico caricato:", data); // 👈 controlla in console

  if (data && data.length > 0) {
    setSetupHistory(data);
  } else {
    setSetupHistory([]);
  }
}

async function handleSave() {
  try {
    setSaving(true);

    // Storico
    await supabase.from("event_car_data").insert([
      { event_car_id: eventCarId, section: "setup", setup },
    ]);

    // Ultimo setup corrente
    const { data: existing } = await supabase
      .from("event_car_setup")
      .select("id")
      .eq("event_car_id", eventCarId)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("event_car_setup").update({ setup }).eq("id", existing.id);
    } else {
      await supabase.from("event_car_setup").insert([{ event_car_id: eventCarId, setup }]);
    }

    await loadHistory();

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

  function handleLoadSetup(row: any) {
    if (!row?.setup) return;
    setSetup(row.setup);
    setActiveSetupId(row.id);
  }

  async function handleDeleteSetup(id: string) {
    if (!confirm("Vuoi eliminare questo salvataggio?")) return;
    const { error } = await supabase.from("event_car_data").delete().eq("id", id);
    if (error) {
      alert("Errore eliminazione: " + error.message);
      return;
    }
    await loadHistory();
    if (id === activeSetupId) setActiveSetupId(null);

    const toast = document.createElement("div");
    toast.textContent = "🗑️ Salvataggio eliminato";
    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      background: "#ef4444",
      color: "#fff",
      padding: "8px 14px",
      borderRadius: "8px",
      fontWeight: "600",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      zIndex: "9999",
    } as CSSStyleDeclaration);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
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
          {/* Mini tabella Data / Autodromo / Telaio */}
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
            width={360}
            height={160}
            className="-mt-2 md:-mt-4"
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
                <tr>
                  <td className="border px-2 py-1 text-left">Ala</td>
                  <td className="border px-2 py-1">
                    <input type="text" name="alaAntPosizione" value={setup.alaAntPosizione || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                  <td className="border px-2 py-1">
                    <input type="text" name="alaAntGradi" value={setup.alaAntGradi || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 text-left">Flap</td>
                  <td className="border px-2 py-1">
                    <input type="text" name="flapAntPosizione" value={setup.flapAntPosizione || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                  <td className="border px-2 py-1">
                    <input type="text" name="flapAntGradi" value={setup.flapAntGradi || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- ZONA 3: ANTERIORE DX ---------- */}
        <div className="flex flex-col items-center gap-3 justify-end">
          <Image src="/in-alto-a-destra.png" alt="in alto destra" width={220} height={100} />
          <ZoneBox
            title="Anteriore DX"
            singleColumn
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

        {/* ---------- ZONA 4: POSTERIORE SX + immagine + Rake ---------- */}
        <div className="flex flex-col items-center gap-3">
          <ZoneBox
            title="Posteriore SX"
            singleColumn
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
          <Image src="/in-basso-a-sinistra.png" alt="in basso sinistra" width={220} height={100} />
          <div className="border rounded-lg p-2 mt-1 w-full text-sm bg-gray-50">
            <h3 className="font-semibold text-center mb-2">Ripartizione e Rake</h3>
            <div className="flex flex-col gap-2 items-center">
              <InputShort label="Ripartitore" name="ripartitore" unit="%" handleChange={handleChange} setup={setup} />
              <InputShort label="Rake" name="rake" unit="°" handleChange={handleChange} setup={setup} />
            </div>
          </div>
        </div>

        {/* ---------- ZONA 5: ALA POSTERIORE + macchina ---------- */}
        <div className="flex flex-col items-center gap-3 relative">
          <div className="relative -translate-y-[25%]">
            <Image src="/macchina-al-centro.png" alt="macchina" width={460} height={460} className="mx-auto" />
          </div>
          <div className="border rounded-lg p-3 w-full text-sm bg-gray-50 text-center -mt-8">
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
                    <input type="text" name="beamPosizione" value={setup.beamPosizione || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                  <td className="border px-2 py-1">
                    <input type="text" name="beamGradi" value={setup.beamGradi || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 text-left">Main</td>
                  <td className="border px-2 py-1">
                    <input type="text" name="mainPosizione" value={setup.mainPosizione || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                  <td className="border px-2 py-1">
                    <input type="text" name="mainGradi" value={setup.mainGradi || ""} onChange={handleChange} className="w-20 border rounded px-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- ZONA 6: POSTERIORE DX ---------- */}
        <div className="flex flex-col items-center gap-3">
          <ZoneBox
            title="Posteriore DX"
            singleColumn
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

      {/* Tasto Salva centrato */}
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
      {/* ---------- STORICO ---------- */}
      <div className="border-t pt-4 w-full max-w-6xl mb-6">
        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <RotateCcw size={16} /> Ultimi 3 salvataggi Setup
        </h3>

        {setupHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun salvataggio disponibile.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {setupHistory.map((r) => {
              const isActive = r.id === activeSetupId;
              return (
                <li
                  key={r.id}
                  className={`flex items-center justify-between border rounded px-3 py-2 text-sm transition-all ${
                    isActive ? "bg-yellow-100 border-yellow-400 shadow-inner" : "hover:bg-gray-50"
                  }`}
                >
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  <div className="flex items-center gap-3">
                    {isActive ? (
                      <span className="text-green-700 font-semibold">✅ Aperto</span>
                    ) : (
                      <button
                        onClick={() => handleLoadSetup(r)}
                        className="text-yellow-600 font-semibold hover:underline"
                      >
                        🔄 Apri
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSetup(r.id)}
                      className="text-red-600 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Elimina
                    </button>
                  </div>
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
        className={`border rounded px-1 py-0.5 text-sm ${wide ? "w-64" : "w-20"}`}
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}
