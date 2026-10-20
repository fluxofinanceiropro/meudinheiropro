-- Restricted SaaS administration. Apply only after the core SaaS migration.
create table if not exists public.saas_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.saas_admins enable row level security;
-- No direct client policies: all reads and mutations go through explicitly checked RPCs.
create or replace function public.is_saas_admin()
returns boolean language sql stable security definer
set search_path = public as $$
 select exists (select 1 from public.saas_admins where user_id = (select auth.uid()))
$$;
revoke all on function public.is_saas_admin() from public;
grant execute on function public.is_saas_admin() to authenticated;

create or replace function public.admin_saas_overview()
returns table (
  owner_id uuid, name text, email text, subscription_status text,
  trial_ends_at timestamptz, paid_until timestamptz,
  workspace_count bigint, pending_payments bigint, legacy_access boolean
)
language plpgsql security definer set search_path = public as $$
begin
 if not public.is_saas_admin() then raise exception 'Acesso negado'; end if;
 return query
 select s.owner_id,
        coalesce(p.full_name,'Cliente')::text,
        coalesce(u.email,'')::text,
        case when s.legacy_access then 'legacy'
             when s.paid_until > now() then 'active'
             when s.trial_ends_at > now() then 'trial'
             else 'expired' end::text,
        s.trial_ends_at, s.paid_until,
        (select count(*) from public.workspaces w where w.owner_id=s.owner_id and w.deleted_at is null),
        (select count(*) from public.saas_payment_requests r where r.owner_id=s.owner_id and r.status='pending'),
        s.legacy_access
 from public.saas_subscriptions s
 join auth.users u on u.id=s.owner_id
 left join public.profiles p on p.id=s.owner_id
 order by s.created_at desc;
end $$;
revoke all on function public.admin_saas_overview() from public;
grant execute on function public.admin_saas_overview() to authenticated;

create or replace function public.admin_pending_payments()
returns table(id uuid, owner_id uuid, name text, email text, amount numeric, plan_code text,
              created_at timestamptz, status text)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_saas_admin() then raise exception 'Acesso negado'; end if;
 return query
 select r.id, r.owner_id, coalesce(p.full_name,'Cliente')::text,
        coalesce(u.email,'')::text, r.amount, r.plan_code, r.created_at, r.status
 from public.saas_payment_requests r
 join auth.users u on u.id=r.owner_id
 left join public.profiles p on p.id=r.owner_id
 where r.status='pending' order by r.created_at desc;
end $$;
revoke all on function public.admin_pending_payments() from public;
grant execute on function public.admin_pending_payments() to authenticated;

create or replace function public.admin_confirm_pix(_request_id uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare requester uuid; paid timestamptz; request_plan text;
begin
 if not public.is_saas_admin() then raise exception 'Acesso negado'; end if;
 select owner_id, plan_code into requester, request_plan from public.saas_payment_requests
 where id=_request_id and status='pending' for update;
 if requester is null then raise exception 'Cobrança já processada ou inexistente'; end if;
 update public.saas_subscriptions s
 set paid_until=case when request_plan='annual' then greatest(now(),coalesce(s.paid_until,now()))+interval '1 year' else greatest(now(),coalesce(s.paid_until,now()))+interval '30 days' end
 where s.owner_id=requester returning s.paid_until into paid;
 if paid is null then raise exception 'Assinatura não encontrada'; end if;
 update public.saas_payment_requests set status='confirmed',confirmed_at=now()
 where id=_request_id;
 return paid;
end $$;
revoke all on function public.admin_confirm_pix(uuid) from public;
grant execute on function public.admin_confirm_pix(uuid) to authenticated;

-- Administrator must be explicitly enrolled using a verified auth.users UUID,
-- never inferred from a display name, public email or a client-controlled value.
-- Example AFTER account verification:
-- insert into public.saas_admins(user_id) values ('VERIFIED-AUTH-USER-UUID');
