import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SUMMARY_BODY_BYTES = 256 * 1024;
const CONTRACT_VERSION = "p2.8.2";

export async function GET() {
  return NextResponse.json(
    {
      channel: "official_session",
      contract_version: CONTRACT_VERSION,
      description: "Canale ufficiale per sessioni concluse provenienti da logger esterno.",
      authentication: { header: "x-device-key" },
      idempotency: { field: "external_batch_id", max_length: 200 },
      required_payload_fields: ["started_at", "ended_at"],
      optional_payload_fields: [
        "engine_on_at",
        "engine_off_at",
        "engine_seconds",
        "track_entry_at",
        "track_exit_at",
        "track_seconds",
        "laps_count",
        "laps",
        "best_lap_seconds",
        "max_speed",
        "max_rpm",
        "latitude",
        "longitude",
        "detected_circuit_id",
        "track_name",
        "detection_confidence",
        "points_count",
        "raw_storage_path",
        "metadata",
        "batch_metadata",
      ],
      notes: [
        "Questo endpoint crea una sessione ufficiale e può aggiornare ore mezzo/componenti.",
        "Il canale live-state resta separato e non crea sessioni né ore.",
        "La session authority del dispositivo deve essere external_logger.",
      ],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_SUMMARY_BODY_BYTES) {
    return NextResponse.json(
      { error: "Payload troppo grande. Il raw ad alta frequenza deve essere caricato separatamente." },
      { status: 413 }
    );
  }

  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) {
    return NextResponse.json({ error: "Header x-device-key mancante." }, { status: 401 });
  }

  let body: { external_batch_id?: unknown; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  if (
    typeof body.external_batch_id !== "string" ||
    !body.external_batch_id.trim() ||
    body.external_batch_id.length > 200
  ) {
    return NextResponse.json({ error: "external_batch_id obbligatorio (max 200 caratteri)." }, { status: 400 });
  }

  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return NextResponse.json({ error: "payload obbligatorio." }, { status: 400 });
  }

  const payload = body.payload as Record<string, unknown>;
  if (typeof payload.started_at !== "string" || !payload.started_at.trim()) {
    return NextResponse.json({ error: "payload.started_at obbligatorio." }, { status: 400 });
  }
  if (typeof payload.ended_at !== "string" || !payload.ended_at.trim()) {
    return NextResponse.json(
      { error: "payload.ended_at obbligatorio per una sessione ufficiale conclusa." },
      { status: 400 }
    );
  }
  if (payload.laps !== undefined && !Array.isArray(payload.laps)) {
    return NextResponse.json({ error: "payload.laps deve essere un array." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Configurazione server incompleta." }, { status: 500 });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/ingest_connected_session`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_device_key: deviceKey,
      p_external_batch_id: body.external_batch_id.trim(),
      p_payload: payload,
    }),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Errore ingest sconosciuto." };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message || "Ingest rifiutato")
        : "Ingest rifiutato";
    const status = /chiave|credenziale|dispositivo non attivo/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message, channel: "official_session" }, { status });
  }

  return NextResponse.json(data, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
