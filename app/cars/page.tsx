"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Info, List, Grid, Search } from "lucide-react";
import { Audiowide } from "next/font/google";
import Image from "next/image";

// Font racing
const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");
  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState<"auto" | "component">("auto");

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

  // Funzione per calcolare colore scadenza
  const getExpiryColor = (date: string) => {
    const expiry = new Date(date);
    const today = new Date();
    const diffMonths =
      (expiry.getFullYear() - today.getFullYear()) * 12 +
      (expiry.getMonth() - today.getMonth());

    if (diffMonths > 12) return "text-green-600";
    if (diffMonths > 6) return "text-yellow-600";
    return "text-red-600";
  };

  // Filtraggio ricerca
  const filteredCars = cars.filter((car) => {
    if (searchBy === "auto") {
      return (
        car.name.toLowerCase().includes(search.toLowerCase()) ||
        car.chassis_number.toLowerCase().includes(search.toLowerCase())
      );
    } else {
      return car.components.some((comp: any) =>
        comp.identifier.toLowerCase().includes(search.toLowerCase())
      );
    }
  });

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestione Auto</h1>
          <div className="mt-2">
            <Image
              src="/mia-auto.jpg"
              alt="La mia auto"
              width={400}
              height={200}
              className="rounded-xl shadow-lg"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Ricerca */}
          <div className="flex items-center border rounded-lg px-3 py-2 bg-white shadow-sm">
            <Search className="text-gray-500 mr-2" size={18} />
            <input
              type="text"
              placeholder={`Cerca per ${searchBy === "auto" ? "auto" : "componente"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-sm w-40 md:w-64"
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
            onClick={() =>
              setView(view === "sintetica" ? "dettagliata" : "sintetica")
            }
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
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
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
            + Aggiungi Auto
          </button>
        </div>
      </div>

      {/* Lista Auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCars.map((car) => (
          <div
            key={car.id}
            className="bg-white shadow-lg rounded-2xl flex flex-col gap-4 border border-gray-200 hover:shadow-xl transition"
          >
            {/* Header card */}
            <div className="bg-gray-800 text-white rounded-t-2xl px-4 py-3 flex justify-between">
              <div>
                <h2 className="text-lg font-bold">{car.name}</h2>
                <span className="text-sm opacity-80">{car.chassis_number}</span>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Vista SINTETICA */}
              {view === "sintetica" && (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => alert(`Modifica auto: ${car.name}`)}
                    className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Edit size={16} /> Modifica
                  </button>
                  <button
                    onClick={() => alert(`Dettagli auto: ${car.name}`)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Info size={16} /> Dettagli
                  </button>
                </div>
              )}

              {/* Vista DETTAGLIATA */}
              {view === "dettagliata" && (
                <>
                  <div className="flex flex-col gap-2">
                    {car.components.map((comp: any) => (
                      <div
                        key={comp.id}
                        className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg"
                      >
                        <span>
                          {comp.type} – {comp.identifier}
                        </span>
                        {comp.expiry_date && (
                          <span
                            className={`font-medium ${getExpiryColor(
                              comp.expiry_date
                            )}`}
                          >
                            {new Date(comp.expiry_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => alert(`Modifica auto: ${car.name}`)}
                      className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-lg flex items-center gap-2"
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
    </div>
  );
}
