"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

export default function PrintCarPage() {
  const { id } = useParams();
  const [car, setCar] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);

  const fetchData = async () => {
    const { data: carData } = await supabase
      .from("cars")
      .select("id, name, chassis_number, components(id,type,identifier,expiry_date)")
      .eq("id", id)
      .single();

    const { data: docData } = await supabase
      .from("documents")
      .select("*")
      .eq("car_id", id);

    setCar(carData);
    setDocs(docData || []);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (!car) return <p>Caricamento...</p>;

  return (
    <div className="p-8 bg-white text-black">
      {/* Logo e intestazione */}
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <Image
          src="/logo-stampa.png"
          alt="Logo Battaglia Racing"
          width={160}
          height={80}
        />
        <h1 className="text-2xl font-bold">Scheda Auto</h1>
      </div>

      {/* Dati auto */}
      <h2 className="text-xl font-bold mb-2">{car.name}</h2>
      <p className="mb-6">Telaio: {car.chassis_number}</p>

      {/* Componenti */}
      <h3 className="text-lg font-semibold mb-2">Componenti</h3>
      <table className="w-full border mb-6">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">Tipo</th>
            <th className="p-2 border">Identificativo</th>
            <th className="p-2 border">Scadenza</th>
          </tr>
        </thead>
        <tbody>
          {(car.components || []).map((c: any) => (
            <tr key={c.id}>
              <td className="border p-2">{c.type}</td>
              <td className="border p-2">{c.identifier}</td>
              <td className="border p-2">
                {c.expiry_date
                  ? new Date(c.expiry_date).toLocaleDateString("it-IT")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Documenti */}
      <h3 className="text-lg font-semibold mb-2">Documenti</h3>
      <ul className="list-disc pl-6 mb-6">
        {docs.map((d) => (
          <li key={d.id}>
            {d.type} –{" "}
            <a href={d.file_url} target="_blank" className="text-blue-600 underline">
              Apri
            </a>
          </li>
        ))}
      </ul>

      {/* Pulsante stampa */}
      <button
        onClick={() => window.print()}
        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-2 rounded-lg"
      >
        Stampa
      </button>
    </div>
  );
}
