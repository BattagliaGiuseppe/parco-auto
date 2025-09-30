"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  const fetchMaintenances = async () => {
    const { data, error } = await supabase.from("maintenances").select("*");
    if (!error) setMaintenances(data || []);
  };

  const addMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !date) return;
    await supabase.from("maintenances").insert([{ description, date }]);
    setDescription("");
    setDate("");
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

      <form onSubmit={addMaintenance} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
        <input
          type="text"
          placeholder="Descrizione"
          className="border p-2 rounded"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <input
          type="date"
          className="border p-2 rounded"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <button type="submit" className="col-span-full bg-blue-600 text-white py-2 rounded">
          Aggiungi
        </button>
      </form>

      <ul className="space-y-2">
        {maintenances.map((m) => (
          <li key={m.id} className="p-3 border rounded flex justify-between items-center">
            <span>{m.description} - {m.date}</span>
            <button
              onClick={() => deleteMaintenance(m.id)}
              className="bg-red-500 text-white px-3 py-1 rounded"
            >
              Elimina
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}