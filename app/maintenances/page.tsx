"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [description, setDescription] = useState("");

  const fetchMaintenances = async () => {
    const { data, error } = await supabase.from("maintenances").select("*").order("performed_at", { ascending: false });
    if (!error) setMaintenances(data || []);
  };

  const addMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) return;
    await supabase.from("maintenances").insert([{ description }]);
    setDescription("");
    fetchMaintenances();
  };

  const deleteMaintenance = async (id: string) => {
    await supabase.from("maintenances").delete().eq("id", id);
    fetchMaintenances();
  };

  useEffect(() => {
    fetchMaintenances();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🛠️ Manutenzioni</h1>
      <form onSubmit={addMaintenance} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Descrizione intervento"
          className="border p-2 rounded flex-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Aggiungi</button>
      </form>

      <ul className="space-y-2">
        {maintenances.map((m) => (
          <li key={m.id} className="flex justify-between items-center border p-2 rounded">
            {m.description}
            <button onClick={() => deleteMaintenance(m.id)} className="bg-red-500 text-white px-3 py-1 rounded">
              Elimina
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
