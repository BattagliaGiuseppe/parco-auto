"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { createClient } from "../../../../../lib/supabaseClient";
import { Button } from "../../../../../components/Button";
import dayjs from "dayjs";

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const supabase = createClient();
  const [setup, setSetup] = useState<any>({});
  const [storico, setStorico] = useState<any[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSetup((prev: any) => ({ ...prev, [name]: value }));
  };

  // 🔹 Carica ultimi 3 salvataggi
  useEffect(() => {
    const fetchStorico = async () => {
      const { data } = await supabase
        .from("event_car_setup")
        .select("*")
        .eq("event_car_id", eventCarId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) setStorico(data);
    };
    fetchStorico();
  }, [eventCarId]);

  // 🔹 Salva setup
  const handleSave = async () => {
    const { error } = await supabase.from("event_car_setup").insert({
      event_car_id: eventCarId,
      section: "setup",
      data: setup,
      created_at: new Date().toISOString(),
    });

    if (!error) {
      alert("💾 Setup salvato con successo!");
      const { data } = await supabase
        .from("event_car_setup")
        .select("*")
        .eq("event_car_id", eventCarId)
        .order("created_at", { ascending: false })
        .limit(3);
      setStorico(data || []);
    }
  };

  // 🔹 Elimina setup
  const handleDelete = async (id: string) => {
    if (confirm("Vuoi eliminare questo salvataggio?")) {
      await supabase.from("event_car_setup").delete().eq("id", id);
      setStorico((prev) => prev.filter((s) => s.id !== id));
    }
  };

  // 🔹 Apri setup salvato
  const handleOpen = (data: any) => {
    setSetup(data.data);
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

        {/* ... resto invariato ... */}
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

      {/* ---------- SALVA E STORICO ---------- */}
      <div className="flex flex-col items-center w-full max-w-6xl gap-4 mt-4">
        <Button
          onClick={handleSave}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded font-semibold"
        >
          💾 Salva
        </Button>

        <div className="border rounded-lg p-4 bg-gray-50 w-full">
          <h3 className="font-semibold mb-2 text-center">Storico Setup (ultimi 3)</h3>
          {storico.length === 0 ? (
            <p className="text-sm text-gray-500 text-center">Nessun salvataggio recente</p>
          ) : (
            <div className="flex flex-col gap-2">
              {storico.map((s) => (
                <div key={s.id} className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm">
                    {dayjs(s.created_at).format("DD/MM/YYYY HH:mm")}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpen(s)}>
                      Apri
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(s.id)}>
                      Elimina
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
