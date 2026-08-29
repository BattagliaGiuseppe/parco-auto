import type { JsonObject, LoggerAdapter } from "./types";

function cloneObject(payload: JsonObject): JsonObject {
  return { ...payload };
}

export const canonicalV1Adapter: LoggerAdapter = {
  id: "canonical_v1",
  version: "1.0.0",
  label: "Motorsport Management Canonical v1",
  description: "Formato canonico nativo della piattaforma. Non modifica i nomi campo del payload.",
  channels: ["live_state", "official_session"],
  normalizeLiveState(payload) {
    return cloneObject(payload);
  },
  normalizeOfficialSession(payload) {
    return cloneObject(payload);
  },
};
