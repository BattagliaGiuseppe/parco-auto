"use client";

import { useEffect, useState } from "react";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";

export default function MaintenancesPage() {
  const session = useSession();
  const supabase = useSupabaseClient();
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [componentId, setComponentId] = useState("");
  const [description, setDescription] = useState("");
  const [components, setComponents] = useState<any[]>([]);

  const fetchMaintenances = async () => {
    const { data, error } = await supabase
      .from("maintenances")
      .select("*, components(type, identifier)")
      .order("performed_at", { ascending: false });
    if (!error) setMaintenances(data || []);
  };

  const fetchComponents = async () => {
    const { data } = await supabase
      .from("components")
      .select("id, type, identifier");
    if (data) setComponents(data);
  };

  const addMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !componentId) return;
    await supabase
      .from("maintenances")
      .insert([{ description, component_id: componentId }]);
    setDescription("");
    setComponentId("");
    fetchMaintenances();
  };

  const deleteMaintenance = async (id: string) => {
    await supabase.from("maintenances").delete().eq("id", id);
    fetchMaintenances();
  };

  useEffect(() => {
    if (session) {
      fetchMaintenances();
      fetchComponents();
    }
  }, [session]);

  if (!session) return <p>🔒 Devi effettuare il login per vedere questa pagina</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🛠️ Gestione Manutenzioni</h1>
      <form onSubmit={addMaintenance} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
        <select
          className="border p-2 rounded"
          value={componentId}
          onChange={(e) => setComponentId(e.target.value)}
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
          type="text"
          placeholder="Descrizione intervento"
          className="border p-2 rounded"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <button type="submit" className="col-span-full bg-blue-600 text-white py-2 rounded">
          Aggiungi
        </button>
      </form>

      <ul className="space-y-2">
        {maintenances.map((m) => (
          <li key={m.id} className="p-3 border rounded flex justify-between">
            <span>
              {m.description} – su {m.components?.type} {m.components?.identifier}
            </span>
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
