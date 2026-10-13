ALTER TABLE public.goal_entries ADD COLUMN account_id UUID REFERENCES public.accounts(id);
CREATE INDEX goal_entries_account_id_idx ON public.goal_entries(account_id);
CREATE OR REPLACE FUNCTION public.validate_goal_entry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = NEW.account_id AND a.workspace_id = NEW.workspace_id AND a.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Conta inválida para este espaço';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goal_entries_validate BEFORE INSERT OR UPDATE ON public.goal_entries FOR EACH ROW EXECUTE FUNCTION public.validate_goal_entry();
CREATE OR REPLACE VIEW public.account_balances WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.workspace_id, a.name, a.kind, a.initial_balance,
  (a.initial_balance
    + COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.deleted_at IS NULL AND t.status='paid' AND t.kind='income' AND t.account_id=a.id),0)
    - COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.deleted_at IS NULL AND t.status='paid' AND t.kind='expense' AND t.account_id=a.id),0)
    - COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.deleted_at IS NULL AND t.status='paid' AND t.kind='transfer' AND t.account_id=a.id),0)
    + COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.deleted_at IS NULL AND t.status='paid' AND t.kind='transfer' AND t.to_account_id=a.id),0)
    - COALESCE((SELECT SUM(g.amount) FROM public.goal_entries g WHERE g.deleted_at IS NULL AND g.account_id=a.id),0)
  )::NUMERIC(14,2) AS balance
FROM public.accounts a WHERE a.deleted_at IS NULL;
GRANT SELECT ON public.account_balances TO authenticated;