export type LoggerAdapterChannel = "live_state" | "official_session";

export type JsonObject = Record<string, unknown>;

export type LoggerAdapterContext = {
  channel: LoggerAdapterChannel;
  receivedAt: string;
};

export type LoggerAdapterResult = {
  payload: JsonObject;
  adapterId: string;
  adapterVersion: string;
};

export interface LoggerAdapter {
  id: string;
  version: string;
  label: string;
  description: string;
  channels: readonly LoggerAdapterChannel[];
  normalizeLiveState?: (payload: JsonObject, context: LoggerAdapterContext) => JsonObject;
  normalizeOfficialSession?: (payload: JsonObject, context: LoggerAdapterContext) => JsonObject;
}
