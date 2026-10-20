-- Annual plan extension. Run after 20261020023000_saas_trial_billing.sql and before the admin migration.
alter table public.saas_payment_requests add column if not exists plan_code text not null default 'monthly';
alter table public.saas_payment_requests drop constraint if exists saas_payment_requests_amount_check;
alter table public.saas_payment_requests add constraint saas_payment_requests_amount_check
check ((plan_code='monthly' and amount=9.90) or (plan_code='annual' and amount=97.00));
drop policy if exists "owner request pix payment" on public.saas_payment_requests;
create policy "owner request pix payment" on public.saas_payment_requests for insert to authenticated
with check (
 owner_id=auth.uid() and status='pending' and confirmed_at is null
 and ((plan_code='monthly' and amount=9.90) or (plan_code='annual' and amount=97.00))
);
-- An outstanding request must be resolved before switching plans.
