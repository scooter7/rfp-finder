-- ============================================================
-- Admin roles: adds `role` to profiles and grants admins
-- full visibility into user-scoped tables.
-- ============================================================

alter table public.profiles
  add column role text not null default 'member'
    check (role in ('admin', 'member'));

create index profiles_role_idx on public.profiles (role) where role = 'admin';

-- Helper: is the given user (or auth.uid() by default) an admin?
-- SECURITY DEFINER so it can read profiles without triggering the RLS
-- policy recursion on the same table.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

-- Update new-user trigger to auto-promote whitelisted emails.
-- Keeps the existing signup path idempotent for already-seeded admins.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'display_name',
    case
      when new.email in ('james@agency-os.ai', 'eric@agency-os.ai') then 'admin'
      else 'member'
    end
  );
  return new;
end;
$$;

-- Seed admins for any profile rows that already exist
update public.profiles
  set role = 'admin'
  where email in ('james@agency-os.ai', 'eric@agency-os.ai');

-- ------------------------------------------------------------
-- RLS: admins see everything user-scoped
-- ------------------------------------------------------------

-- Profiles: admins can read and update every row
create policy "admins_read_all_profiles" on public.profiles
  for select to authenticated using (public.is_admin());

create policy "admins_update_all_profiles" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Saved searches: admins can read every row (not edit — those belong to the owner)
create policy "admins_read_all_saved_searches" on public.saved_searches
  for select to authenticated using (public.is_admin());

-- Alerts: admins can read every row
create policy "admins_read_all_alerts" on public.alerts
  for select to authenticated using (public.is_admin());
