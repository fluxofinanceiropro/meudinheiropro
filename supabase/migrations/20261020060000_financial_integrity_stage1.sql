-- Stage 1: atomic balance adjustment and reconciliation of income-linked reserve.
-- Review and apply to a staging database before production.
create or replace function public.adjust_workspace_balances(_workspace uuid, _changes jsonb)
returns integer language plpgsql security invoker set search_path=public as $$
declare ch jsonb; account_row public.accounts%rowtype; balance_now numeric;
  expected_cents bigint; desired_cents bigint; count_changed int := 0; seen uuid[] := '{}'::uuid[];
begin
 if not public.can_edit_workspace(_workspace) then raise exception 'Sem permissão para ajustar saldos'; end if;
 if jsonb_typeof(_changes) <> 'array' or jsonb_array_length(_changes) > 100 then
  raise exception 'Lista de ajustes inválida';
 end if;
 -- Lock all accounts in stable order, so concurrent adjustments cannot silently overwrite one another.
 perform 1 from public.accounts where workspace_id=_workspace and deleted_at is null
   and id in (select (v->>'id')::uuid from jsonb_array_elements(_changes) v)
   order by id for update;
 for ch in select value from jsonb_array_elements(_changes) loop
  if not (ch ? 'id' and ch ? 'expected_cents' and ch ? 'desired_cents') then
   raise exception 'Ajuste incompleto';
  end if;
  if (ch->>'id')::uuid = any(seen) then raise exception 'Conta repetida'; end if;
  seen := array_append(seen,(ch->>'id')::uuid);
  select * into account_row from public.accounts
    where id=(ch->>'id')::uuid and workspace_id=_workspace and deleted_at is null;
  if not found then raise exception 'Conta não encontrada'; end if;
  select balance into balance_now from public.account_balances
    where account_id=account_row.id and workspace_id=_workspace;
  if balance_now is null then raise exception 'Saldo indisponível'; end if;
  expected_cents := (ch->>'expected_cents')::bigint;
  desired_cents := (ch->>'desired_cents')::bigint;
  if round(balance_now*100)::bigint <> expected_cents then
    raise exception 'O saldo mudou. Atualize a tela e tente novamente';
  end if;
  update public.accounts set initial_balance=initial_balance + (desired_cents-expected_cents)::numeric/100
    where id=account_row.id and workspace_id=_workspace;
  count_changed:=count_changed+1;
 end loop;
 return count_changed;
end $$;
revoke all on function public.adjust_workspace_balances(uuid,jsonb) from public;
grant execute on function public.adjust_workspace_balances(uuid,jsonb) to authenticated;

-- Keep previously recorded 10% reserve in sync when the linked income changes.
create or replace function public.sync_linked_reserve_on_income_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.kind='income' and (old.amount is distinct from new.amount
    or old.status is distinct from new.status or old.deleted_at is distinct from new.deleted_at
    or old.occurred_on is distinct from new.occurred_on or old.description is distinct from new.description) then
   update public.goal_entries e set
     deleted_at = case when new.deleted_at is not null or new.status <> 'paid' or new.kind <> 'income'
                       then coalesce(e.deleted_at,now()) else null end,
     amount = case when new.deleted_at is null and new.status='paid' and new.kind='income'
                     then round(new.amount*0.1,2) else e.amount end,
     occurred_on = new.occurred_on,
     note = 'Reserva de 10%: ' || new.description
   where e.source_transaction_id = new.id;
 end if;
 return new;
end $$;
drop trigger if exists trg_sync_linked_reserve on public.transactions;
create trigger trg_sync_linked_reserve after update of amount,status,deleted_at,occurred_on,description,kind
on public.transactions for each row execute function public.sync_linked_reserve_on_income_change();
