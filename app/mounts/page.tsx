"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MountsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [selectedCar, setSelectedCar] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("");
  const [mountedComponents, setMountedComponents] = useState<any[]>([]);

  // 🔹 Carica auto e componenti
  useEffect(() => {
    const fetchData = async () => {
      const { data: carsData } = await supabase.from("cars").select("*");
      const { data: compsData } = await supabase.from("components").select("*");
      setCars(carsData || []);
      setComponents(compsData || []);
    };
    fetchData();
  }, []);

  // 🔹 Carica componenti montati su un'auto
  const fetchMounted = async (carId: string) => {
    const { data } = await supabase
      .from("car_components")
      .select("id, component_id, components(type, identifier)")
      .eq("car_id", carId)
      .is("unmounted_at", null); // solo quelli montati
    setMountedComponents(data || []);
  };

  // 🔹 Monta componente
  const mountComponent = async () => {
    if (!selectedCar || !selectedComponent) return;
    await supabase.from("car_components").insert({
      car_id: selectedCar,
      component_id: selectedComponent,
    });
    setSelectedComponent("");
    fetchMounted(selectedCar);
  };

  // 🔹 Smonta componente
  const unmountComponent = async (id: string) => {
    await supabase
      .from("car_components")
      .update({ unmounted_at: new Date().toISOString() })
      .eq("id", id);
    fetchMounted(selectedCar);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🔧 Gestione Montaggi</h1>

      {/* Selezione auto */}
      <select
        value={selectedCar}
        onChange={(e) => {
          setSelectedCar(e.target.value);
          fetchMounted(e.target.value);
        }}
        className="border p-2 rounded mb-4 w-full"
      >
        <option value="">-- Seleziona auto --</option>
        {cars.map((car) => (
          <option key={car.id} value={car.id}>
            {car.name} (Telaio: {car.chassis_number})
          </option>
        ))}
      </select>

      {/* Monta nuovo componente */}
      {selectedCar && (
        <div className="mb-6 flex gap-2">
          <select
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            className="border p-2 rounded flex-1"
          >
            <option value="">-- Seleziona componente --</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.type} – {c.identifier}
              </option>
            ))}
          </select>
          <button
            onClick={mountComponent}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Monta
          </button>
        </div>
      )}

      {/* Lista componenti montati */}
      {selectedCar && (
        <ul className="space-y-2">
          {mountedComponents.map((mc) => (
            <li
              key={mc.id}
              className="p-3 border rounded flex justify-between items-center"
            >
              <span>
                {mc.components?.type} – {mc.components?.identifier}
              </span>
              <button
                onClick={() => unmountComponent(mc.id)}
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Smonta
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
