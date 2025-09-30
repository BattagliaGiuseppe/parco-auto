"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MountsPage() {
  const [mounts, setMounts] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [selectedCar, setSelectedCar] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("");
  const [mountedAt, setMountedAt] = useState("");

  // Recupera auto, componenti e montaggi
  const fetchData = async () => {
    const { data: carsData } = await supabase.from("cars").select("id, name");
    const { data: compsData } = await supabase
      .from("components")
      .select("id, type, identifier");
    const { data: mountsData } = await supabase
      .from("car_components")
      .select(
        "id, mounted_at, unmounted_at, cars(name), components(type, identifier)"
      )
      .order("mounted_at", { ascending: false });

    if (carsData) setCars(carsData);
    if (compsData) setComponents(compsData);
    if (mountsData) setMounts(mountsData);
  };

  // Aggiungi montaggio
  const addMount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar || !selectedComponent) return;

    await supabase.from("car_components").insert([
      {
        car_id: selectedCar,
        component_id: selectedComponent,
        mounted_at: mountedAt || new Date().toISOString(),
      },
    ]);

    setSelectedCar("");
    setSelectedComponent("");
    setMountedAt("");
    fetchData();
  };

  // Scollega (chiude il montaggio con unmounted_at)
  const unmount = async (id: string) => {
    await supabase
      .from("car_components")
      .update({ unmounted_at: new Date().toISOString() })
      .eq("id", id);
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🔧 Montaggi Componenti</h1>

      {/* Form nuovo montaggio */}
      <form
        onSubmit={addMount}
        className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-6"
      >
        <select
          value={selectedCar}
          onChange={(e) => setSelectedCar(e.target.value)}
          className="border p-2 rounded"
          required
        >
          <option value="">Seleziona auto</option>
          {cars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={selectedComponent}
          onChange={(e) => setSelectedComponent(e.target.value)}
          className="border p-2 rounded"
          required
        >
          <option value="">Seleziona componente</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.type} – {c.identifier}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={mountedAt}
          onChange={(e) => setMountedAt(e.target.value)}
          className="border p-2 rounded"
        />

        <button
          type="submit"
          className="col-span-full bg-blue-600 text-white py-2 rounded"
        >
          Monta
        </button>
      </form>

      {/* Lista montaggi */}
      <ul className="space-y-2">
        {mounts.map((m) => (
          <li
            key={m.id}
            className="p-3 border rounded flex justify-between items-center"
          >
            <span>
              {m.components?.type} ({m.components?.identifier}) su{" "}
              {m.cars?.name} dal {new Date(m.mounted_at).toLocaleDateString()}
              {m.unmounted_at
                ? ` al ${new Date(m.unmounted_at).toLocaleDateString()}`
                : " (attivo)"}
            </span>
            {!m.unmounted_at && (
              <button
                onClick={() => unmount(m.id)}
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Scollega
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
