"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp, Pencil, Save } from "lucide-react";
import Image from "next/image";

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [tempComponents, setTempComponents] = useState<any[]>([]);
  const [expandedCars, setExpandedCars] = useState<Set<number>>(new Set());

  const [editingComp, setEditingComp] = useState<number | null>(null);

  // ricerca
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState("auto"); // auto | componente

  const defaultComponents = [
    { type: "motore", identifier: "", expiry_date: "" },
    { type: "cambio", identifier: "", expiry_date: "" },
    { type: "differenziale", identifier: "", expiry_date: "" },
    { type: "cinture", identifier: "", expiry_date: "" },
    { type: "cavi", identifier: "", expiry_date: "" },
    { type: "estintore", identifier: "", expiry_date: "" },
    { type: "serbatoio", identifier: "", expiry_date: "" },
    { type: "passaporto", identifier: "", expiry_date: "" },
  ];

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("id, name, chassis_number, components(id, type, identifier, expiry_date)")
      .order("id", { ascending: true });

    if (!error) setCars(data || []);
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const addCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !chassis) return;

    setLoading(true);

    const { data: newCar, error } = await supabase
      .from("cars")
      .insert([{ name, chassis_number: chassis }])
      .select()
      .single();

    if (error) {
      console.error("❌ Errore inserimento auto:", error.message);
      setLoading(false);
      return;
    }

    setSelectedCar(newCar);
    setTempComponents(defaultComponents);
    setName("");
    setChassis("");
    setLoading(false);

    fetchCars();
  };

  const updateTempComponent = (index: number, field: string, value: string) => {
    const updated = [...tempComponents];
    updated[index][field] = value;
    setTempComponents(updated);
  };

  const saveComponents = async () => {
    if (!selectedCar) return;

    const compsToInsert = tempComponents.map((c) => ({
      type: c.type,
      identifier: c.identifier,
      expiry_date: c.expiry_date ? new Date(c.expiry_date).toISOString() : null,
      car_id: selectedCar.id,
    }));

    const { error } = await supabase.from("components").insert(compsToInsert);

    if (error) {
      console.error("❌ Errore inserimento componenti:", error.message);
      return;
    }

    setSelectedCar(null);
    setTempComponents([]);
    fetchCars();
  };

  const toggleDetails = (carId: number) => {
    const newExpanded = new Set(expandedCars);
    if (newExpanded.has(carId)) {
      newExpanded.delete(carId);
    } else {
      newExpanded.add(carId);
    }
    setExpandedCars(newExpanded);
  };

  const startEditing = (compId: number) => setEditingComp(compId);
  const saveEdit = async (comp: any) => {
    const { error } = await supabase
      .from("components")
      .update({
        identifier: comp.identifier,
        expiry_date: comp.expiry_date
          ? new Date(comp.expiry_date).toISOString()
          : null,
      })
      .eq("id", comp.id);

    if (!error) {
      setEditingComp(null);
      fetchCars();
    }
  };

  // filtro ricerca
  const filteredCars = cars.filter((car) => {
    if (!searchTerm) return true;
    if (searchBy === "auto") {
      return car.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    if (searchBy === "componente") {
      return car.components.some((c: any) =>
        c.identifier?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header con immagine auto */}
      <div className="flex items-center gap-4">
        <Image
          src="/iconagriiip.svg"
          alt="La mia auto"
          width={100}
          height={100}
          className="rounded-lg shadow"
        />
        <h1 className="text-3xl font-bold text-gray-800">Gestione Auto</h1>
      </div>

      {/* Ricerca */}
      <div className="flex gap-3 items-center bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          placeholder="Cerca..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 border p-2 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
        />
        <select
          value={searchBy}
          onChange={(e) => setSearchBy(e.target.value)}
          className="border p-2 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
        >
          <option value="auto">Per Auto</option>
          <option value="componente">Per Componente</option>
        </select>
      </div>

      {/* Form nuova auto */}
      <form
        onSubmit={addCar}
        className="bg-white p-6 rounded-xl shadow-md grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <input
          type="text"
          placeholder="Nome auto"
          className="border p-3 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Numero telaio"
          className="border p-3 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
          value={chassis}
          onChange={(e) => setChassis(e.target.value)}
          required
        />
        <button
          type="submit"
          className="col-span-full bg-yellow-600 hover:bg-yellow-700 transition text-white py-3 rounded-lg font-semibold"
          disabled={loading}
        >
          {loading ? "Salvataggio..." : "➕ Aggiungi Auto"}
        </button>
      </form>

      {/* Form componenti auto appena creata */}
      {selectedCar && (
        <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
          <h2 className="text-xl font-semibold">
            Aggiungi componenti per <span className="text-yellow-600">{selectedCar.name}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-semibold text-gray-600">
            <span>Tipo</span>
            <span>Identificativo</span>
            <span>Data Scadenza</span>
          </div>
          {tempComponents.map((comp, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <span className="capitalize flex items-center font-medium">{comp.type}</span>
              <input
                type="text"
                placeholder="Identificativo"
                value={comp.identifier}
                onChange={(e) => updateTempComponent(index, "identifier", e.target.value)}
                className="border p-2 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
              />
              <input
                type="date"
                value={comp.expiry_date || ""}
                onChange={(e) => updateTempComponent(index, "expiry_date", e.target.value)}
                className="border p-2 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
              />
            </div>
          ))}
          <button
            onClick={saveComponents}
            className="bg-green-600 hover:bg-green-700 transition text-white px-4 py-2 rounded-lg font-semibold"
          >
            💾 Salva componenti
          </button>
        </div>
      )}

      {/* Lista auto compatta */}
      <div className="space-y-4">
        {filteredCars.map((car) => (
          <div
            key={car.id}
            className="bg-white p-4 rounded-xl shadow hover:shadow-lg transition"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                {car.name} ({car.chassis_number})
              </h2>
              <button
                onClick={() => toggleDetails(car.id)}
                className="flex items-center gap-1 text-yellow-600 hover:underline"
              >
                {expandedCars.has(car.id) ? (
                  <>
                    Nascondi <ChevronUp size={18} />
                  </>
                ) : (
                  <>
                    Dettagli <ChevronDown size={18} />
                  </>
                )}
              </button>
            </div>

            {expandedCars.has(car.id) && (
              <ul className="mt-3 ml-4 space-y-2 text-sm">
                {car.components.map((comp: any) => (
                  <li
                    key={comp.id}
                    className="flex justify-between items-center border-b pb-1 text-gray-700"
                  >
                    {editingComp === comp.id ? (
                      <>
                        <input
                          type="text"
                          value={comp.identifier}
                          onChange={(e) => (comp.identifier = e.target.value)}
                          className="border p-1 rounded mr-2"
                        />
                        <input
                          type="date"
                          value={comp.expiry_date?.split("T")[0] || ""}
                          onChange={(e) => (comp.expiry_date = e.target.value)}
                          className="border p-1 rounded mr-2"
                        />
                        <button
                          onClick={() => saveEdit(comp)}
                          className="text-green-600 flex items-center gap-1"
                        >
                          <Save size={16} /> Salva
                        </button>
                      </>
                    ) : (
                      <>
                        <span>
                          {comp.type} – {comp.identifier}
                        </span>
                        <div className="flex gap-2 items-center">
                          {comp.expiry_date && (
                            <span className="text-red-500">
                              Scade: {new Date(comp.expiry_date).toLocaleDateString()}
                            </span>
                          )}
                          <button
                            onClick={() => startEditing(comp.id)}
                            className="text-gray-500 hover:text-yellow-600"
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
