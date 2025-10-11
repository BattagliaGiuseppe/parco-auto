"use client";

import { useState } from "react";

export default function SetupScheda() {
  const [layout, setLayout] = useState<"affiancato" | "verticale">("affiancato");
  const [data, setData] = useState({
    date: "",
    autodromo: "",
    telaio: "",
    // Aerodinamica
    posizione: "",
    gradi: "",
    ala: "",
    flap: "",
    pesoAnt: "",
    pesoPost: "",
    // Anteriore
    camberAntDeg: "",
    camberAntMm: "",
    toeOutMm: "",
    toeOutDeg: "",
    pressioneAnt: "",
    antirollAnt: "",
    altezzaStaggiaAnt: "",
    altezzaSuoloAnt: "",
    mollaAnt: "",
    precaricoAnt: "",
    idraulicaAnt: "",
    // Posteriore
    camberPostDeg: "",
    camberPostMm: "",
    toeInMm: "",
    toeInDeg: "",
    pressionePost: "",
    antirollPost: "",
    altezzaStaggiaPost: "",
    altezzaSuoloPost: "",
    mollaPost: "",
    precaricoPost: "",
    idraulicaPost: "",
    pesoPostSx: "",
    pesoPostDx: "",
    // Finali
    beam: "",
    main: "",
    ripartitore: "",
    rake: "",
    note: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-6 bg-white border rounded-xl shadow-sm flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800 uppercase">
          Setup Griiip G1 — Scheda Tecnica
        </h1>
        <button
          onClick={() =>
            setLayout(layout === "affiancato" ? "verticale" : "affiancato")
          }
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold rounded-lg"
        >
          {layout === "affiancato"
            ? "🟨 Layout Verticale"
            : "🟦 Layout Affiancato"}
        </button>
      </div>

      {/* Intestazione */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-700">Data</label>
          <input
            type="text"
            name="date"
            value={data.date}
            onChange={handleChange}
            className="w-full border rounded-md p-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Autodromo</label>
          <input
            type="text"
            name="autodromo"
            value={data.autodromo}
            onChange={handleChange}
            className="w-full border rounded-md p-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Telaio</label>
          <input
            type="text"
            name="telaio"
            value={data.telaio}
            onChange={handleChange}
            className="w-full border rounded-md p-2"
          />
        </div>
      </div>

      {/* Aerodinamica */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold text-gray-800 mb-3">Aerodinamica</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InputField label="Posizione" name="posizione" unit="°" value={data.posizione} onChange={handleChange} />
          <InputField label="Gradi" name="gradi" unit="°" value={data.gradi} onChange={handleChange} />
          <InputField label="Ala" name="ala" unit="°" value={data.ala} onChange={handleChange} />
          <InputField label="Flap" name="flap" unit="°" value={data.flap} onChange={handleChange} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <InputField label="Peso Ant." name="pesoAnt" unit="Kg" value={data.pesoAnt} onChange={handleChange} />
          <InputField label="Peso Post." name="pesoPost" unit="Kg" value={data.pesoPost} onChange={handleChange} />
        </div>
      </div>

      {/* Layout dinamico */}
      <div
        className={
          layout === "affiancato"
            ? "grid grid-cols-1 md:grid-cols-2 gap-6"
            : "flex flex-col gap-6"
        }
      >
        {/* Sezione Anteriore */}
        <SectionSetup
          title="Anteriore"
          data={data}
          onChange={handleChange}
          prefix="Ant"
        />

        {/* Sezione Posteriore */}
        <SectionSetup
          title="Posteriore"
          data={data}
          onChange={handleChange}
          prefix="Post"
        />
      </div>

      {/* Sezione finale */}
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Parametri finali</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InputField label="Beam" name="beam" value={data.beam} onChange={handleChange} />
          <InputField label="Main" name="main" value={data.main} onChange={handleChange} />
          <InputField label="Ripartitore" name="ripartitore" unit="%" value={data.ripartitore} onChange={handleChange} />
          <InputField label="Rake" name="rake" unit="°" value={data.rake} onChange={handleChange} />
        </div>
      </div>

      {/* Note */}
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Note</h3>
        <textarea
          name="note"
          value={data.note}
          onChange={handleChange}
          rows={3}
          className="w-full border rounded-md p-2"
          placeholder="Annotazioni, sensazioni pilota, modifiche..."
        />
      </div>
    </div>
  );
}

/* ------------------------- COMPONENTI ------------------------- */

function SectionSetup({
  title,
  data,
  onChange,
  prefix,
}: {
  title: string;
  data: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  prefix: "Ant" | "Post";
}) {
  const isAnt = prefix === "Ant";

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="Camber"
          name={`camber${prefix}Deg`}
          unit="°"
          value={data[`camber${prefix}Deg`]}
          onChange={onChange}
        />
        <InputField
          label="Camber"
          name={`camber${prefix}Mm`}
          unit="mm"
          value={data[`camber${prefix}Mm`]}
          onChange={onChange}
        />
        <InputField
          label={isAnt ? "Toe out" : "Toe in"}
          name={`toe${prefix === "Ant" ? "Out" : "In"}Mm`}
          unit="mm"
          value={data[`toe${prefix === "Ant" ? "Out" : "In"}Mm`]}
          onChange={onChange}
        />
        <InputField
          label={isAnt ? "Toe out" : "Toe in"}
          name={`toe${prefix === "Ant" ? "Out" : "In"}Deg`}
          unit="°"
          value={data[`toe${prefix === "Ant" ? "Out" : "In"}Deg`]}
          onChange={onChange}
        />
        <InputField
          label="Pressione a freddo"
          name={`pressione${prefix}`}
          unit="bar"
          value={data[`pressione${prefix}`]}
          onChange={onChange}
        />
        <InputField
          label="Antirollio"
          name={`antiroll${prefix}`}
          value={data[`antiroll${prefix}`]}
          onChange={onChange}
        />
        <InputField
          label="Altezza a staggia"
          name={`altezzaStaggia${prefix}`}
          unit="mm"
          value={data[`altezzaStaggia${prefix}`]}
          onChange={onChange}
        />
        <InputField
          label="Altezza da suolo"
          name={`altezzaSuolo${prefix}`}
          unit="mm"
          value={data[`altezzaSuolo${prefix}`]}
          onChange={onChange}
        />
        <InputField
          label="Molla"
          name={`molla${prefix}`}
          unit="Lbs"
          value={data[`molla${prefix}`]}
          onChange={onChange}
        />
        <InputField
          label="Precarico"
          name={`precarico${prefix}`}
          unit="giri"
          value={data[`precarico${prefix}`]}
          onChange={onChange}
        />
        <InputField
          label="Idraulica"
          name={`idraulica${prefix}`}
          unit="click"
          value={data[`idraulica${prefix}`]}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function InputField({
  label,
  name,
  unit,
  value,
  onChange,
}: {
  label: string;
  name: string;
  unit?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          className="flex-1 border rounded-md p-2"
        />
        {unit && <span className="text-gray-500 text-sm">{unit}</span>}
      </div>
    </div>
  );
}
