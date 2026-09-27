-- Security hardening: scope admin access to their assigned businesses.
-- super_admin remains globally scoped.

create or replace function public.user_can_access_business(target_business_id uuid) returns boolean
language sql stable security definer set search_path=public,auth as $$
  select public.is_super_admin()
    or exists(
      select 1
      from public.memberships m
      join public.businesses b on b.id = m.business_id
      where m.business_id = target_business_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('admin','client')
        and b.status = 'active'
    )
$$;

create or replace function public.user_can_write_business(target_business_id uuid) returns boolean
language sql stable security definer set search_path=public,auth as $$
  select public.is_super_admin()
    or exists(
      select 1
      from public.memberships m
      join public.businesses b on b.id = m.business_id
      where m.business_id = target_business_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('admin','client')
        and b.status = 'active'
    )
$$;

create or replace function public.user_can_manage_business(target_business_id uuid) returns boolean
language sql stable security definer set search_path=public,auth as $$
  select public.is_super_admin()
    or exists(
      select 1
      from public.memberships m
      join public.businesses b on b.id = m.business_id
      where m.business_id = target_business_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('admin','super_admin')
        and b.status = 'active'
    )
$$;
