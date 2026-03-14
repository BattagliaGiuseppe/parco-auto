import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";

export type TeamSettings = {
  team_name: string;
  team_logo_url: string | null;
  dashboard_cover_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
};

export async function getTeamSettings(): Promise<TeamSettings | null> {
  const ctx = await getCurrentTeamContext();

  const { data, error } = await supabase
    .from("app_settings")
    .select(`
      team_name,
      team_logo_url,
      dashboard_cover_url,
      primary_color,
      secondary_color,
      accent_color
    `)
    .eq("team_id", ctx.teamId)
    .maybeSingle();

  if (error) {
    console.error("Errore caricamento settings:", error);
    return null;
  }

  return data;
}