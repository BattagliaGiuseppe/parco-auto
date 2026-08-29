import { NextResponse } from "next/server";
import { DEFAULT_LOGGER_ADAPTER_ID, listLoggerAdapters } from "@/lib/connected/logger-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      contract: "logger_adapter_layer",
      version: "p2.9.1",
      default_adapter: DEFAULT_LOGGER_ADAPTER_ID,
      selection_header: "x-logger-adapter",
      adapters: listLoggerAdapters(),
      notes: [
        "Gli adapter traducono formati logger proprietari nel formato canonico della piattaforma.",
        "L'adapter non decide session authority e non applica direttamente ore.",
        "Live State e Official Session restano due canali separati.",
      ],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
