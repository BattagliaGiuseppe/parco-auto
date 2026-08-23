-- Ripristina i vecchi controlli manager per Impostazioni/Team.
-- NOTA: la correzione di teams_select viene volutamente mantenuta e NON viene riportato il precedente refuso tu.team_id = tu.id.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('app_settings'),('team_component_definitions'),('team_checklists'),
    ('team_checklist_items'),('team_setup_fields'),('team_dashboard_widgets')
  ) x(table_name)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name||'_insert_permission', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name||'_update_permission', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name||'_delete_permission', r.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_team_manager(team_id))', r.table_name||'_insert_manager', r.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id))', r.table_name||'_update_manager', r.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_team_manager(team_id))', r.table_name||'_delete_manager', r.table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS team_users_update_permission ON public.team_users;
CREATE POLICY team_users_update_team_manager ON public.team_users FOR UPDATE USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

DROP TRIGGER IF EXISTS team_user_permissions_prevent_owner ON public.team_user_permissions;
DROP FUNCTION IF EXISTS public.prevent_owner_permission_overrides();

DROP POLICY IF EXISTS team_user_permissions_select_permission ON public.team_user_permissions;
DROP POLICY IF EXISTS team_user_permissions_insert_permission ON public.team_user_permissions;
DROP POLICY IF EXISTS team_user_permissions_update_permission ON public.team_user_permissions;
DROP POLICY IF EXISTS team_user_permissions_delete_permission ON public.team_user_permissions;
CREATE POLICY team_user_permissions_select_team ON public.team_user_permissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.team_users tu WHERE tu.id=team_user_permissions.team_user_id AND (public.is_team_manager(tu.team_id) OR tu.auth_user_id=auth.uid()))
);
CREATE POLICY team_user_permissions_insert_team ON public.team_user_permissions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.team_users tu WHERE tu.id=team_user_permissions.team_user_id AND public.is_team_manager(tu.team_id))
);
CREATE POLICY team_user_permissions_update_team ON public.team_user_permissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.team_users tu WHERE tu.id=team_user_permissions.team_user_id AND public.is_team_manager(tu.team_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.team_users tu WHERE tu.id=team_user_permissions.team_user_id AND public.is_team_manager(tu.team_id))
);
CREATE POLICY team_user_permissions_delete_team ON public.team_user_permissions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.team_users tu WHERE tu.id=team_user_permissions.team_user_id AND public.is_team_manager(tu.team_id))
);

DROP POLICY IF EXISTS team_invites_select_permission ON public.team_invites;
DROP POLICY IF EXISTS team_invites_insert_permission ON public.team_invites;
DROP POLICY IF EXISTS team_invites_update_permission ON public.team_invites;
DROP POLICY IF EXISTS team_invites_delete_permission ON public.team_invites;
CREATE POLICY team_invites_select_manager ON public.team_invites FOR SELECT USING (public.is_team_manager(team_id));
CREATE POLICY team_invites_insert_manager ON public.team_invites FOR INSERT WITH CHECK (public.is_team_manager(team_id));
CREATE POLICY team_invites_update_manager ON public.team_invites FOR UPDATE USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));
CREATE POLICY team_invites_delete_manager ON public.team_invites FOR DELETE USING (public.is_team_manager(team_id));

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.team_users tu WHERE tu.team_id=teams.id AND tu.auth_user_id=auth.uid() AND tu.is_active=true)
);
