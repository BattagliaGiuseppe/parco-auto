import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { extractTeamFilePath, resolveTeamFileUrl, TEAM_FILES_BUCKET } from "@/lib/storage";

export const DRIVER_DOCUMENTS_BUCKET = "driver-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type DriverDocumentStorageFields = {
  file_path?: string | null;
  file_url?: string | null;
  storage_path?: string | null;
};

function normalizePath(path: string) {
  return path.replace(/^\/+/, "");
}

function assertWorkspacePath(path: string, teamId: string) {
  const normalizedPath = normalizePath(path);
  const pathTeamId = normalizedPath.split("/", 1)[0];
  if (!pathTeamId || pathTeamId !== teamId) {
    throw new Error("Documento non appartenente al workspace attivo.");
  }
  return normalizedPath;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export function hasDriverDocumentFile(doc: DriverDocumentStorageFields) {
  return Boolean(doc.file_path || doc.storage_path || doc.file_url);
}

export async function resolveDriverDocumentUrl(
  doc: DriverDocumentStorageFields,
  expiresIn = SIGNED_URL_TTL_SECONDS,
) {
  if (doc.file_path) {
    const ctx = await getCurrentTeamContext();
    const path = assertWorkspacePath(doc.file_path, ctx.teamId);
    const { data, error } = await supabase.storage
      .from(DRIVER_DOCUMENTS_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  }

  return resolveTeamFileUrl(doc.file_url, doc.storage_path, expiresIn);
}

export async function uploadDriverDocumentFile(params: {
  driverId: string;
  documentId: string;
  file: File;
}) {
  const ctx = await getCurrentTeamContext();
  const path = `${ctx.teamId}/${params.driverId}/${params.documentId}_${Date.now()}_${safeFileName(params.file.name)}`;
  const { error } = await supabase.storage
    .from(DRIVER_DOCUMENTS_BUCKET)
    .upload(path, params.file, { upsert: false, cacheControl: "3600" });
  if (error) throw error;

  return {
    path,
    fileName: params.file.name,
    mimeType: params.file.type || null,
    sizeBytes: params.file.size || null,
  };
}

export async function removeDriverDocumentFile(doc: DriverDocumentStorageFields) {
  const ctx = await getCurrentTeamContext();
  const removals: Promise<unknown>[] = [];

  if (doc.file_path) {
    const path = assertWorkspacePath(doc.file_path, ctx.teamId);
    removals.push(
      supabase.storage.from(DRIVER_DOCUMENTS_BUCKET).remove([path]).then(({ error }) => {
        if (error) throw error;
      }),
    );
  }

  const legacyTeamPath = doc.storage_path || extractTeamFilePath(doc.file_url);
  if (legacyTeamPath) {
    const path = assertWorkspacePath(legacyTeamPath, ctx.teamId);
    removals.push(
      supabase.storage.from(TEAM_FILES_BUCKET).remove([path]).then(({ error }) => {
        if (error) throw error;
      }),
    );
  }

  await Promise.all(removals);
}
