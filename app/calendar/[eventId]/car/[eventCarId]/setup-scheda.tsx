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

  // 🔹 Caricamento automatico
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
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
    <div className="print-container p-4 flex flex-col gap-4 bg-white text-gray-800 mx-auto max-w-[19cm]">
      {/* HEADER pulsanti (sticky su mobile, nascosto in stampa) */}
      <div className="flex items-center justify-between print:hidden sticky top-0 bg-white py-2 z-50 border-b">
        <h1 className="text-lg md:text-xl font-bold uppercase">
          Gestione Setup Griiip G1
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={saveToDB}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-sm"
          >
            {saving ? "Salvo…" : "💾 Salva"}
          </button>
          <button
            onClick={exportPDF}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-sm"
          >
            📤 Esporta
          </button>
        </div>
      </div>

      {/* LOGO per stampa */}
      <div className="hidden print:flex justify-center mb-4">
        <Image
          src="/logo-stampa.png"
          alt="Logo Battaglia Racing"
          width={160}
          height={100}
        />
      </div>

      {/* TITOLO */}
      <h1 className="text-xl md:text-2xl font-bold text-center uppercase">
        Setup Griiip G1 — Scheda Tecnica
      </h1>

      {/* CONTENUTO RESPONSIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full text-sm leading-tight">
        {/* COLONNA SX */}
        <div className="flex flex-col items-center gap-3 w-full">
          <Image
            src="/in-alto-a-sinistra.png"
            alt="in alto sinistra"
            width={180}
            height={80}
            className="w-full h-auto max-w-[250px]"
          />
          <ZoneBox
            title="Anteriore SX"
            fields={[
              { name: "pesoAntSx", label: "Peso", unit: "Kg" },
              { name: "camberAntSx", label: "Camber", unit: "°" },
              { name: "toeOutSx", label: "Toe out", unit: "mm" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <ZoneBox
            title="Posteriore SX"
            fields={[
              { name: "pesoPostSx", label: "Peso", unit: "Kg" },
              { name: "camberPostSx", label: "Camber", unit: "°" },
              { name: "toeInSx", label: "Toe in", unit: "mm" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <Image
            src="/in-basso-a-sinistra.png"
            alt="in basso sinistra"
            width={180}
            height={80}
            className="w-full h-auto max-w-[250px]"
          />
        </div>

        {/* COLONNA CENTRALE */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/in-alto-al-centro.png"
            alt="in alto centro"
            width={300}
            height={100}
            className="w-full h-auto max-w-[300px]"
          />
          <Image
            src="/macchina-al-centro.png"
            alt="macchina"
            width={380}
            height={380}
            className="w-full h-auto max-w-[380px]"
          />
          <ZoneBox
            title="Ala Posteriore"
            fields={[
              { name: "beam", label: "Beam", unit: "°" },
              { name: "main", label: "Main", unit: "°" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
        </div>

        {/* COLONNA DX */}
        <div className="flex flex-col items-center gap-3 w-full">
          <Image
            src="/in-alto-a-destra.png"
            alt="in alto destra"
            width={180}
            height={80}
            className="w-full h-auto max-w-[250px]"
          />
          <ZoneBox
            title="Anteriore DX"
            fields={[
              { name: "pesoAntDx", label: "Peso", unit: "Kg" },
              { name: "camberAntDx", label: "Camber", unit: "°" },
              { name: "toeOutDx", label: "Toe out", unit: "mm" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <ZoneBox
            title="Posteriore DX"
            fields={[
              { name: "pesoPostDx", label: "Peso", unit: "Kg" },
              { name: "camberPostDx", label: "Camber", unit: "°" },
              { name: "toeInDx", label: "Toe in", unit: "mm" },
            ]}
            handleChange={handleChange}
            setup={setup}
          />
          <Image
            src="/in-basso-a-destra.png"
            alt="in basso destra"
            width={180}
            height={80}
            className="w-full h-auto max-w-[250px]"
          />
        </div>
      </div>

      {/* NOTE */}
      <div className="border rounded-lg p-3 w-full bg-gray-50 mt-2">
        <h3 className="font-semibold mb-1">Note</h3>
        <textarea
          name="note"
          value={setup.note || ""}
          onChange={handleChange}
          rows={3}
          className="w-full border rounded p-2 text-xs"
          placeholder="Annotazioni, modifiche, sensazioni del pilota..."
        />
      </div>

      {/* CRONOLOGIA SALVATAGGI */}
      <div className="border-t pt-3 mt-4 print:hidden">
        <h3 className="font-semibold mb-2 text-gray-800">🕓 Ultimi salvataggi</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun salvataggio disponibile.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between border rounded px-3 py-1 text-sm hover:bg-gray-50 cursor-pointer"
                onClick={() => loadHistory(h)}
              >
                <span>{new Date(h.created_at).toLocaleString()}</span>
                <span className="text-yellow-600 font-semibold">🔄 Apri</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* STILI DI STAMPA */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
          aside,
          nav,
          footer,
          button,
          .border-t.pt-3,
          .sticky.top-0 {
            display: none !important;
          }
          body,
          main,
          div {
            background: white !important;
            box-shadow: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 19cm !important;
            margin: 0 auto !important;
          }
          html,
          body {
            -webkit-print-color-adjust: exact !important;
            overflow: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------- COMPONENTI ------------------- */
function ZoneBox({
  title,
  fields,
  handleChange,
  setup,
}: {
  title: string;
  fields: { name: string; label: string; unit?: string }[];
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setup: Record<string, any>;
}) {
  return (
    <div className="border rounded-lg p-2 w-full text-sm bg-gray-50">
      <h3 className="font-semibold text-center mb-2">{title}</h3>
      <div className="flex flex-col gap-1">
        {fields.map((f) => (
          <div key={f.name} className="flex items-center justify-between gap-2">
            <label className="text-xs text-gray-600 w-24">{f.label}</label>
            <input
              type="text"
              name={f.name}
              value={setup[f.name] || ""}
              onChange={handleChange}
              className="border rounded px-1 py-0.5 text-sm w-14 text-center"
            />
            {f.unit && (
              <span className="text-xs text-gray-500 shrink-0">{f.unit}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
