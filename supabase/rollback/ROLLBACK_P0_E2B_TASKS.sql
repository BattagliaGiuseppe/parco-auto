-- Ripristina le policy Tasks precedenti a P0-E.2B.
DROP TRIGGER IF EXISTS tasks_enforce_assignment_permission ON public.tasks;
DROP FUNCTION IF EXISTS public.enforce_task_assignment_permission();

DROP POLICY IF EXISTS tasks_select_permission ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_permission ON public.tasks;
DROP POLICY IF EXISTS tasks_update_permission ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_permission ON public.tasks;
CREATE POLICY tasks_select_team ON public.tasks FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY tasks_insert_team ON public.tasks FOR INSERT WITH CHECK (public.is_team_member(team_id));
CREATE POLICY tasks_update_team ON public.tasks FOR UPDATE USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id));
CREATE POLICY tasks_delete_team_manager ON public.tasks FOR DELETE USING (public.is_team_manager(team_id));

DROP POLICY IF EXISTS task_checklist_items_select_permission ON public.task_checklist_items;
DROP POLICY IF EXISTS task_checklist_items_insert_permission ON public.task_checklist_items;
DROP POLICY IF EXISTS task_checklist_items_update_permission ON public.task_checklist_items;
DROP POLICY IF EXISTS task_checklist_items_delete_permission ON public.task_checklist_items;
CREATE POLICY task_checklist_items_select_team ON public.task_checklist_items FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY task_checklist_items_insert_team ON public.task_checklist_items FOR INSERT WITH CHECK (public.is_team_member(team_id));
CREATE POLICY task_checklist_items_update_team ON public.task_checklist_items FOR UPDATE USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id));
CREATE POLICY task_checklist_items_delete_team ON public.task_checklist_items FOR DELETE USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS task_comments_select_permission ON public.task_comments;
DROP POLICY IF EXISTS task_comments_insert_permission ON public.task_comments;
DROP POLICY IF EXISTS task_comments_update_permission ON public.task_comments;
DROP POLICY IF EXISTS task_comments_delete_permission ON public.task_comments;
CREATE POLICY task_comments_select_team ON public.task_comments FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY task_comments_insert_team ON public.task_comments FOR INSERT WITH CHECK (public.is_team_member(team_id));
CREATE POLICY task_comments_update_manager ON public.task_comments FOR UPDATE USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));
CREATE POLICY task_comments_delete_manager ON public.task_comments FOR DELETE USING (public.is_team_manager(team_id));
