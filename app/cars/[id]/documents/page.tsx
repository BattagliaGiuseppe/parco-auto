"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PlusCircle, Trash2, FileText } from "lucide-react";

type Document = {
  id: string;
  type: string;
  file_url: string;
  uploaded_at: string;
};

export default function DocumentsPage() {
  const { id } = useParams();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("");

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
    if (!file || !docType) return alert("Seleziona file e tipo documento");

    const fileName = `${id}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file);

    if (uploadError) {
      alert("Errore upload");
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
      setDocType("");
      fetchDocs();
    }
  };

  const deleteDoc = async (docId: string) => {
    await supabase.from("documents").delete().eq("id", docId);
    fetchDocs();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📄 Documenti Auto</h1>

      {/* Upload form */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Tipo documento (es. Passaporto, Foto...)"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="border p-2 rounded"
        />
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
              className="border p-4 rounded-lg flex justify-between items-center bg-white shadow"
            >
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <FileText size={16} /> {doc.type}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(doc.uploaded_at).toLocaleString("it-IT")}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={doc.file_url}
                  target="_blank"
                  className="bg-gray-900 text-yellow-500 px-3 py-1 rounded"
                >
                  Apri
                </a>
                <button
                  onClick={() => deleteDoc(doc.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded flex items-center gap-1"
                >
                  <Trash2 size={14} /> Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
