import { supabase } from "@/lib/supabaseClient";

export type TeamContext = {
  authUserId: string;
  teamUserId: string;
  teamId: string;
  role: string;
  email: string | null;
  name: string | null;
};

export async function getCurrentTeamContext(): Promise<TeamContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato");
  }

  const { data, error } = await supabase
    .from("team_users")
    .select("id, team_id, role, email, name")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error("Nessun team associato all'utente");
  }

  return {
    authUserId: user.id,
    teamUserId: data.id,
    teamId: data.team_id,
    role: data.role,
    email: data.email ?? user.email ?? null,
    name: data.name ?? null,
  };
}
