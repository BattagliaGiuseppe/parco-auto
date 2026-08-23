import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";

export const TEAM_FILES_BUCKET = "team-files";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function normalizePath(path: string) {
  return path.replace(/^\/+/, "");
}

export function extractTeamFilePath(source?: string | null) {
  if (!source) return null;
  const value = source.trim();
  if (!value) return null;

  if (value.startsWith("team-file://")) {
    return normalizePath(value.slice("team-file://".length));
  }

  const markers = [
    `/storage/v1/object/public/${TEAM_FILES_BUCKET}/`,
    `/storage/v1/object/sign/${TEAM_FILES_BUCKET}/`,
    `/storage/v1/object/authenticated/${TEAM_FILES_BUCKET}/`,
  ];

  for (const marker of markers) {
    const markerIndex = value.indexOf(marker);
    if (markerIndex >= 0) {
      const rawPath = value.slice(markerIndex + marker.length).split("?")[0];
      try {
        return normalizePath(decodeURIComponent(rawPath));
      } catch {
        return normalizePath(rawPath);
      }
    }
  }

  return null;
}

export async function createTeamFileSignedUrl(path: string, expiresIn = SIGNED_URL_TTL_SECONDS) {
  const normalizedPath = normalizePath(path);
  const ctx = await getCurrentTeamContext();
  const pathTeamId = normalizedPath.split("/", 1)[0];

  if (!pathTeamId || pathTeamId !== ctx.teamId) {
    throw new Error("File non appartenente al workspace attivo.");
  }

  const { data, error } = await supabase.storage
    .from(TEAM_FILES_BUCKET)
    .createSignedUrl(normalizedPath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

export async function resolveTeamFileUrl(
  source?: string | null,
  storagePath?: string | null,
  expiresIn = SIGNED_URL_TTL_SECONDS,
) {
  const explicitPath = storagePath ? normalizePath(storagePath) : null;
  const legacyPath = extractTeamFilePath(source);
  const path = explicitPath || legacyPath;

  if (path) return createTeamFileSignedUrl(path, expiresIn);
  return source?.trim() || null;
}

export async function uploadTeamFile(params: {
  file: File;
  area: string;
  recordId?: string;
}) {
  const ctx = await getCurrentTeamContext();
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `${ctx.teamId}/${params.area}/${params.recordId || "generic"}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(TEAM_FILES_BUCKET).upload(path, params.file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const storageRef = `team-file://${path}`;
  const signedUrl = await createTeamFileSignedUrl(path);

  return {
    path,
    storageRef,
    // Alias temporaneo per retrocompatibilità con eventuali chiamanti non ancora migrati.
    publicUrl: storageRef,
    signedUrl,
    fileName: params.file.name,
    mimeType: params.file.type || null,
    sizeBytes: params.file.size || null,
  };
}
