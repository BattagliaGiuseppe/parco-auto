"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Info, List, Grid, Search, FileText, Printer } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type ComponentBase = { type: string; identifier: string };
type ComponentExp = { type: string; identifier: string; expiry: string };
type ComponentType =
  | "motore" | "cambio" | "differenziale"
  | "cinture" | "cavi" | "estintore" | "serbatoio" | "passaporto";

const COMPONENT_TYPES: ComponentType[] = [
  "motore","cambio","differenziale","cinture","cavi","estintore","serbatoio","passaporto"
];

const EXP_RULES: Record<Exclude<ComponentType, "motore"|"cambio"|"differenziale">, number> = {
  cinture: 5, cavi: 2, estintore: 2, serbatoio: 5, passaporto: 10,
};

const defaultLabel: Record<ComponentType, string> = {
  motore: "Motore",
  cambio: "Cambio",
  differenziale: "Differenziale",
  cinture: "Cinture di sicurezza",
  cavi: "Cavi ritenuta ruote",
  estintore: "Estintore",
  serbatoio: "Serbatoio carburante",
  passaporto: "Passaporto tecnico",
};

function addYearsYYYYMMDD(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");

  // ricerca
  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState<"auto" | ComponentType>("auto");

  // modal gestione auto
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState<"add" | "edit" | "view">("add");
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // campi form
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [baseComponents, setBaseComponents] = useState<ComponentBase[]>([]);
  const [expiringComponents, setExpiringComponents] = useState<ComponentExp[]>([]);

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("id, name, chassis_number, components(id, type, identifier, expiry_date, is_active)")
      .order("id", { ascending: true });
    if (!error) setCars(data || []);
  };
  useEffect(() => { fetchCars(); }, []);

  const resetForm = () => {
    setName("");
    setChassis("");
    setBaseComponents([
      { type: "motore", identifier: "" },
      { type: "cambio", identifier: "" },
      { type: "differenziale", identifier: "" },
    ]);
    setExpiringComponents([
      { type: "cinture", identifier: "", expiry: "" },
      { type: "cavi", identifier: "", expiry: "" },
      { type: "estintore", identifier: "", expiry: "" },
      { type: "serbatoio", identifier: "", expiry: "" },
      { type: "passaporto", identifier: "", expiry: "" },
    ]);
  };

  // colori scadenza
  const getExpiryColor = (date: string) => {
    const expiry = new Date(date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());
    if (months > 12) return "text-green-500";
    if (months > 6) return "text-yellow-500";
    return "text-red-500";
  };

  // filtro ricerca
  const filteredCars = cars.filter((car) => {
    if (searchBy === "auto") {
      if (!search.trim()) return true;
      return (
        (car.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (car.chassis_number || "").toLowerCase().includes(search.toLowerCase())
      );
    }
    const comps = (car.components || []).filter((c: any) => c.type === searchBy);
    if (!search.trim()) return comps.length > 0;
    return comps.some((c: any) =>
      (c.identifier || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  // salva nuova auto
  const onSaveCar = async () => {
    if (!name.trim() || !chassis.trim()) return;
    setSaving(true);
    try {
      const { data: newCar, error: carErr } = await supabase
        .from("cars")
        .insert([{ name, chassis_number: chassis }])
        .select()
        .single();
      if (carErr) throw carErr;

      const baseToInsert = baseComponents.map((b) => ({
        type: b.type,
        identifier: b.identifier || `${name} - ${defaultLabel[b.type as ComponentType]}`,
        car_id: newCar.id,
        is_active: true,
      }));

      const expToInsert = expiringComponents.map((e) => {
        const years = EXP_RULES[e.type as keyof typeof EXP_RULES] ?? 2;
        return {
          type: e.type,
          identifier: e.identifier || defaultLabel[e.type as ComponentType],
          car_id: newCar.id,
          expiry_date: e.expiry || addYearsYYYYMMDD(years),
          is_active: true,
        };
      });

      await supabase.from("components").insert([...baseToInsert, ...expToInsert]);

      setOpenModal(false);
      resetForm();
      fetchCars();
    } catch (e) {
      console.error("Errore salvataggio auto:", e);
      alert("Errore nel salvataggio. Controlla la console.");
    } finally {
      setSaving(false);
    }
  };

  // aggiorna auto esistente
  const onUpdateCar = async () => {
    if (!selectedCar) return;
    setSaving(true);
    try {
      const { error: carErr } = await supabase
        .from("cars")
        .update({ name, chassis_number: chassis })
        .eq("id", selectedCar.id);
      if (carErr) throw carErr;

      // aggiorno componenti
      for (const b of baseComponents) {
        await supabase.from("components").update({ identifier: b.identifier }).eq("car_id", selectedCar.id).eq("type", b.type);
      }
      for (const e of expiringComponents) {
        await supabase.from("components").update({ identifier: e.identifier, expiry_date: e.expiry }).eq("car_id", selectedCar.id).eq("type", e.type);
      }

      setOpenModal(false);
      resetForm();
      fetchCars();
    } catch (e) {
      console.error("Errore aggiornamento auto:", e);
      alert("Errore nell'aggiornamento.");
    } finally {
      setSaving(false);
    }
  };

  // apri modal in modalità
  const openAdd = () => { resetForm(); setMode("add"); setOpenModal(true); };
  const openEdit = (car: any) => {
    setSelectedCar(car);
    setName(car.name);
    setChassis(car.chassis_number);
    setBaseComponents(car.components.filter((c: any) => ["motore","cambio","differenziale"].includes(c.type)).map((c: any) => ({ type: c.type, identifier: c.identifier })));
    setExpiringComponents(car.components.filter((c: any) => !["motore","cambio","differenziale"].includes(c.type)).map((c: any) => ({ type: c.type, identifier: c.identifier, expiry: c.expiry_date || "" })));
    setMode("edit");
    setOpenModal(true);
  };
  const openView = (car: any) => {
    openEdit(car);
    setMode("view");
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestione Auto</h1>
          <div className="mt-3">
            <Image src="/mia-foto.png" alt="La mia auto" width={960} height={480} priority className="rounded-xl w-full max-w-3xl h-auto" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          {/* Ricerca */}
          <div className="flex items-center border rounded-lg px-3 py-2 bg-white shadow-sm">
            <Search className="text-gray-500 mr-2" size={18} />
            <input type="text" placeholder={searchBy === "auto" ? "Cerca per nome o telaio…" : `Cerca per ${searchBy} (identificativo)…`} value={search} onChange={(e) => setSearch(e.target.value)} className="outline-none text-sm w-48 md:w-72" />
            <select value={searchBy} onChange={(e) => setSearchBy(e.target.value as any)} className="ml-2 text-sm border rounded px-2 py-1">
              <option value="auto">Auto</option>
              {COMPONENT_TYPES.map((t) => (<option key={t} value={t}>{capitalize(t)}</option>))}
            </select>
          </div>

          {/* Switch vista */}
          <button onClick={() => setView(view === "sintetica" ? "dettagliata" : "sintetica")} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2">
            {view === "sintetica" ? (<><Grid size={18} /> Vista dettagliata</>) : (<><List size={18} /> Vista sintetica</>)}
          </button>

          {/* Aggiungi Auto */}
          <button onClick={openAdd} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg">+ Aggiungi Auto</button>
        </div>
      </div>

      {/* Lista Auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCars.map((car) => (
          <div key={car.id} className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition">
            <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">{car.name}</h2>
                <span className="text-sm opacity-80">{car.chassis_number}</span>
              </div>
              {view === "sintetica" && (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(car)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"><Edit size={16} /> Modifica</button>
                  <button onClick={() => openView(car)} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2"><Info size={16} /> Dettagli</button>
                </div>
              )}
            </div>

            <div className="p-4">
              {view === "dettagliata" ? (
                <>
                  <div className="flex flex-col gap-2">
                    {(car.components || []).map((comp: any) => (
                      <div key={comp.id} className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg">
                        <span>{comp.type} – {comp.identifier}</span>
                        {comp.expiry_date && (<span className={`font-medium ${getExpiryColor(comp.expiry_date)}`}>{new Date(comp.expiry_date).toLocaleDateString("it-IT")}</span>)}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4 gap-2">
                    <button onClick={() => openEdit(car)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"><Edit size={16} /> Modifica</button>
                  </div>
                </>
              ) : (<p className="text-sm text-gray-500">—</p>)}
            </div>

            <div className="px-4 pb-4 flex justify-end gap-2">
              <Link href={`/cars/${car.id}/documents`} className="bg-gray-900 hover:bg-gray-800 text-yellow-500 px-3 py-2 rounded-lg flex items-center gap-2"><FileText size={16} /> Documenti</Link>
              <Link href={`/cars/${car.id}/print`} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2"><Printer size={16} /> Stampa</Link>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL comune per Add/Edit/View */}
      {openModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => !saving && setOpenModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {mode === "add" ? "Aggiungi Auto" : mode === "edit" ? "Modifica Auto" : "Dettagli Auto"}
                </h3>
                <button onClick={() => !saving && setOpenModal(false)} className="p-2 rounded hover:bg-gray-100">✕</button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dati auto */}
                <div className="space-y-3">
                  <label className="block text-sm text-gray-700">Nome auto</label>
                  <input className="border rounded-lg p-2 w-full" value={name} onChange={(e) => setName(e.target.value)} disabled={mode === "view"} />
                  <label className="block text-sm text-gray-700 mt-3">Numero telaio</label>
                  <input className="border rounded-lg p-2 w-full" value={chassis} onChange={(e) => setChassis(e.target.value)} disabled={mode === "view"} />
                </div>

                {/* Componenti base */}
                <div className="space-y-3">
                  <p className="font-semibold text-gray-800">Componenti base</p>
                  {baseComponents.map((b, idx) => (
                    <div key={b.type} className="flex items-center gap-2">
                      <span className="w-32 text-sm text-gray-600 capitalize">{b.type}</span>
                      <input className="border rounded-lg p-2 w-full" value={b.identifier} onChange={(e) => {
                        const v = e.target.value;
                        setBaseComponents((prev) => prev.map((x, i) => (i === idx ? { ...x, identifier: v } : x)));
                      }} disabled={mode === "view"} />
                    </div>
                  ))}
                </div>

                {/* Componenti con scadenza */}
                <div className="md:col-span-2">
                  <p className="font-semibold text-gray-800 mb-2">Componenti con scadenza</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {expiringComponents.map((e, idx) => (
                      <div key={e.type} className="grid grid-cols-5 gap-2 items-center">
                        <span className="col-span-1 text-sm text-gray-600 capitalize">{e.type}</span>
                        <input className="col-span-2 border rounded-lg p-2" value={e.identifier} onChange={(ev) => {
                          const v = ev.target.value;
                          setExpiringComponents((prev) => prev.map((x, i) => (i === idx ? { ...x, identifier: v } : x)));
                        }} disabled={mode === "view"} />
                        <input type="date" className="col-span-2 border rounded-lg p-2" value={e.expiry} onChange={(ev) => {
                          const v = ev.target.value;
                          setExpiringComponents((prev) => prev.map((x, i) => (i === idx ? { ...x, expiry: v } : x)));
                        }} disabled={mode === "view"} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {mode !== "view" && (
                <div className="flex justify-end gap-3 px-6 py-4 border-t">
                  <button onClick={() => setOpenModal(false)} disabled={saving} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800">Annulla</button>
                  <button onClick={mode === "add" ? onSaveCar : onUpdateCar} disabled={saving} className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                    {saving ? "Salvataggio..." : "Salva auto"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
