import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext, TeamRole } from "@/lib/teamContext";

export type AppPermission = {
  code: string;
  label: string | null;
  description: string | null;
};

export type RolePermissionRow = {
  role: TeamRole | string;
  permission_code: string;
};

export type TeamUserPermissionOverride = {
  id?: string;
  team_user_id: string;
  permission_code: string;
  is_allowed: boolean;
};

export function buildRolePermissionMap(rows: RolePermissionRow[]) {
  return rows.reduce<Record<string, Set<string>>>((acc, row) => {
    if (!acc[row.role]) {
      acc[row.role] = new Set<string>();
    }

    acc[row.role].add(row.permission_code);
    return acc;
  }, {});
}

export function buildTeamUserOverrideMap(rows: TeamUserPermissionOverride[]) {
  return rows.reduce<Record<string, Record<string, boolean>>>((acc, row) => {
    if (!acc[row.team_user_id]) {
      acc[row.team_user_id] = {};
    }

    acc[row.team_user_id][row.permission_code] = row.is_allowed;
    return acc;
  }, {});
}

export function getEffectivePermissionCodes(params: {
  role: string;
  rolePermissions: RolePermissionRow[];
  overrides?: TeamUserPermissionOverride[];
}) {
  const roleMap = buildRolePermissionMap(params.rolePermissions);
  const base = new Set(Array.from(roleMap[params.role] || []));

  for (const override of params.overrides || []) {
    if (override.is_allowed) {
      base.add(override.permission_code);
    } else {
      base.delete(override.permission_code);
    }
  }

  return Array.from(base).sort();
}

export async function getPermissionCatalog(): Promise<AppPermission[]> {
  const { data, error } = await supabase
    .from("app_permissions")
    .select("code, label, description")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as AppPermission[];
}

export async function getRolePermissions(): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("role, permission_code")
    .order("role", { ascending: true })
    .order("permission_code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as RolePermissionRow[];
}

export async function getTeamUserPermissionOverrides(teamUserIds: string[]) {
  if (teamUserIds.length === 0) {
    return [] as TeamUserPermissionOverride[];
  }

  const { data, error } = await supabase
    .from("team_user_permissions")
    .select("id, team_user_id, permission_code, is_allowed")
    .in("team_user_id", teamUserIds)
    .order("permission_code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as TeamUserPermissionOverride[];
}

export async function getCurrentUserEffectivePermissions() {
  const ctx = await getCurrentTeamContext();

  const [rolePermissions, overrides] = await Promise.all([
    getRolePermissions(),
    getTeamUserPermissionOverrides([ctx.teamUserId]),
  ]);

  return getEffectivePermissionCodes({
    role: ctx.role,
    rolePermissions,
    overrides: overrides.filter((row) => row.team_user_id === ctx.teamUserId),
  });
}
