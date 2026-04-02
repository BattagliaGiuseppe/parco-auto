import { supabase } from "@/lib/supabaseClient";

export type TeamContext = {
  authUserId: string;
  teamUserId: string;
  teamId: string;
  role: string;
  email: string | null;
  name: string | null;
};

export type TeamUser = {
  id: string;
  team_id: string;
  auth_user_id: string;
  role: string;
  email: string | null;
  name: string | null;
  is_active: boolean;
  created_at?: string;
};

export type TeamSettings = {
  id?: string;
  team_id: string;
  team_name?: string | null;
  branding?: Record<string, any> | null;
  enabled_modules?: Record<string, boolean> | null;
  vehicle_type?: string | null;
  preferences?: Record<string, any> | null;
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

export async function getTeamUsers(): Promise<TeamUser[]> {
  const ctx = await getCurrentTeamContext();

  const { data, error } = await supabase
    .from("team_users")
    .select("id, team_id, auth_user_id, role, email, name, is_active, created_at")
    .eq("team_id", ctx.teamId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as TeamUser[];
}

export async function getCurrentTeamSettings(): Promise<TeamSettings | null> {
  const ctx = await getCurrentTeamContext();

  const { data, error } = await supabase
    .from("team_settings")
    .select("*")
    .eq("team_id", ctx.teamId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as TeamSettings | null;
}