import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function config() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function messageFrom(data: unknown, fallback: string) {
  if (typeof data === "object" && data && "message" in data) {
    return String((data as { message?: unknown }).message || fallback);
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) return NextResponse.json({ error: "Header x-device-key mancante." }, { status: 401 });

  const { supabaseUrl, supabaseAnonKey } = config();
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: "Configurazione server incompleta." }, { status: 500 });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/activate_connected_hybrid_fallback`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_device_key: deviceKey }),
      cache: "no-store",
    });
    const text = await response.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = { message: text || "Errore RPC sconosciuto." }; }

    if (!response.ok) {
      const message = messageFrom(data, "Fallback non disponibile");
      const status = /chiave|credenziale|dispositivo non attivo/i.test(message) ? 401 : /logger.*online|soglia|offline|fallback/i.test(message) ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore server." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) return NextResponse.json({ error: "Header x-device-key mancante." }, { status: 401 });

  const { supabaseUrl, supabaseAnonKey } = config();
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: "Configurazione server incompleta." }, { status: 500 });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/release_connected_hybrid_fallback`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_device_key: deviceKey }),
      cache: "no-store",
    });
    const text = await response.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = { message: text || "Errore RPC sconosciuto." }; }

    if (!response.ok) {
      const message = messageFrom(data, "Impossibile disattivare il fallback");
      const status = /chiave|credenziale|dispositivo non attivo/i.test(message) ? 401 : /modalità ibrida/i.test(message) ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore server." }, { status: 500 });
  }
}
