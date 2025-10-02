"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Info, List, Grid, Search, X } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type ComponentBase = { type: string; identifier: string };
type ComponentExp = { type: string; identifier: string; expiry: string }; // YYYY-MM-DD

export default function CarsPage() {
  const router = useRouter();

  const [cars, setCars] = useState<any[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");
  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState<"auto" | "component">("auto");

  // modal add
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");

  const [baseComponents, setBaseComponents] = useState<ComponentBase[]>([
    { type: "motore", identifier: "" },
    { type: "cambio", identifier: "" },
    { type: "differenziale", identifier: "" },
  ]);

  const plusYears = (n: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + n);
    return d.toISOString().slice(0, 10);
  };

  const [expiringComponents, setExpiringComponents] = useState<ComponentExp[]>([
    { type: "cinture", identifier: "Cinture di sicurezza", expiry: plusYears(5) },
    { type: "cavi", identifier: "Cavi ritenuta ruote", expiry: plusYears(2) },
    { type: "estintore", identifier: "Estintore", expiry: plusYears(2) },
    { type: "serbatoio", identifier: "Serbatoio carburante", expiry: plusYears(5) },
    { type: "passaporto", identifier: "Passaporto tecnico", expiry: plusYears(10) },
  ]);

  useEffect(() => {
    setBaseComponents((prev) =>
      prev.map((b) => ({
        ...b,
        identifier: b.identifier || `${name || "Auto"} - ${capitalize(b.type)}`
      }))
    );
  }, [name]);

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("id, name, chassis_number, components(id, type, identifier, expiry_date, is_active)")
      .order("id", { ascending: true });

    if (!error) setCars(data || []);
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

  const filteredCars = cars.filter((car) => {
    if (!search.trim()) return true;
    if (searchBy === "auto") {
      return (
        car.name?.toLowerCase().includes(search.toLowerCase()) ||
        car.chassis_number?.toLowerCase().includes(search.toLowerCase())
      );
    } else {
      return (car.components || []).some((comp: any) =>
        `${comp.type} ${comp.identifier}`.toLowerCase().includes(search.toLowerCase())
      );
    }
  });

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

      const toInsert = [
        ...baseComponents.map((b) => ({
          type: b.type,
          identifier: b.identifier || `${name} - ${capitalize(b.type)}`,
          car_id: newCar.id,
          is_active: true,
        })),
        ...expiringComponents.map((e) => ({
          type: e.type,
          identifier: e.identifier,
          car_id: newCar.id,
          expiry_date: e.expiry,
          is_active: true,
        })),
      ];

      const { error: compErr } = await supabase.from("components").insert(toInsert);
      if (compErr) throw compErr;

      setOpenAdd(false);
      setName("");
      setChassis("");
      fetchCars();
    } catch (e) {
      console.error("Errore salvataggio auto:", e);
      alert("Errore nel salvataggio. Controlla la console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestione Auto</h1>
          <div className="mt-3">
            <Image
              src="/mia-foto.png"
              alt="La mia auto"
              width={960}
              height={480}
              priority
              className="rounded-xl w-full max-w-3xl h-auto"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          {/* Ricerca */}
          <div className="flex items-center border rounded-lg px-3 py-2 bg-white shadow-sm">
            <Search className="text-gray-500 mr-2" size={18} />
            <input
              type="text"
              placeholder={`Cerca per ${searchBy === "auto" ? "auto" : "componente"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-sm w-48 md:w-72"
            />
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value as any)}
              className="ml-2 text-sm border rounded px-2 py-1"
            >
              <option value="auto">Auto</option>
              <option value="component">Componenti</option>
            </select>
          </div>

          {/* Switch vista */}
          <button
            onClick={() => setView(view === "sintetica" ? "dettagliata" : "sintetica")}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg flex items-center gap-2 font-bold"
          >
            {view === "sintetica" ? (
              <>
                <Grid size={18} /> Vista dettagliata
              </>
            ) : (
              <>
                <List size={18} /> Vista sintetica
              </>
            )}
          </button>

          {/* Aggiungi Auto */}
          <button
            onClick={() => setOpenAdd(true)}
            className="bg-black hover:bg-gray-900 text-yellow-500 px-4 py-2 rounded-lg font-bold"
          >
            + Aggiungi Auto
          </button>
        </div>
      </div>

      {/* Lista Auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCars.map((car) => (
          <div
            key={car.id}
            className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
          >
            <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">{car.name}</h2>
                <span className="text-sm opacity-80">{car.chassis_number}</span>
              </div>

              {view === "sintetica" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/cars/${car.id}`)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-2 rounded-lg flex items-center gap-2 font-bold"
                  >
                    <Edit size={16} /> Modifica
                  </button>
                  <button
                    onClick={() => router.push(`/cars/${car.id}`)}
                    className="bg-gray-200 hover:bg-gray-300 text-black px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Info size={16} /> Dettagli
                  </button>
                </div>
              )}
            </div>

            <div className="p-4">
              {view === "dettagliata" && (
                <>
                  <div className="flex flex-col gap-2">
                    {(car.components || []).map((comp: any) => (
                      <div
                        key={comp.id}
                        className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg"
                      >
                        <span>
                          {comp.type} – {comp.identifier}
                        </span>
                        {comp.expiry_date && (
                          <span className={`font-bold ${getExpiryColor(comp.expiry_date)}`}>
                            {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => router.push(`/cars/${car.id}`)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-2 rounded-lg flex items-center gap-2 font-bold"
                    >
                      <Edit size={16} /> Modifica
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL Aggiungi Auto */}
      {openAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => !saving && setOpenAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className={`bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden ${audiowide.className}`}>
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">Aggiungi Auto</h3>
                <button
                  onClick={() => !saving && setOpenAdd(false)}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  <X />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dati auto */}
                <div className="space-y-3">
                  <label className="block text-sm text-gray-700">Nome auto</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Es. GT3 #12"
                  />
                  <label className="block text-sm text-gray-700 mt-3">Numero telaio</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={chassis}
                    onChange={(e) => setChassis(e.target.value)}
                    placeholder="Es. ZN6-000123"
                  />
                </div>

                {/* Componenti base */}
                <div className="space-y-3">
                  <p className="font-semibold text-gray-800">Componenti base</p>
                  {baseComponents.map((b, idx) => (
                    <div key={b.type} className="flex items-center gap-2">
                      <span className="w-32 text-sm text-gray-600 capitalize">{b.type}</span>
                      <input
                        className="border rounded-lg p-2 w-full"
                        value={b.identifier}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBaseComponents((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, identifier: v } : x))
                          );
                        }}
                        placeholder={`${name || "Auto"} - ${capitalize(b.type)}`}
                      />
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
                        <input
                          className="col-span-2 border rounded-lg p-2"
                          value={e.identifier}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setExpiringComponents((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, identifier: v } : x))
                            );
                          }}
                        />
                        <input
                          type="date"
                          className="col-span-2 border rounded-lg p-2"
                          value={e.expiry}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setExpiringComponents((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, expiry: v } : x))
                            );
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => setOpenAdd(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-black"
                >
                  Annulla
                </button>
                <button
                  onClick={onSaveCar}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  {saving ? "Salvataggio..." : "Salva auto"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
