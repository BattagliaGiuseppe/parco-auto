import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOGGER_ADAPTER_ID, normalizeLoggerPayload } from "@/lib/connected/logger-adapters";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 64 * 1024;

function serverConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
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
  try {
    const { response, data } = await callRpc("get_connected_live_state", { p_device_key: deviceKey });
    if (!response.ok) {
      const message = errorMessage(data, "Stato live non disponibile");
      return NextResponse.json({ error: message }, { status: /chiave|credenziale|dispositivo non attivo/i.test(message) ? 401 : 400 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore server." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload live troppo grande." }, { status: 413 });
  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) return NextResponse.json({ error: "Header x-device-key mancante." }, { status: 401 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "JSON non valido." }, { status: 400 }); }
  try {
    const adapterId = request.headers.get("x-logger-adapter")?.trim() || DEFAULT_LOGGER_ADAPTER_ID;
    const normalized = normalizeLoggerPayload(adapterId, "live_state", payload);
    const { response, data } = await callRpc("publish_connected_live_state", { p_device_key: deviceKey, p_payload: normalized.payload });
    if (!response.ok) {
      const message = errorMessage(data, "Stato live rifiutato");
      return NextResponse.json({ error: message }, { status: /chiave|credenziale|dispositivo non attivo/i.test(message) ? 401 : 400 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore server." }, { status: 500 });
  }
}
