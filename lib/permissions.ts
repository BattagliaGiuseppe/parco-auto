import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  canManageTeamRole,
  getCurrentTeamContext,
  TeamContext,
  TeamRole,
} from "@/lib/teamContext";

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

export type PermissionAccessState = {
  loading: boolean;
  error: string | null;
  ctx: TeamContext | null;
  permissionCodes: string[];
  hasPermission: (
    permissionCode: string | string[],
    fallbackRoles?: string[]
  ) => boolean;
  canManageSettings: boolean;
  canManageTeam: boolean;
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

export function hasPermissionCode(
  permissionCodes: string[],
  permissionCode: string | string[]
) {
  const required = Array.isArray(permissionCode) ? permissionCode : [permissionCode];
  return required.some((code) => permissionCodes.includes(code));
}

export function hasPermissionOrRole(params: {
  permissionCodes: string[];
  permissionCode: string | string[];
  role?: string | null;
  fallbackRoles?: string[];
}) {
  if (hasPermissionCode(params.permissionCodes, params.permissionCode)) {
    return true;
  }

  if (!params.role || !params.fallbackRoles?.length) {
    return false;
  }

  return params.fallbackRoles.includes(params.role);
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

export function usePermissionAccess(): PermissionAccessState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<TeamContext | null>(null);
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const currentCtx = await getCurrentTeamContext();
        const permissions = await getCurrentUserEffectivePermissions();

        if (!active) return;

        setCtx(currentCtx);
        setPermissionCodes(permissions);
      } catch (error) {
        console.error("Errore caricamento permessi:", error);

        if (!active) return;

        setCtx(null);
        setPermissionCodes([]);
        setError(
          error instanceof Error
            ? error.message
            : "Errore durante la verifica dei permessi."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const hasPermission = useCallback(
    (permissionCode: string | string[], fallbackRoles?: string[]) => {
      return hasPermissionOrRole({
        permissionCodes,
        permissionCode,
        role: ctx?.role ?? null,
        fallbackRoles,
      });
    },
    [ctx?.role, permissionCodes]
  );

  return {
    loading,
    error,
    ctx,
    permissionCodes,
    hasPermission,
    canManageSettings: hasPermission("settings.manage", ["owner", "admin"]),
    canManageTeam:
      hasPermission("team.manage", ["owner", "admin"]) ||
      canManageTeamRole(ctx?.role),
  };
}
