import { supabase } from "@/lib/supabaseClient";

export const TEAM_ROLES = [
  "owner",
  "admin",
  "engineer",
  "mechanic",
  "viewer",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  engineer: "Engineer",
  mechanic: "Mechanic",
  viewer: "Viewer",
};

export const PREFERRED_TEAM_USER_STORAGE_KEY = "parcoauto.preferredTeamUserId";

export type TeamContext = {
  authUserId: string;
  teamUserId: string;
  teamId: string;
  role: TeamRole | string;
  email: string | null;
  name: string | null;
};

export type TeamUser = {
  id: string;
  team_id: string;
  auth_user_id: string;
  role: TeamRole | string;
  email: string | null;
  name: string | null;
  is_active: boolean;
  created_at?: string;
};

export type TeamSettings = {
  id?: string;
  team_id: string;
  team_name?: string | null;
  team_subtitle?: string | null;
  enable_events?: boolean | null;
  enable_maintenances?: boolean | null;
  enable_notes?: boolean | null;
  modules?: Record<string, boolean> | null;
  branding?: Record<string, unknown> | null;
  vehicle_type?: string | null;
  preferences?: Record<string, unknown> | null;
};

function readPreferredTeamUserId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(PREFERRED_TEAM_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPreferredTeamUserId(teamUserId: string | null) {
  if (typeof window === "undefined") return;

  try {
    if (!teamUserId) {
      window.localStorage.removeItem(PREFERRED_TEAM_USER_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(PREFERRED_TEAM_USER_STORAGE_KEY, teamUserId);
  } catch {
    // ignore storage issues in private mode / restricted environments
  }
}

export function canManageTeamRole(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Utente non autenticato");
  }

  return user;
}

export async function getActiveTeamMemberships(): Promise<TeamUser[]> {
  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("team_users")
    .select("id, team_id, auth_user_id, role, email, name, is_active, created_at")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const memberships = (data || []) as TeamUser[];

  if (memberships.length === 0) {
    throw new Error("Nessun team associato all'utente");
  }

  return memberships;
}

export async function getCurrentTeamContext(): Promise<TeamContext> {
  const user = await getAuthenticatedUser();
  const memberships = await getActiveTeamMemberships();
  const preferredTeamUserId = readPreferredTeamUserId();

  const selectedMembership =
    memberships.find((membership) => membership.id === preferredTeamUserId) ||
    memberships[0];

  if (!selectedMembership) {
    throw new Error("Nessun team associato all'utente");
  }

  if (preferredTeamUserId !== selectedMembership.id) {
    setPreferredTeamUserId(selectedMembership.id);
  }

  return {
    authUserId: user.id,
    teamUserId: selectedMembership.id,
    teamId: selectedMembership.team_id,
    role: selectedMembership.role,
    email: selectedMembership.email ?? user.email ?? null,
    name: selectedMembership.name ?? null,
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
    .from("app_settings")
    .select("*")
    .eq("team_id", ctx.teamId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as TeamSettings | null) ?? null;
}
