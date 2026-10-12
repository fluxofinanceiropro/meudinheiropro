CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  kind text NOT NULL DEFAULT 'goal' CHECK (kind IN ('reserve','goal')),
  target_amount numeric NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX goals_workspace_idx ON public.goals(workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read goals" ON public.goals FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "update goals" ON public.goals FOR UPDATE TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "delete goals" ON public.goals FOR DELETE TO authenticated USING (public.can_edit_workspace(workspace_id));
CREATE TRIGGER goals_touch BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.goal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount <> 0),
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX goal_entries_goal_idx ON public.goal_entries(goal_id);
CREATE INDEX goal_entries_ws_idx ON public.goal_entries(workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_entries TO authenticated;
GRANT ALL ON public.goal_entries TO service_role;
ALTER TABLE public.goal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read goal entries" ON public.goal_entries FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "insert goal entries" ON public.goal_entries FOR INSERT TO authenticated WITH CHECK (public.can_edit_workspace(workspace_id) AND created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.workspace_id = goal_entries.workspace_id));
CREATE POLICY "update goal entries" ON public.goal_entries FOR UPDATE TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "delete goal entries" ON public.goal_entries FOR DELETE TO authenticated USING (public.can_edit_workspace(workspace_id));
CREATE TRIGGER goal_entries_touch BEFORE UPDATE ON public.goal_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();