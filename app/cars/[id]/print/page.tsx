"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { Audiowide } from "next/font/google";
import { Printer } from "lucide-react";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Document = {
  id: string;
  type: string;
  file_url: string;
  uploaded_at: string;
};

export default function PrintPage() {
  const { id } = useParams();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("car_id", id)
      .order("uploaded_at", { ascending: false });

    if (!error && data) setDocs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`p-8 bg-white text-black min-h-screen ${audiowide.className}`}>
      {/* Header con logo e bottone stampa */}
      <div className="flex items-center justify-between mb-8 border-b pb-4">
        <Image src="/logo.png" alt="Logo" width={180} height={60} />
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Documenti Auto</h1>
          <button
            onClick={handlePrint}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 print:hidden"
          >
            <Printer size={18} /> Stampa
          </button>
        </div>
      </div>

      {loading ? (
        <p>Caricamento...</p>
      ) : docs.length === 0 ? (
        <p className="text-gray-500">Nessun documento disponibile</p>
      ) : (
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Tipo Documento</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Caricato il</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Link</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td className="border border-gray-300 px-4 py-2 font-medium">{doc.type}</td>
                <td className="border border-gray-300 px-4 py-2">
                  {new Date(doc.uploaded_at).toLocaleDateString("it-IT")}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    className="text-blue-600 underline"
                  >
                    Apri
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
