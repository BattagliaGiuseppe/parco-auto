"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Save, CheckCircle2, RotateCcw } from "lucide-react";

type DataRow = {
  id: string;
  event_car_id: string;
  section: "setup";
  data: Record<string, string | number | null>;
  created_at: string;
};

type SetupValue = string | number | null;

type SetupState = Record<string, SetupValue>;

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

type FieldConfig = {
  name: string;
  label: string;
  unit?: string;
};

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const [setup, setSetup] = useState<SetupState>({});
  const [saving, setSaving] = useState(false);
  const [setupHistory, setSetupHistory] = useState<DataRow[]>([]);
  const [activeSetupId, setActiveSetupId] = useState<string | null>(null);
  const [lastSetupTime, setLastSetupTime] = useState<string | null>(null);
  const [setupTick, setSetupTick] = useState(0);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 2500);
  };

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
      showToast(`Errore caricamento storico setup: ${error.message}`, "error");
      return;
    }

    setSetupHistory((data as DataRow[]) || []);
  }

  async function handleSave() {
    try {
      setSaving(true);

      const payload = {
        event_car_id: eventCarId,
        section: "setup" as const,
        data: setup,
      };

      const { error } = await supabase.from("event_car_data").insert([payload]);
      if (error) throw new Error(error.message);

      await loadHistory();
      setSetupTick((t) => t + 1);
      setLastSetupTime(new Date().toLocaleString());
      showToast("💾 Setup salvato con successo");
    } catch (error: any) {
      showToast(`Errore durante il salvataggio: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  function handleLoadSetup(row: DataRow) {
    if (!row?.data) return;
    setSetup(row.data);
    setActiveSetupId(row.id);
    setLastSetupTime(new Date(row.created_at).toLocaleString());
    showToast("🔄 Setup caricato");
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSetup((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-4 flex flex-col items-center gap-8 bg-white text-gray-800">
      <h1 className="text-2xl font-bold text-center uppercase">
        Setup Griiip G1 — Scheda Tecnica
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
        {/* ZONA 2: ANTERIORE SX */}
        <div className="flex flex-col items-center gap-3">
          <div className="border rounded-lg p-2 w-full text-sm bg-gray-50 mb-2">
            <h3 className="font-semibold text-center mb-1">Info Generali</h3>
            <div className="flex flex-col gap-1">
              <InputShort label="Data" name="data" handleChange={handleChange} setup={setup} wide />
              <InputShort
                label="Autodromo"
                name="autodromo"
                handleChange={handleChange}
                setup={setup}
                wide
              />
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

        {/* ZONA 1: ALA ANTERIORE */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/in-alto-al-centro.png" alt="in alto centro" width={360} height={160} />
          <div className="border rounded-lg p-3 w-full text-sm bg-gray-50 text-center">
            <h3 className="font-semibold mb-2">Ala Anteriore</h3>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr>
                  <td className="border px-2 py-1 text-left">Ala</td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="alaAntPosizione"
                      value={String(setup.alaAntPosizione ?? "")}
                      onChange={handleChange}
                      className="w-20 border rounded px-1"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="alaAntGradi"
                      value={String(setup.alaAntGradi ?? "")}
                      onChange={handleChange}
                      className="w-20 border rounded px-1"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ZONA 3: ANTERIORE DX */}
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

        {/* ZONA 4: POSTERIORE SX */}
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

        {/* ZONA 5: ALA POSTERIORE + macchina */}
        <div className="flex flex-col items-center gap-3 relative">
          <div className="relative -translate-y-[25%]">
            <Image
              src="/macchina-al-centro.png"
              alt="macchina"
              width={460}
              height={460}
              className="mx-auto"
            />
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
                    <input
                      type="text"
                      name="beamPosizione"
                      value={String(setup.beamPosizione ?? "")}
                      onChange={handleChange}
                      className="w-20 border rounded px-1"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="beamGradi"
                      value={String(setup.beamGradi ?? "")}
                      onChange={handleChange}
                      className="w-20 border rounded px-1"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 text-left">Main</td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="mainPosizione"
                      value={String(setup.mainPosizione ?? "")}
                      onChange={handleChange}
                      className="w-20 border rounded px-1"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      name="mainGradi"
                      value={String(setup.mainGradi ?? "")}
                      onChange={handleChange}
                      className="w-20 border rounded px-1"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ZONA 6: POSTERIORE DX */}
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

      {/* NOTE + SALVA */}
      <div className="border rounded-lg p-4 w-full max-w-6xl bg-gray-50">
        <h3 className="font-semibold mb-2">Note</h3>
        <textarea
          name="note"
          value={String(setup.note ?? "")}
          onChange={handleChange}
          rows={3}
          className="w-full border rounded p-2 text-sm"
          placeholder="Annotazioni, modifiche, sensazioni del pilota..."
        />
      </div>

      <div className="flex justify-center mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-sm"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Salva Setup
          <CheckCircle2
            size={18}
            className={`transition-opacity ${
              setupTick ? "opacity-100 text-green-700" : "opacity-0"
            }`}
          />
        </button>
      </div>

      {lastSetupTime && (
        <p className="text-xs text-gray-500 text-center mb-4">
          Ultimo salvataggio: {lastSetupTime}
        </p>
      )}

      <HistoryBar
        title="Ultimi 3 salvataggi Setup"
        rows={setupHistory}
        onOpen={handleLoadSetup}
        activeId={activeSetupId}
      />

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-lg shadow-lg font-semibold ${
            toast.type === "success"
              ? "bg-yellow-400 text-black"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function ZoneBox({
  title,
  fields,
  handleChange,
  setup,
  singleColumn = false,
}: {
  title: string;
  fields: FieldConfig[];
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setup: SetupState;
  singleColumn?: boolean;
}) {
  return (
    <div className="border rounded-lg p-2 w-full text-sm bg-gray-50">
      <h3 className="font-semibold text-center mb-2">{title}</h3>
      <div className={singleColumn ? "flex flex-col gap-1" : "grid grid-cols-2 gap-1"}>
        {fields.map((f) => (
          <div key={f.name} className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-28">{f.label}</label>
            <input
              type="text"
              name={f.name}
              value={String(setup[f.name] ?? "")}
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

function InputShort({
  label,
  name,
  unit,
  handleChange,
  setup,
  wide = false,
}: {
  label: string;
  name: string;
  unit?: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setup: SetupState;
  wide?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 w-24">{label}</label>
      <input
        type="text"
        name={name}
        value={String(setup[name] ?? "")}
        onChange={handleChange}
        className={`border rounded px-1 py-0.5 text-sm ${wide ? "w-64" : "w-20"}`}
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}

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
