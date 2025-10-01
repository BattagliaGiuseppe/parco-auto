"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, PlusCircle } from "lucide-react";
import { Audiowide } from "next/font/google";

// Font racing Audiowide
const audiowide = Audiowide({ subsets: ["latin"], weight: "400" });

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);

  const fetchComponents = async () => {
    const { data, error } = await supabase.from("components").select("*").order("id", { ascending: true });
    if (!error) setComponents(data || []);
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      <h1 className="text-3xl font-bold text-gray-800">⚙️ Componenti</h1>

      <button className="self-start bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
        <PlusCircle size={18} /> Aggiungi Componente
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {components.map((comp) => (
          <div key={comp.id} className="bg-white shadow-lg rounded-2xl p-4 border border-gray-200 hover:shadow-xl transition">
            <h2 className="text-lg font-bold text-gray-800">{comp.type}</h2>
            <p className="text-sm text-gray-600">{comp.identifier}</p>
            {comp.expiry_date && (
              <p className="text-red-500 font-medium mt-2">
                Scade: {new Date(comp.expiry_date).toLocaleDateString()}
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <button className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-lg flex items-center gap-2">
                <Edit size={16} /> Modifica
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
