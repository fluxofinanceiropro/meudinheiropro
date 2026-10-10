
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- WORKSPACES
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  kind TEXT NOT NULL CHECK (kind IN ('personal','freelancer','family')),
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX ON public.workspaces(owner_id);

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX ON public.workspace_members(user_id);

CREATE OR REPLACE FUNCTION public.is_workspace_member(_ws UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.can_edit_workspace(_ws UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws AND user_id = auth.uid() AND role IN ('owner','editor'))
$$;

GRANT SELECT, UPDATE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read ws" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id));
CREATE POLICY "owner updates ws" ON public.workspaces FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read members" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

-- ACCOUNTS
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  kind TEXT NOT NULL DEFAULT 'checking' CHECK (kind IN ('cash','checking','savings','other')),
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX ON public.accounts(workspace_id);

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX ON public.categories(workspace_id);

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income','expense','transfer')),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 120),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid')),
  payment_method TEXT CHECK (payment_method IN ('pix','cash','debit','transfer','boleto','other')),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK ((kind = 'transfer' AND to_account_id IS NOT NULL AND to_account_id <> account_id AND category_id IS NULL)
      OR (kind <> 'transfer' AND to_account_id IS NULL))
);
CREATE INDEX ON public.transactions(workspace_id, occurred_on DESC);
CREATE INDEX ON public.transactions(account_id);
CREATE INDEX ON public.transactions(to_account_id);
CREATE INDEX ON public.transactions(category_id);

-- integrity: referenced accounts/categories must belong to same workspace
CREATE OR REPLACE FUNCTION public.validate_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_transaction BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.validate_transaction();

CREATE TRIGGER t_ws BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_acc BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_cat BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_tx BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_prof BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- grants + RLS for financial tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts, public.categories, public.transactions TO authenticated;
GRANT ALL ON public.accounts, public.categories, public.transactions TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read accounts" ON public.accounts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "update accounts" ON public.accounts FOR UPDATE TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "delete accounts" ON public.accounts FOR DELETE TO authenticated USING (public.can_edit_workspace(workspace_id));

CREATE POLICY "read categories" ON public.categories FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "update categories" ON public.categories FOR UPDATE TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "delete categories" ON public.categories FOR DELETE TO authenticated USING (public.can_edit_workspace(workspace_id));

CREATE POLICY "read tx" ON public.transactions FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "insert tx" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.can_edit_workspace(workspace_id) AND created_by = auth.uid());
CREATE POLICY "update tx" ON public.transactions FOR UPDATE TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "delete tx" ON public.transactions FOR DELETE TO authenticated USING (public.can_edit_workspace(workspace_id));

-- BALANCES VIEW (respects caller RLS)
CREATE VIEW public.account_balances WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.workspace_id, a.name, a.kind, a.initial_balance,
  (a.initial_balance
    + COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.deleted_at IS NULL AND t.status='paid' AND t.kind='income' AND t.account_id=a.id),0)
    - COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.deleted_at IS NULL AND t.status='paid' AND t.kind='expense' AND t.account_id=a.id),0)
    - COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.deleted_at IS NULL AND t.status='paid' AND t.kind='transfer' AND t.account_id=a.id),0)
    + COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.deleted_at IS NULL AND t.status='paid' AND t.kind='transfer' AND t.to_account_id=a.id),0)
  )::NUMERIC(14,2) AS balance
FROM public.accounts a WHERE a.deleted_at IS NULL;
GRANT SELECT ON public.account_balances TO authenticated;

-- ONBOARDING RPC
CREATE OR REPLACE FUNCTION public.create_workspace(_name TEXT, _kind TEXT, _initial_balance NUMERIC, _account_name TEXT DEFAULT 'Conta principal')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws UUID; uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _kind NOT IN ('personal','freelancer','family') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  INSERT INTO public.workspaces(name, kind, owner_id) VALUES (trim(_name), _kind, uid) RETURNING id INTO ws;
  INSERT INTO public.workspace_members(workspace_id, user_id, role) VALUES (ws, uid, 'owner');
  INSERT INTO public.accounts(workspace_id, name, kind, initial_balance) VALUES (ws, COALESCE(NULLIF(trim(_account_name),''),'Conta principal'), 'checking', COALESCE(_initial_balance,0));
  INSERT INTO public.categories(workspace_id, name, kind)
  SELECT ws, n, 'expense' FROM unnest(ARRAY['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Compras','Contas e serviços','Outros']) n;
  INSERT INTO public.categories(workspace_id, name, kind)
  SELECT ws, n, 'income' FROM unnest(CASE WHEN _kind='freelancer' THEN ARRAY['Serviços prestados','Vendas','Outros'] ELSE ARRAY['Salário','Renda extra','Outros'] END) n;
  RETURN ws;
END $$;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT,TEXT,NUMERIC,TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT,TEXT,NUMERIC,TEXT) TO authenticated;
