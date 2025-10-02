"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, Trash2, FileText } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Document = {
  id: string;
  type: string;
  file_url: string;
  uploaded_at: string;
};

const PRESET_TYPES = [
  "Passaporto",
  "Scheda tecnica",
  "Foto",
  "Certificato",
  "Altro"
];

export default function DocumentsPage() {
  const { id } = useParams();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(PRESET_TYPES[0]);

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

  const uploadDoc = async () => {
    if (!file || !docType) {
      alert("Seleziona file e tipo documento");
      return;
    }

    const fileName = `${id}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file);

    if (uploadError) {
      console.error("Errore upload:", uploadError);
      alert("Errore nell’upload del file");
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    const { error: insertError } = await supabase
      .from("documents")
      .insert([{ car_id: id, type: docType, file_url: publicUrl.publicUrl }]);

    if (!insertError) {
      setFile(null);
      setDocType(PRESET_TYPES[0]);
      fetchDocs();
    } else {
      console.error("Errore inserimento metadata:", insertError);
      alert("Errore nel salvataggio del documento");
    }
  };

  const deleteDoc = async (docId: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", docId);
    if (error) {
      console.error("Errore eliminazione documento:", error);
      alert("Errore nell'eliminazione");
    } else {
      fetchDocs();
    }
  };

  return (
    <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">📄 Documenti Auto</h1>

      {/* Upload form */}
      <div className="bg-white shadow rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border p-2 rounded w-full md:w-auto"
        />
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="border p-2 rounded w-full md:w-auto"
        >
          {PRESET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={uploadDoc}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <PlusCircle size={18} /> Carica
        </button>
      </div>

      {/* Lista documenti */}
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white shadow rounded-lg border p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold text-lg flex items-center gap-2">
                  <FileText size={18} /> {doc.type}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(doc.uploaded_at).toLocaleString("it-IT")}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={doc.file_url}
                  target="_blank"
                  className="bg-gray-900 text-yellow-500 px-3 py-2 rounded-lg hover:bg-gray-800"
                >
                  Apri
                </a>
                <button
                  onClick={() => deleteDoc(doc.id)}
                  className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 flex items-center gap-1"
                >
                  <Trash2 size={16} /> Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
