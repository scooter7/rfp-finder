-- ============================================================
-- saved_rfps: users bookmark individual RFPs from the Browse view
-- ============================================================

create table public.saved_rfps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  rfp_id uuid not null references public.rfps(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  primary key (user_id, rfp_id)
);

create index saved_rfps_user_id_idx on public.saved_rfps (user_id, created_at desc);

alter table public.saved_rfps enable row level security;

-- Users manage their own bookmarks
create policy "users_manage_own_saved_rfps" on public.saved_rfps
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins can read every row (consistent with the profiles/saved_searches/alerts
-- pattern added in the admin-roles migration).
create policy "admins_read_all_saved_rfps" on public.saved_rfps
  for select to authenticated using (public.is_admin());
