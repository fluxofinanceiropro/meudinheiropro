-- SaaS billing foundation. Review before running on production.
create table if not exists public.saas_subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '24 hours'),
  paid_until timestamptz,
  legacy_access boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.saas_subscriptions enable row level security;
create policy "owner read subscription" on public.saas_subscriptions
  for select to authenticated using (owner_id = auth.uid());

-- Preserve every customer who already has a workspace BEFORE trial enforcement.
insert into public.saas_subscriptions(owner_id, legacy_access)
select distinct owner_id, true from public.workspaces
on conflict (owner_id) do nothing;

create or replace function public.init_saas_subscription() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.saas_subscriptions(owner_id) values (new.owner_id)
  on conflict (owner_id) do nothing;
  return new;
end $$;
drop trigger if exists trg_init_saas_subscription on public.workspaces;
create trigger trg_init_saas_subscription after insert on public.workspaces
for each row execute function public.init_saas_subscription();

create or replace function public.saas_access_for_workspace(_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
 select exists (
   select 1 from public.workspaces w
   join public.saas_subscriptions s on s.owner_id=w.owner_id
   where w.id=_workspace
     and (s.legacy_access or s.trial_ends_at > now() or s.paid_until > now())
 )
$$;
create or replace function public.my_saas_status(_workspace uuid)
returns table(status text, trial_ends_at timestamptz, paid_until timestamptz)
language sql stable security definer set search_path = public as $$
 select case when s.legacy_access then 'active'
             when s.paid_until > now() then 'active'
             when s.trial_ends_at > now() then 'trial'
             else 'expired' end, s.trial_ends_at, s.paid_until
 from public.workspaces w join public.saas_subscriptions s on s.owner_id=w.owner_id
 where w.id=_workspace and public.is_workspace_member(_workspace)
$$;

create table if not exists public.saas_payment_requests (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 amount numeric(10,2) not null default 9.90,
 status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
 created_at timestamptz not null default now(),
 confirmed_at timestamptz,
 unique(id,owner_id)
);
create unique index if not exists one_open_saas_request
 on public.saas_payment_requests(owner_id) where status='pending';
alter table public.saas_payment_requests enable row level security;
create policy "owner read payment requests" on public.saas_payment_requests
 for select to authenticated using (owner_id=auth.uid());
create policy "owner request pix payment" on public.saas_payment_requests
 for insert to authenticated with check (owner_id=auth.uid() and status='pending' and amount=9.90 and confirmed_at is null);

-- IMPORTANT: Subscription enforcement is NOT activated by this migration.
-- Financial table RLS and the existing can_edit_workspace function stay unchanged
-- until tests with owner/editor/viewer and an expired trial have passed.
-- The access function is offered for a separately reviewed rollout only.
create or replace function public.can_use_paid_workspace(_ws uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_workspace_member(_ws) and public.saas_access_for_workspace(_ws)
$$;
revoke all on function public.can_use_paid_workspace(uuid) from public;
grant execute on function public.can_use_paid_workspace(uuid) to authenticated;
