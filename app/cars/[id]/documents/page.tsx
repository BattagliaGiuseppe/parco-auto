"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Info, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { uploadTeamFile } from "@/lib/storage";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import StatsGrid from "@/components/StatsGrid";
import FormStatusBanner from "@/components/FormStatusBanner";

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function CarDocumentsPage() {
  const params = useParams();
  const carId = params?.id as string;
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  async function load() {
    const ctx = await getCurrentTeamContext();
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("team_id", ctx.teamId)
      .eq("car_id", carId)
      .order("uploaded_at", { ascending: false });
    setRows(data || []);
  }

  useEffect(() => {
    if (carId) void load();
  }, [carId]);

  async function addDoc() {
    if (!title.trim() && !type.trim() && !fileUrl.trim() && !file) {
      setFeedback({
        type: "error",
        message: "Inserisci almeno un titolo, un tipo documento o carica un file.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const ctx = await getCurrentTeamContext();
      let payload: any = {
        team_id: ctx.teamId,
        car_id: carId,
        title: title.trim() || type.trim() || "Documento",
        type: type.trim() || null,
        file_url: fileUrl.trim() || null,
        notes: notes.trim() || null,
        uploaded_by_team_user_id: ctx.teamUserId,
      };
      if (file) {
        const upload = await uploadTeamFile({
          file,
          area: "car-documents",
          recordId: carId,
        });
        payload = {
          ...payload,
          file_url: upload.publicUrl,
          storage_path: upload.path,
          file_name: upload.fileName,
          mime_type: upload.mimeType,
          size_bytes: upload.sizeBytes,
        };
      }
      const { error } = await supabase.from("documents").insert([payload]);
      if (error) throw error;

      setTitle("");
      setType("");
      setFileUrl("");
      setNotes("");
      setFile(null);
      await load();
      setFeedback({ type: "success", message: "Documento salvato correttamente." });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "Errore salvataggio documento." });
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(
    () => [
      {
        label: "Documenti",
        value: String(rows.length),
        icon: <FileText size={18} />,
        helper: "Totale documenti collegati al mezzo",
      },
      {
        label: "Con file",
        value: String(rows.filter((row) => !!row.file_url).length),
        icon: <Upload size={18} />,
        helper: "Documenti con file o link caricati",
      },
      {
        label: "Con note",
        value: String(rows.filter((row) => !!row.notes).length),
        icon: <Info size={18} />,
        helper: "Documenti con descrizione o note operative",
      },
      {
        label: "Ultimo upload",
        value:
          rows[0]?.uploaded_at
            ? new Date(rows[0].uploaded_at).toLocaleDateString("it-IT")
            : "—",
        icon: <FileText size={18} />,
        helper: "Data dell'ultimo documento registrato",
      },
    ],
    [rows]
  );

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title="Documenti mezzo"
        subtitle="Archivio allegati, caricamento file locale e link esterni"
        icon={<FileText size={22} />}
        actions={
          <Link href={`/cars/${carId}`} className="rounded-xl border px-4 py-2 font-bold hover:bg-neutral-50">
            <ArrowLeft size={16} className="mr-2 inline" />
            Scheda mezzo
          </Link>
        }
      />

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="Questa pagina raccoglie i documenti utili del mezzo in un unico archivio."
      >
        <InfoBlock>
          Usa questa sezione per conservare allegati, documenti tecnici, certificazioni e link esterni del mezzo.
          La scheda auto resta la vista sintetica, mentre qui tieni ordinato lo storico documentale.
        </InfoBlock>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <SectionCard
          title="Nuovo documento"
          subtitle="Compila almeno un campo utile o carica un file."
        >
          <div className="grid grid-cols-1 gap-3">
            <input
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              placeholder="Titolo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              placeholder="Tipo documento"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <input
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              placeholder="URL file esterno (opzionale)"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
            />
            <input
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <textarea
              className="min-h-24 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              placeholder="Note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="mt-2">
              <button
                onClick={addDoc}
                disabled={saving}
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload size={16} className="mr-2 inline" />
                {saving ? "Caricamento..." : "Aggiungi documento"}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Archivio documenti" subtitle="Storico allegati e link del mezzo.">
          {rows.length === 0 ? (
            <EmptyState title="Nessun documento caricato" description="Aggiungi il primo documento per costruire lo storico del mezzo." />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="font-bold text-neutral-900">{row.title || row.type || "Documento"}</div>
                  <div className="mt-1 text-sm text-neutral-500">
                    {new Date(row.uploaded_at).toLocaleString("it-IT")}
                  </div>
                  {row.notes ? (
                    <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm leading-6 text-yellow-900">
                      {row.notes}
                    </div>
                  ) : null}
                  {row.file_url ? (
                    <a
                      href={row.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                    >
                      Apri file
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
