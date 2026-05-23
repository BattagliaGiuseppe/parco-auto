"use client";

import { useEffect, useMemo, useState } from "react";
import { Audiowide } from "next/font/google";
import { Activity, Info, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { uploadTeamFile } from "@/lib/storage";
import { usePermissionAccess } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import StatsGrid from "@/components/StatsGrid";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

const inputClassName =
  "w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100";

type TelemetryForm = {
  file_name: string;
  notes: string;
  car_id: string;
  driver_id: string;
  event_id: string;
  session_id: string;
};

function buildDefaultForm(): TelemetryForm {
  return {
    file_name: "",
    notes: "",
    car_id: "",
    driver_id: "",
    event_id: "",
    session_id: "",
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-800">{label}</span>
        {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

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

export default function TelemetryPage() {
  const access = usePermissionAccess();
  const canViewTelemetry = access.hasPermission("telemetry.view");
  const canEditTelemetry = access.hasPermission("telemetry.edit", ["owner", "admin"]);

  const [rows, setRows] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [form, setForm] = useState<TelemetryForm>(buildDefaultForm());
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [filesRes, carsRes, driversRes, eventsRes, sessionsRes] = await Promise.all([
        supabase
          .from("telemetry_files")
          .select("*")
          .eq("team_id", ctx.teamId)
          .order("created_at", { ascending: false }),
        supabase.from("cars").select("id,name").eq("team_id", ctx.teamId),
        supabase.from("drivers").select("id,first_name,last_name").eq("team_id", ctx.teamId),
        supabase.from("events").select("id,name").eq("team_id", ctx.teamId),
        supabase.from("event_sessions").select("id,name").eq("team_id", ctx.teamId),
      ]);

      setRows(filesRes.data || []);
      setCars(carsRes.data || []);
      setDrivers(driversRes.data || []);
      setEvents(eventsRes.data || []);
      setSessions(sessionsRes.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewTelemetry) {
      void load();
    }
  }, [access.loading, canViewTelemetry]);

  const stats = useMemo(
    () => [
      {
        label: "File registrati",
        value: String(rows.length),
        icon: <Activity size={18} />,
        helper: "Pacchetti e file telemetria archiviati",
      },
      {
        label: "Eventi collegati",
        value: String(new Set(rows.map((row) => row.event_id).filter(Boolean)).size),
        icon: <Activity size={18} />,
        helper: "Weekend con almeno un file archiviato",
      },
      {
        label: "Mezzi collegati",
        value: String(new Set(rows.map((row) => row.car_id).filter(Boolean)).size),
        icon: <Activity size={18} />,
        helper: "Auto con riferimenti telemetrici registrati",
      },
      {
        label: "Piloti collegati",
        value: String(new Set(rows.map((row) => row.driver_id).filter(Boolean)).size),
        icon: <Activity size={18} />,
        helper: "Piloti associati ai file archiviati",
      },
    ],
    [rows]
  );

  async function addFile() {
    if (!canEditTelemetry) return;
    const ctx = await getCurrentTeamContext();
    setFeedback(null);

    if (!file && !form.file_name.trim()) {
      setFeedback({
        type: "error",
        message: "Carica un file o inserisci almeno un nome.",
      });
      return;
    }

    let payload: any = {
      team_id: ctx.teamId,
      file_name: form.file_name || file?.name || "File telemetria",
      notes: form.notes || null,
      car_id: form.car_id || null,
      driver_id: form.driver_id || null,
      event_id: form.event_id || null,
      session_id: form.session_id || null,
      uploaded_by_team_user_id: ctx.teamUserId,
    };

    if (file) {
      const upload = await uploadTeamFile({
        file,
        area: "telemetry",
        recordId: form.event_id || form.car_id || "generic",
      });

      payload = {
        ...payload,
        file_name: form.file_name || upload.fileName,
        file_url: upload.publicUrl,
        storage_path: upload.path,
        file_type: upload.mimeType,
        file_size_bytes: upload.sizeBytes,
      };
    }

    const { error } = await supabase.from("telemetry_files").insert([payload]);
    if (error) {
      setFeedback({ type: "error", message: error.message });
      return;
    }

    setForm(buildDefaultForm());
    setFile(null);
    setFeedback({ type: "success", message: "File registrato correttamente." });
    await load();
  }

  const filtered = rows.filter(
    (row) =>
      !filter ||
      `${row.file_name || ""} ${row.notes || ""}`
        .toLowerCase()
        .includes(filter.toLowerCase())
  );

  if (access.loading) {
    return (
      <PagePermissionState
        title="Telemetria"
        subtitle="Archivio file con upload locale e collegamenti operativi"
        icon={<Activity size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Telemetria"
        subtitle="Archivio file con upload locale e collegamenti operativi"
        icon={<Activity size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewTelemetry) {
    return (
      <PagePermissionState
        title="Telemetria"
        subtitle="Archivio file con upload locale e collegamenti operativi"
        icon={<Activity size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo telemetria."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      <PageHeader
        title="Telemetria"
        subtitle="Archivio file con upload locale, collegamento a evento, sessione, mezzo e pilota."
        icon={<Activity size={22} />}
      />

      {feedback ? <FormStatusBanner type={feedback.type} message={feedback.message} /> : null}

      {!canEditTelemetry ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura operativa"
        subtitle="La telemetria conserva file e metadati collegati al contesto corretto."
      >
        <InfoBlock>
          Usa questo modulo per archiviare file telemetrici e collegarli a mezzo, pilota, evento e sessione.
          In questo modo il materiale resta rintracciabile nel tempo, senza dover cercare file sparsi fuori dalla piattaforma.
        </InfoBlock>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {canEditTelemetry ? (
          <SectionCard
            title="Nuovo file telemetria"
            subtitle="Carica il file e collega il contesto operativo corretto."
          >
            <div className="grid grid-cols-1 gap-4">
              <Field label="Nome file" hint="Se vuoto usa il nome del file caricato">
                <input
                  className={inputClassName}
                  placeholder="Nome file"
                  value={form.file_name}
                  onChange={(e) => setForm({ ...form, file_name: e.target.value })}
                />
              </Field>

              <Field label="File telemetria">
                <input
                  className={inputClassName}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Mezzo">
                  <select
                    className={inputClassName}
                    value={form.car_id}
                    onChange={(e) => setForm({ ...form, car_id: e.target.value })}
                  >
                    <option value="">Mezzo</option>
                    {cars.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Pilota">
                  <select
                    className={inputClassName}
                    value={form.driver_id}
                    onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                  >
                    <option value="">Pilota</option>
                    {drivers.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.first_name} {row.last_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Evento">
                  <select
                    className={inputClassName}
                    value={form.event_id}
                    onChange={(e) => setForm({ ...form, event_id: e.target.value })}
                  >
                    <option value="">Evento</option>
                    {events.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Sessione">
                  <select
                    className={inputClassName}
                    value={form.session_id}
                    onChange={(e) => setForm({ ...form, session_id: e.target.value })}
                  >
                    <option value="">Sessione</option>
                    {sessions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Note file / provenienza">
                <textarea
                  className="min-h-24 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                  placeholder="Canali, logger, note, origine del file..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>

              <div className="flex justify-end">
                <button
                  onClick={addFile}
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
                >
                  <Upload size={16} className="mr-2 inline" />
                  Registra file
                </button>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Archivio telemetria"
          subtitle="Consulta i file registrati e apri rapidamente i contenuti caricati."
          className={canEditTelemetry ? "" : "xl:col-span-2"}
        >
          <div className="mb-4">
            <input
              className={inputClassName}
              placeholder="Filtro rapido per nome o note"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
              Caricamento archivio telemetria...
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nessun file registrato"
              description="Carica il primo file telemetria per iniziare a costruire lo storico."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <div className="font-bold text-neutral-900">
                    {row.file_name || "File telemetria"}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">
                    {new Date(row.created_at).toLocaleString("it-IT")}
                  </div>

                  {row.notes ? (
                    <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm leading-6 text-yellow-900">
                      {row.notes}
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-700 md:grid-cols-2">
                    <div>Mezzo: {cars.find((c) => c.id === row.car_id)?.name || "—"}</div>
                    <div>
                      Pilota:{" "}
                      {(() => {
                        const driver = drivers.find((d) => d.id === row.driver_id);
                        return driver ? `${driver.first_name} ${driver.last_name}` : "—";
                      })()}
                    </div>
                    <div>Evento: {events.find((e) => e.id === row.event_id)?.name || "—"}</div>
                    <div>
                      Sessione: {sessions.find((s) => s.id === row.session_id)?.name || "—"}
                    </div>
                  </div>

                  {row.file_url ? (
                    <a
                      href={row.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
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
