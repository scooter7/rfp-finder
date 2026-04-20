-- ============================================================
-- RLS policies
-- ============================================================
-- Design: RFP data (sources/rfps/classifications/embeddings) is shared
-- across all authenticated users. User-specific data (profiles, saved_searches,
-- alerts) is strictly user-scoped.
--
-- Service role (used by ingestion jobs) bypasses RLS by default.

-- Enable RLS on all public tables
alter table public.sources enable row level security;
alter table public.rfps enable row level security;
alter table public.rfp_classifications enable row level security;
alter table public.rfp_embeddings enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_searches enable row level security;
alter table public.alerts enable row level security;

-- ------------------------------------------------------------
-- Shared RFP data: authenticated read, no writes (ingestion uses service role)
-- ------------------------------------------------------------
create policy "auth_read_sources" on public.sources
  for select to authenticated using (true);

create policy "auth_read_rfps" on public.rfps
  for select to authenticated using (true);

create policy "auth_read_classifications" on public.rfp_classifications
  for select to authenticated using (true);

create policy "auth_read_embeddings" on public.rfp_embeddings
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- Profiles: users can read and update their own
-- ------------------------------------------------------------
create policy "users_read_own_profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "users_update_own_profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- Saved searches: users fully manage their own
-- ------------------------------------------------------------
create policy "users_manage_own_saved_searches" on public.saved_searches
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Alerts: users read their own; writes happen via service role
-- ------------------------------------------------------------
create policy "users_read_own_alerts" on public.alerts
  for select to authenticated using (auth.uid() = user_id);

create policy "users_update_own_alerts" on public.alerts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
