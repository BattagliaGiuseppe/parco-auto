import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";

const BUCKET = 'team-files';

export async function uploadTeamFile(params: {
  file: File;
  area: string;
  recordId?: string;
}) {
  const ctx = await getCurrentTeamContext();
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const path = `${ctx.teamId}/${params.area}/${params.recordId || 'generic'}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
    fileName: params.file.name,
    mimeType: params.file.type || null,
    sizeBytes: params.file.size || null,
  };
}
