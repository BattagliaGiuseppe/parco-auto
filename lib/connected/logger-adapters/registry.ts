import { canonicalV1Adapter } from "./canonical-v1";
import type { JsonObject, LoggerAdapter, LoggerAdapterChannel, LoggerAdapterResult } from "./types";

const adapters = new Map<string, LoggerAdapter>([[canonicalV1Adapter.id, canonicalV1Adapter]]);

export const DEFAULT_LOGGER_ADAPTER_ID = canonicalV1Adapter.id;

export function listLoggerAdapters() {
  return Array.from(adapters.values()).map((adapter) => ({
    id: adapter.id,
    version: adapter.version,
    label: adapter.label,
    description: adapter.description,
    channels: [...adapter.channels],
  }));
}

export function getLoggerAdapter(adapterId?: string | null): LoggerAdapter {
  const normalizedId = adapterId?.trim() || DEFAULT_LOGGER_ADAPTER_ID;
  const adapter = adapters.get(normalizedId);
  if (!adapter) {
    throw new Error(`Logger adapter non supportato: ${normalizedId}`);
  }
  return adapter;
}

function withAdapterMetadata(payload: JsonObject, adapter: LoggerAdapter, channel: LoggerAdapterChannel): JsonObject {
  const metadata = payload.metadata;
  const safeMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as JsonObject)
    : {};
  return {
    ...payload,
    metadata: {
      ...safeMetadata,
      logger_adapter: adapter.id,
      logger_adapter_version: adapter.version,
      logger_adapter_channel: channel,
    },
  };
}

export function normalizeLoggerPayload(
  adapterId: string | null | undefined,
  channel: LoggerAdapterChannel,
  payload: JsonObject
): LoggerAdapterResult {
  const adapter = getLoggerAdapter(adapterId);
  if (!adapter.channels.includes(channel)) {
    throw new Error(`Logger adapter ${adapter.id} non supporta il canale ${channel}`);
  }

  const context = { channel, receivedAt: new Date().toISOString() } as const;
  let normalized: JsonObject;
  if (channel === "live_state") {
    if (!adapter.normalizeLiveState) throw new Error(`Logger adapter ${adapter.id} non supporta live_state`);
    normalized = adapter.normalizeLiveState(payload, context);
  } else {
    if (!adapter.normalizeOfficialSession) throw new Error(`Logger adapter ${adapter.id} non supporta official_session`);
    normalized = adapter.normalizeOfficialSession(payload, context);
  }

  return {
    payload: withAdapterMetadata(normalized, adapter, channel),
    adapterId: adapter.id,
    adapterVersion: adapter.version,
  };
}
