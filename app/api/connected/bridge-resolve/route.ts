import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTRACT_VERSION = "p2.9.5.2.2";
const MAX_BODY_BYTES = 64 * 1024;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const OFFSET_RE = /(Z|[+-]\d{2}:\d{2})$/i;

function asTrimmedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.slice(0, maxLength);
}

export async function GET() {
  return NextResponse.json(
    {
      contract: "connected_bridge_route_resolver",
      version: CONTRACT_VERSION,
      authentication: { header: "x-bridge-key" },
      purpose: "Risoluzione fail-closed XRK -> logger autorizzato -> vettura. Non crea sessioni né ore.",
      statuses: ["resolved", "needs_mapping", "conflict", "blocked"],
      safe_to_ingest: "true solo quando status=resolved",
      required_identity_fields: ["file_sha256", "session_started_at"],
      optional_identity_fields: [
        "provider",
        "serial_number",
        "external_device_id",
        "vehicle_profile",
        "vehicle",
        "logger_model",
        "machine_name",
        "file_name",
        "metadata",
      ],
      notes: [
        "session_started_at deve essere ISO 8601 con timezone esplicita.",
        "Se Vehicle è presente ma non ancora associato, la risposta è needs_mapping anche con logger noto.",
        "Seriale/logger e Vehicle devono convergere sulla stessa vettura.",
        "Ogni tentativo autenticato viene persistito nella coda connected_routing_observations.",
      ],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload routing troppo grande." }, { status: 413 });
  }

  const bridgeKey = request.headers.get("x-bridge-key")?.trim();
  if (!bridgeKey) {
    return NextResponse.json({ error: "Header x-bridge-key mancante." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Identità routing non valida." }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const source = body.identity && typeof body.identity === "object" && !Array.isArray(body.identity)
    ? (body.identity as Record<string, unknown>)
    : body;

  const fileSha256 = asTrimmedString(source.file_sha256, 64)?.toLowerCase();
  if (!fileSha256 || !SHA256_RE.test(fileSha256)) {
    return NextResponse.json({ error: "identity.file_sha256 deve essere uno SHA-256 esadecimale di 64 caratteri." }, { status: 400 });
  }

  const sessionStartedAt = asTrimmedString(source.session_started_at, 64);
  if (!sessionStartedAt || !OFFSET_RE.test(sessionStartedAt) || Number.isNaN(Date.parse(sessionStartedAt))) {
    return NextResponse.json(
      { error: "identity.session_started_at deve essere ISO 8601 valido con timezone esplicita (Z oppure ±HH:MM)." },
      { status: 400 }
    );
  }

  const identity: Record<string, unknown> = {
    ...source,
    file_sha256: fileSha256,
    session_started_at: sessionStartedAt,
  };

  // Bound identity strings before forwarding them to the SECURITY DEFINER resolver.
  for (const [key, max] of [
    ["provider", 80],
    ["serial_number", 200],
    ["external_device_id", 200],
    ["vehicle_profile", 200],
    ["vehicle", 200],
    ["logger_model", 200],
    ["machine_name", 200],
    ["file_name", 500],
  ] as const) {
    const value = asTrimmedString(source[key], max);
    if (value) identity[key] = value;
    else delete identity[key];
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Configurazione server incompleta." }, { status: 500 });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_connected_bridge_route`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_bridge_key: bridgeKey, p_identity: identity }),
      cache: "no-store",
    });

    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || "Errore resolver sconosciuto." };
    }

    if (!response.ok) {
      const message =
        typeof data === "object" && data && "message" in data
          ? String((data as { message?: unknown }).message || "Resolver rifiutato")
          : "Resolver rifiutato";
      const status = /bridge key|credenziale bridge|revocata/i.test(message) ? 401 : 400;
      return NextResponse.json({ error: message, contract: "connected_bridge_route_resolver" }, { status });
    }

    return NextResponse.json(data, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore server resolver." },
      { status: 500 }
    );
  }
}
