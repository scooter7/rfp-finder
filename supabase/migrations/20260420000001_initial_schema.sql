-- ============================================================
-- RFP Aggregator: Initial schema
-- ============================================================

-- Extensions
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- Sources: where we pull RFPs from
-- ------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text, -- ISO 2-char; null for federal/multi-state
  type text not null check (type in ('federal', 'state', 'institution', 'aggregator')),
  url text not null,
  adapter_key text not null unique, -- e.g. 'sam_gov', 'ca_state'
  last_crawled_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'errored')),
  error_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sources is 'Ingestion sources — one row per portal/API we pull from';

-- ------------------------------------------------------------
-- RFPs: the raw, normalized records
-- ------------------------------------------------------------
create table public.rfps (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  external_id text not null, -- the source's own ID
  title text not null,
  description text,
  full_text text, -- when we fetch the full RFP body (may be lazy)
  url text not null,
  agency_name text,
  state text, -- 2-char code
  posted_at timestamptz,
  due_at timestamptz,
  estimated_value_cents bigint,
  raw_payload jsonb not null default '{}'::jsonb,
  content_hash text not null, -- sha256(title + agency + due_at) for dedup
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index rfps_due_at_idx on public.rfps (due_at desc nulls last);
create index rfps_posted_at_idx on public.rfps (posted_at desc nulls last);
create index rfps_state_idx on public.rfps (state) where state is not null;
create index rfps_agency_name_trgm_idx on public.rfps using gin (agency_name gin_trgm_ops);
create index rfps_title_trgm_idx on public.rfps using gin (title gin_trgm_ops);
create index rfps_content_hash_idx on public.rfps (content_hash);

comment on table public.rfps is 'Normalized RFP records — one per opportunity, deduped across sources';

-- ------------------------------------------------------------
-- Classifications: LLM-assigned tags (kept separate so we can reclassify)
-- ------------------------------------------------------------
create table public.rfp_classifications (
  rfp_id uuid primary key references public.rfps(id) on delete cascade,
  vertical text not null check (vertical in (
    'higher_ed', 'healthcare', 'k12', 'state_local_gov', 'federal_gov', 'other'
  )),
  category text not null,
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  tags text[] not null default '{}',
  classified_at timestamptz not null default now(),
  model_version text not null
);

create index rfp_classifications_vertical_idx on public.rfp_classifications (vertical);
create index rfp_classifications_category_idx on public.rfp_classifications (category);
create index rfp_classifications_tags_idx on public.rfp_classifications using gin (tags);

-- ------------------------------------------------------------
-- Embeddings: for semantic search
-- ------------------------------------------------------------
create table public.rfp_embeddings (
  rfp_id uuid primary key references public.rfps(id) on delete cascade,
  embedding vector(1536) not null, -- text-embedding-3-small
  model_version text not null,
  embedded_at timestamptz not null default now()
);

-- HNSW is better than IVFFlat for high recall at low latency
create index rfp_embeddings_hnsw_idx on public.rfp_embeddings
  using hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------
-- Profiles: mirror of auth.users with app-specific fields
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Saved searches
-- ------------------------------------------------------------
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  keyword_query text,
  semantic_query text,
  semantic_query_embedding vector(1536),
  filters jsonb not null default '{}'::jsonb,
    -- shape: { vertical?, category?, state?, minValueCents?, maxValueCents?, dueAfter?, dueBefore? }
  alert_frequency text not null default 'daily'
    check (alert_frequency in ('realtime', 'daily', 'weekly', 'never')),
  last_matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_searches_user_id_idx on public.saved_searches (user_id);

-- ------------------------------------------------------------
-- Alerts: history of matches delivered to users
-- ------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rfp_id uuid not null references public.rfps(id) on delete cascade,
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  relevance_score numeric(3,2),
  sent_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, rfp_id, saved_search_id)
);

create index alerts_user_id_idx on public.alerts (user_id);
create index alerts_rfp_id_idx on public.alerts (rfp_id);
create index alerts_unsent_idx on public.alerts (user_id) where sent_at is null;

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sources_updated_at before update on public.sources
  for each row execute function public.set_updated_at();
create trigger rfps_updated_at before update on public.rfps
  for each row execute function public.set_updated_at();
create trigger saved_searches_updated_at before update on public.saved_searches
  for each row execute function public.set_updated_at();
