-- ============================================================
-- Awards: historical federal awards from USAspending.gov
-- ============================================================
-- Awards are a different entity from RFPs. An RFP is an opportunity
-- (future-looking); an award is who won past work (historical). We use
-- award embeddings to surface "similar past awards" on any RFP detail page.
-- That's the competitor intelligence layer.
-- ============================================================

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  external_id text not null, -- USAspending generated_internal_id

  -- What
  award_type text not null check (award_type in (
    'contract', 'grant', 'loan', 'direct_payment', 'idv', 'other'
  )),
  title text,
  description text,
  piid_or_fain text, -- contract PIID or grant FAIN — useful for matching back to RFPs
  url text not null,

  -- Recipient (the vendor/institution that won)
  recipient_name text,
  recipient_uei text,
  recipient_state text, -- 2-char

  -- Issuer
  awarding_agency text,
  awarding_sub_agency text,

  -- Dates
  action_date timestamptz,
  start_date timestamptz,
  end_date timestamptz,

  -- Money
  total_obligated_cents bigint,
  base_and_all_options_cents bigint,

  -- Categorization
  naics_code text,
  psc_code text,
  place_of_performance_state text, -- 2-char

  raw_payload jsonb not null default '{}'::jsonb,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_id, external_id)
);

create index awards_action_date_idx on public.awards (action_date desc nulls last);
create index awards_recipient_state_idx on public.awards (recipient_state)
  where recipient_state is not null;
create index awards_naics_idx on public.awards (naics_code) where naics_code is not null;
create index awards_total_obligated_idx on public.awards (total_obligated_cents desc nulls last);
create index awards_recipient_name_trgm_idx on public.awards using gin (recipient_name gin_trgm_ops);
create index awards_awarding_agency_trgm_idx on public.awards using gin (awarding_agency gin_trgm_ops);
create index awards_award_type_idx on public.awards (award_type);

-- Award embeddings for semantic similarity (RFP → past awards)
create table public.award_embeddings (
  award_id uuid primary key references public.awards(id) on delete cascade,
  embedding vector(1536) not null,
  model_version text not null,
  embedded_at timestamptz not null default now()
);

create index award_embeddings_hnsw_idx on public.award_embeddings
  using hnsw (embedding vector_cosine_ops);

-- RLS
alter table public.awards enable row level security;
alter table public.award_embeddings enable row level security;

create policy "auth_read_awards" on public.awards
  for select to authenticated using (true);

create policy "auth_read_award_embeddings" on public.award_embeddings
  for select to authenticated using (true);

create trigger awards_updated_at before update on public.awards
  for each row execute function public.set_updated_at();

-- ============================================================
-- find_similar_awards: given an RFP, find past awards with similar
-- subject matter. This is the core competitor-intelligence query.
-- ============================================================
create or replace function public.find_similar_awards(
  p_rfp_id uuid,
  p_limit int default 10,
  p_min_similarity numeric default 0.75,
  p_award_type text default null,
  p_max_age_days int default null
)
returns table (
  award_id uuid,
  title text,
  description text,
  award_type text,
  recipient_name text,
  recipient_state text,
  awarding_agency text,
  awarding_sub_agency text,
  action_date timestamptz,
  total_obligated_cents bigint,
  naics_code text,
  url text,
  similarity numeric
)
language sql stable as $$
  with rfp_vec as (
    select embedding from public.rfp_embeddings where rfp_id = p_rfp_id limit 1
  )
  select
    a.id,
    a.title,
    a.description,
    a.award_type,
    a.recipient_name,
    a.recipient_state,
    a.awarding_agency,
    a.awarding_sub_agency,
    a.action_date,
    a.total_obligated_cents,
    a.naics_code,
    a.url,
    (1 - (e.embedding <=> (select embedding from rfp_vec)))::numeric as similarity
  from public.award_embeddings e
  join public.awards a on a.id = e.award_id
  where
    (1 - (e.embedding <=> (select embedding from rfp_vec))) >= p_min_similarity
    and (p_award_type is null or a.award_type = p_award_type)
    and (p_max_age_days is null
      or a.action_date >= now() - (p_max_age_days || ' days')::interval)
  order by e.embedding <=> (select embedding from rfp_vec)
  limit p_limit;
$$;

grant execute on function public.find_similar_awards to authenticated;

-- ============================================================
-- find_awards_for_recipient: all past awards by a given recipient name
-- Used for "here's everyone who's done similar work at this institution"
-- ============================================================
create or replace function public.find_awards_for_recipient(
  p_recipient_pattern text,
  p_limit int default 50
)
returns table (
  award_id uuid,
  title text,
  award_type text,
  recipient_name text,
  awarding_agency text,
  action_date timestamptz,
  total_obligated_cents bigint,
  url text
)
language sql stable as $$
  select
    id,
    title,
    award_type,
    recipient_name,
    awarding_agency,
    action_date,
    total_obligated_cents,
    url
  from public.awards
  where recipient_name ilike '%' || p_recipient_pattern || '%'
  order by action_date desc nulls last
  limit p_limit;
$$;

grant execute on function public.find_awards_for_recipient to authenticated;
