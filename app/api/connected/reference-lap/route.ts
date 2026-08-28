import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;

function serverConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { supabaseUrl, supabaseAnonKey };
}

async function callRpc(name: string, payload: Record<string, unknown>) {
  const { supabaseUrl, supabaseAnonKey } = serverConfig();
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Configurazione server incompleta.");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { error: text || "Errore RPC sconosciuto." }; }
  return { response, data };
}

function errorMessage(data: unknown, fallback: string) {
  if (typeof data === "object" && data && "message" in data) return String((data as { message?: unknown }).message || fallback);
  return fallback;
}

export async function GET(request: NextRequest) {
  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) return NextResponse.json({ error: "Header x-device-key mancante." }, { status: 401 });
  const circuitId = request.nextUrl.searchParams.get("circuit_id")?.trim();
  if (!circuitId) return NextResponse.json({ error: "circuit_id obbligatorio." }, { status: 400 });

  try {
    const { response, data } = await callRpc("get_connected_reference_lap", { p_device_key: deviceKey, p_circuit_id: circuitId });
    if (!response.ok) {
      const message = errorMessage(data, "Reference lap non disponibile");
      return NextResponse.json({ error: message }, { status: /chiave|credenziale|dispositivo non attivo/i.test(message) ? 401 : 400 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore server." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Reference lap troppo grande." }, { status: 413 });
  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) return NextResponse.json({ error: "Header x-device-key mancante." }, { status: 401 });

  let body: {
    circuit_id?: string;
    lap_time_seconds?: number;
    points?: unknown[];
    source_session_id?: string | null;
    source_lap_id?: string | null;
    force?: boolean;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "JSON non valido." }, { status: 400 }); }

  if (!body.circuit_id || typeof body.circuit_id !== "string") return NextResponse.json({ error: "circuit_id obbligatorio." }, { status: 400 });
  if (!Number.isFinite(body.lap_time_seconds)) return NextResponse.json({ error: "lap_time_seconds obbligatorio." }, { status: 400 });
  if (!Array.isArray(body.points) || body.points.length < 2 || body.points.length > 400) return NextResponse.json({ error: "points deve contenere tra 2 e 400 punti." }, { status: 400 });

  try {
    const { response, data } = await callRpc("publish_connected_reference_lap", {
      p_device_key: deviceKey,
      p_circuit_id: body.circuit_id,
      p_lap_time_seconds: body.lap_time_seconds,
      p_points: body.points,
      p_source_session_id: body.source_session_id || null,
      p_source_lap_id: body.source_lap_id || null,
      p_force: body.force === true,
    });
    if (!response.ok) {
      const message = errorMessage(data, "Reference lap rifiutato");
      return NextResponse.json({ error: message }, { status: /chiave|credenziale|dispositivo non attivo/i.test(message) ? 401 : 400 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore server." }, { status: 500 });
  }
}
