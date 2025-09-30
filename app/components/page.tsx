"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [type, setType] = useState("");
  const [identifier, setIdentifier] = useState("");

  const fetchComponents = async () => {
    const { data, error } = await supabase.from("components").select("*");
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
      <h1 className="text-2xl font-bold mb-4">🔧 Componenti</h1>

      <form onSubmit={addComponent} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
        <input
          type="text"
          placeholder="Tipo componente"
          className="border p-2 rounded"
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Identificativo"
          className="border p-2 rounded"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <button type="submit" className="col-span-full bg-blue-600 text-white py-2 rounded">
          Aggiungi
        </button>
      </form>

      <ul className="space-y-2">
        {components.map((comp) => (
          <li key={comp.id} className="p-3 border rounded flex justify-between items-center">
            <span>{comp.type} - {comp.identifier}</span>
            <button
              onClick={() => deleteComponent(comp.id)}
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