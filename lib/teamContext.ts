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
export const PENDING_INVITE_TOKEN_STORAGE_KEY = "parcoauto.pendingInviteToken";

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

export type TeamInvite = {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole | string;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired" | string;
  expires_at: string;
  note?: string | null;
  created_at?: string;
  team_name?: string | null;
};

export type PublicInviteInfo = {
  id: string;
  team_name: string;
  email: string;
  role: TeamRole | string;
  status: string;
  expires_at: string;
  is_valid: boolean;
};

function readStorageValue(key: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string | null) {
  if (typeof window === "undefined") return;

  try {
    if (!value) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage issues in private mode / restricted environments
  }
}

function readPreferredTeamUserId(): string | null {
  return readStorageValue(PREFERRED_TEAM_USER_STORAGE_KEY);
}

export function setPreferredTeamUserId(teamUserId: string | null) {
  writeStorageValue(PREFERRED_TEAM_USER_STORAGE_KEY, teamUserId);
}

export function readPendingInviteToken() {
  return readStorageValue(PENDING_INVITE_TOKEN_STORAGE_KEY);
}

export function setPendingInviteToken(token: string | null) {
  writeStorageValue(PENDING_INVITE_TOKEN_STORAGE_KEY, token);
}

export function clearPendingInviteToken() {
  writeStorageValue(PENDING_INVITE_TOKEN_STORAGE_KEY, null);
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

export async function getTeamInvites(teamId?: string): Promise<TeamInvite[]> {
  const currentTeamId = teamId || (await getCurrentTeamContext()).teamId;

  const { data, error } = await supabase
    .from("team_invites")
    .select("id, team_id, email, role, token, status, expires_at, note, created_at")
    .eq("team_id", currentTeamId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as TeamInvite[];
}

export async function listMyPendingTeamInvites(): Promise<TeamInvite[]> {
  const { data, error } = await supabase.rpc("list_my_pending_team_invites");

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as TeamInvite[]).map((invite) => ({
    ...invite,
    team_name: invite.team_name ?? null,
  }));
}

export async function getPublicInviteByToken(token: string): Promise<PublicInviteInfo | null> {
  const { data, error } = await supabase.rpc("get_public_team_invite", {
    p_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as PublicInviteInfo[];
  return rows[0] || null;
}

export async function createTeamInvite(params: {
  teamId: string;
  email: string;
  role: TeamRole | string;
  note?: string;
  expiresInDays?: number;
}): Promise<TeamInvite> {
  const { data, error } = await supabase.rpc("create_team_invite", {
    p_team_id: params.teamId,
    p_email: params.email,
    p_role: params.role,
    p_note: params.note || null,
    p_expires_in_days: params.expiresInDays ?? 7,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as TeamInvite[];
  const invite = rows[0];

  if (!invite) {
    throw new Error("Invito non creato correttamente");
  }

  return invite;
}

export async function acceptTeamInvite(token: string): Promise<{ team_user_id: string; team_id: string }> {
  const { data, error } = await supabase.rpc("accept_team_invite", {
    p_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as { team_user_id: string; team_id: string }[];
  const accepted = rows[0];

  if (!accepted) {
    throw new Error("Invito non accettato correttamente");
  }

  return accepted;
}
