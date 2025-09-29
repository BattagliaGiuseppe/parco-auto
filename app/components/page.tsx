"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [type, setType] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [homologation, setHomologation] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const fetchComponents = async () => {
    const { data, error } = await supabase.from("components").select("*");
    if (!error) setComponents(data || []);
  };

  const addComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("components").insert([
      { type, identifier, homologation, expiry_date: expiryDate },
    ]);
    setType("");
    setIdentifier("");
    setHomologation("");
    setExpiryDate("");
    fetchComponents();
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  return (
    <ProtectedRoute>
      <div>
        <h1 className="text-2xl font-bold mb-4">⚙️ Gestione Componenti</h1>

        <form
          onSubmit={addComponent}
          className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-6"
        >
          <input
            type="text"
            placeholder="Tipo"
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
          <input
            type="text"
            placeholder="Omologazione"
            className="border p-2 rounded"
            value={homologation}
            onChange={(e) => setHomologation(e.target.value)}
          />
          <input
            type="date"
            className="border p-2 rounded"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <button
            type="submit"
            className="col-span-full bg-blue-600 text-white py-2 rounded"
          >
            Aggiungi
          </button>
        </form>

        <ul className="space-y-2">
          {components.map((c) => (
            <li
              key={c.id}
              className="p-3 border rounded flex justify-between items-center"
            >
              <span>
                {c.type} – {c.identifier}{" "}
                {c.expiry_date ? `(Scadenza: ${c.expiry_date})` : ""}
              </span>
              <div className="flex gap-2">
                <Link
                  href={`/components/${c.id}`}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  Dettagli
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ProtectedRoute>
  );
}
