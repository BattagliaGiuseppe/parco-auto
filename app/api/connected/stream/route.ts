import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_STREAM_BODY_BYTES = 1024 * 1024;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_STREAM_BODY_BYTES) {
    return NextResponse.json({ error: "Finestra stream troppo grande." }, { status: 413 });
  }

  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) return NextResponse.json({ error: "Header x-device-key mancante." }, { status: 401 });

  let body: { external_window_id?: string; payload?: Record<string, unknown> };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "JSON non valido." }, { status: 400 }); }

  if (!body.external_window_id || typeof body.external_window_id !== "string") {
    return NextResponse.json({ error: "external_window_id obbligatorio." }, { status: 400 });
  }
  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return NextResponse.json({ error: "payload obbligatorio." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: "Configurazione server incompleta." }, { status: 500 });

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/ingest_connected_stream_window`, {
    method: "POST",
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_device_key: deviceKey, p_external_window_id: body.external_window_id, p_payload: body.payload }),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { error: text || "Errore stream sconosciuto." }; }

  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data
      ? String((data as { message?: unknown }).message || "Stream rifiutato")
      : "Stream rifiutato";
    const status = /chiave|credenziale|dispositivo non attivo/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json(data, { status: 200 });
}
