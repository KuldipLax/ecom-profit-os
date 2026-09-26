-- Hardening: avoid recursive membership RLS and add platform-wide settings.
create or replace function public.user_can_manage_business(target_business_id uuid) returns boolean
language sql stable security definer set search_path=public,auth as $$
  select public.is_super_admin() or exists(
    select 1 from public.memberships m
    where m.business_id=target_business_id
      and m.user_id=auth.uid()
      and m.status='active'
      and m.role in ('admin','super_admin')
  )
$$;

drop policy if exists memberships_write on public.memberships;
create policy memberships_write on public.memberships
for all using(public.user_can_manage_business(business_id))
with check(public.user_can_manage_business(business_id));

create table if not exists public.platform_settings(
  key text primary key,
  value jsonb not null default '{}',
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_select on public.platform_settings;
drop policy if exists platform_settings_write on public.platform_settings;
create policy platform_settings_select on public.platform_settings for select using(public.is_super_admin());
create policy platform_settings_write on public.platform_settings for all using(public.is_super_admin()) with check(public.is_super_admin());

insert into public.platform_settings(key,value)
values
('default_cost_rules','{"checkout_fee_rate":0.02,"prepaid_pg_fee_rate":0.02,"meta_gst_rate":0.18,"shipping_rule":"max","treat_prepaid_as_effective_delivered":true}'),
('feature_flags','{"forecast":true,"cohorts":true,"reconciliation":true,"csv_import":true}')
on conflict(key) do nothing;

create or replace function public.user_can_access_business(target_business_id uuid) returns boolean
language sql stable security definer set search_path=public,auth as $$
  select public.is_super_admin()
    or exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.status='active' and m.role='admin')
    or exists(
      select 1 from public.memberships m
      join public.businesses b on b.id=m.business_id
      where m.business_id=target_business_id
        and m.user_id=auth.uid()
        and m.status='active'
        and b.status='active'
    )
$$;

create or replace function public.user_can_write_business(target_business_id uuid) returns boolean
language sql stable security definer set search_path=public,auth as $$
  select public.is_super_admin()
    or exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.status='active' and m.role='admin')
    or exists(
      select 1 from public.memberships m
      join public.businesses b on b.id=m.business_id
      where m.business_id=target_business_id
        and m.user_id=auth.uid()
        and m.status='active'
        and m.role='client'
        and b.status='active'
    )
$$;
