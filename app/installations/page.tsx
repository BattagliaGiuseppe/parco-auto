"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function InstallationsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [carId, setCarId] = useState("");
  const [componentId, setComponentId] = useState("");

  const fetchData = async () => {
    const { data: carsData } = await supabase.from("cars").select("id, name");
    if (carsData) setCars(carsData);

    const { data: compData } = await supabase.from("components").select("id, type, identifier, status");
    if (compData) setComponents(compData.filter((c) => c.status === "magazzino"));

    const { data: instData } = await supabase
      .from("car_components")
      .select("*, cars(name), components(type, identifier)")
      .is("removed_at", null);
    if (instData) setInstallations(instData);
  };

  const installComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carId || !componentId) return;

    await supabase.from("car_components").insert([{ car_id: carId, component_id: componentId }]);
    await supabase.from("components").update({ status: "installato" }).eq("id", componentId);

    setCarId("");
    setComponentId("");
    fetchData();
  };

  const removeComponent = async (car_id: string, component_id: string, installed_at: string) => {
    await supabase
      .from("car_components")
      .update({ removed_at: new Date().toISOString() })
      .match({ car_id, component_id, installed_at });

    await supabase.from("components").update({ status: "magazzino" }).eq("id", component_id);

    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🔧 Installazioni Componenti</h1>

      <form onSubmit={installComponent} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
        <select className="border p-2 rounded" value={carId} onChange={(e) => setCarId(e.target.value)} required>
          <option value="">Seleziona auto</option>
          {cars.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select className="border p-2 rounded" value={componentId} onChange={(e) => setComponentId(e.target.value)} required>
          <option value="">Seleziona componente</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>{c.type} – {c.identifier}</option>
          ))}
        </select>

        <button type="submit" className="col-span-full bg-blue-600 text-white py-2 rounded">Installa</button>
      </form>

      <h2 className="text-xl font-semibold mb-4">📋 Componenti installati</h2>
      <ul className="space-y-2">
        {installations.map((i) => (
          <li key={`${i.car_id}-${i.component_id}-${i.installed_at}`} className="p-3 border rounded flex justify-between">
            <span>{i.components?.type} {i.components?.identifier} → {i.cars?.name}</span>
            <button
              onClick={() => removeComponent(i.car_id, i.component_id, i.installed_at)}
              className="bg-red-500 text-white px-3 py-1 rounded"
            >
              Rimuovi
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
