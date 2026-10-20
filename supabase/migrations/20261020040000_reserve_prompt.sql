-- Voluntary 10% reserve prompt, per user. Defaults to disabled.
alter table public.profiles add column if not exists reserve_prompt_enabled boolean not null default false;
alter table public.goal_entries add column if not exists source_transaction_id uuid references public.transactions(id);
create unique index if not exists goal_entries_one_reserve_per_income on public.goal_entries(source_transaction_id) where source_transaction_id is not null;
-- Only the user who created a confirmed income can allocate it to a workspace reserve.
-- Allocation is bookkeeping in reserve goals; it does not debit the cash account.
create or replace function public.allocate_income_reserve(_transaction_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare tx public.transactions%rowtype; g uuid; new_entry uuid; cents bigint;
begin
 select * into tx from public.transactions
 where id=_transaction_id and created_by=auth.uid() and kind='income'
   and status='paid' and deleted_at is null;
 if not found then raise exception 'Entrada recebida não encontrada'; end if;
 if not public.can_edit_workspace(tx.workspace_id) then raise exception 'Sem permissão'; end if;
 if exists(select 1 from public.goal_entries where source_transaction_id=_transaction_id and deleted_at is null) then
   raise exception 'Reserva já registrada para esta entrada';
 end if;
 select id into g from public.goals where workspace_id=tx.workspace_id and kind='reserve' and deleted_at is null
 order by created_at, id limit 1;
 if g is null then
   insert into public.goals(workspace_id,name,kind,target_amount)
   values(tx.workspace_id,'Fundo de reserva','reserve',0) returning id into g;
 end if;
 cents := round(tx.amount*100)::bigint;
 if cents <= 0 then raise exception 'Valor insuficiente'; end if;
 insert into public.goal_entries(workspace_id,goal_id,amount,occurred_on,note,created_by,source_transaction_id)
 values(tx.workspace_id,g,round(cents*0.1)/100,tx.occurred_on,'Reserva de 10%: '||tx.description,auth.uid(),_transaction_id)
 returning id into new_entry;
 return new_entry;
end $$;
revoke all on function public.allocate_income_reserve(uuid) from public;
grant execute on function public.allocate_income_reserve(uuid) to authenticated;
