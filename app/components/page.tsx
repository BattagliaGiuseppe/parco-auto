"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [type, setType] = useState("");
  const [identifier, setIdentifier] = useState("");

  const fetchComponents = async () => {
    const { data, error } = await supabase.from("components").select("*").order("created_at", { ascending: false });
    if (!error) setComponents(data || []);
  };

  const addComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !identifier) return;
    await supabase.from("components").insert([{ type, identifier }]);
    setType("");
    setIdentifier("");
    fetchComponents();
  };

  const deleteComponent = async (id: string) => {
    await supabase.from("components").delete().eq("id", id);
    fetchComponents();
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">⚙️ Componenti</h1>
      <form onSubmit={addComponent} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Tipo"
          className="border p-2 rounded flex-1"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <input
          type="text"
          placeholder="Identificativo"
          className="border p-2 rounded flex-1"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Aggiungi</button>
      </form>

      <ul className="space-y-2">
        {components.map((c) => (
          <li key={c.id} className="flex justify-between items-center border p-2 rounded">
            {c.type} – {c.identifier}
            <button onClick={() => deleteComponent(c.id)} className="bg-red-500 text-white px-3 py-1 rounded">
              Elimina
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
