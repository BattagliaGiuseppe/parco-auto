"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Audiowide } from "next/font/google";
import { Printer, ArrowLeft } from "lucide-react";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function PrintPage() {
  const { id } = useParams();
  const [car, setCar] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      // Auto + componenti
      const { data: carData, error: carErr } = await supabase
        .from("cars")
        .select(
          "id, name, chassis_number, components(id, type, identifier, expiry_date)"
        )
        .eq("id", id)
        .single();

      if (!carErr) setCar(carData);

      // Documenti
      const { data: docsData, error: docsErr } = await supabase
        .from("documents")
        .select("id, type, file_url, uploaded_at")
        .eq("car_id", id)
        .order("uploaded_at", { ascending: false });

      if (!docsErr) setDocuments(docsData || []);
    };

    fetchData();
  }, [id]);

  const getExpiryColor = (date: string) => {
    const expiry = new Date(date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());

    if (months > 12) return "text-green-500";
    if (months > 6) return "text-yellow-500";
    return "text-red-500";
  };

  if (!car) return <p className="p-6">Caricamento scheda auto...</p>;

  return (
    <div className={`p-8 space-y-10 ${audiowide.className}`}>
      {/* Barra superiore con indietro + titolo + stampa */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/cars"
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 print:hidden"
          >
            <ArrowLeft size={18} /> Indietro
          </Link>
          <Image
            src="/logo-stampa.png"
            alt="Logo Battaglia Racing Car"
            width={120}
            height={120}
            className="object-contain"
          />
        </div>

        <h1 className="text-3xl font-bold text-gray-800">Scheda Auto</h1>

        <button
          onClick={() => window.print()}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 print:hidden"
        >
          <Printer size={18} /> Stampa
        </button>
      </div>

      {/* Sezione dati auto */}
      <section>
        <h2 className="text-2xl font-bold text-yellow-600 mb-4">Dati Auto</h2>
        <div className="bg-white shadow rounded-lg p-4 space-y-2">
          <p>
            <span className="font-semibold">Nome:</span> {car.name}
          </p>
          <p>
            <span className="font-semibold">Numero Telaio:</span>{" "}
            {car.chassis_number}
          </p>
        </div>
      </section>

      {/* Sezione componenti */}
      <section>
        <h2 className="text-2xl font-bold text-yellow-600 mb-4">Componenti</h2>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black text-yellow-500">
              <tr>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Identificativo</th>
                <th className="px-4 py-2 text-left">Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {car.components?.map((comp: any) => (
                <tr key={comp.id} className="border-t">
                  <td className="px-4 py-2 capitalize">{comp.type}</td>
                  <td className="px-4 py-2">{comp.identifier}</td>
                  <td
                    className={`px-4 py-2 ${
                      comp.expiry_date ? getExpiryColor(comp.expiry_date) : ""
                    }`}
                  >
                    {comp.expiry_date
                      ? new Date(comp.expiry_date).toLocaleDateString("it-IT")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sezione documenti */}
      <section>
        <h2 className="text-2xl font-bold text-yellow-600 mb-4">Documenti</h2>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black text-yellow-500">
              <tr>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Caricato il</th>
                <th className="px-4 py-2 text-left">File</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="px-4 py-2">{doc.type}</td>
                  <td className="px-4 py-2">
                    {new Date(doc.uploaded_at).toLocaleDateString("it-IT")}
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      className="text-blue-600 underline"
                    >
                      Visualizza
                    </a>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    Nessun documento caricato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
