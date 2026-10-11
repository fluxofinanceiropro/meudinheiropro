CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  name text NOT NULL,
  limit_amount numeric NOT NULL DEFAULT 0,
  closing_day integer NOT NULL DEFAULT 1 CHECK (closing_day BETWEEN 1 AND 28),
  due_day integer NOT NULL DEFAULT 10 CHECK (due_day BETWEEN 1 AND 28),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read cards" ON public.cards FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY "insert cards" ON public.cards FOR INSERT TO authenticated WITH CHECK (can_edit_workspace(workspace_id));
CREATE POLICY "update cards" ON public.cards FOR UPDATE TO authenticated USING (can_edit_workspace(workspace_id)) WITH CHECK (can_edit_workspace(workspace_id));
CREATE POLICY "delete cards" ON public.cards FOR DELETE TO authenticated USING (can_edit_workspace(workspace_id));

CREATE INDEX cards_workspace_idx ON public.cards(workspace_id);

CREATE TRIGGER t_cards BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE public.transactions ADD COLUMN card_id uuid REFERENCES public.cards(id);
CREATE INDEX transactions_card_idx ON public.transactions(card_id);

CREATE OR REPLACE FUNCTION public.validate_transaction()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'Conta inválida para este espaço';
  END IF;
  IF NEW.to_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.to_account_id AND workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'Conta de destino inválida';
  END IF;
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id = NEW.category_id AND workspace_id = NEW.workspace_id AND kind = NEW.kind) THEN
    RAISE EXCEPTION 'Categoria inválida';
  END IF;
  IF NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cards WHERE id = NEW.card_id AND workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'Cartão inválido para este espaço';
  END IF;
  RETURN NEW;
END $function$;