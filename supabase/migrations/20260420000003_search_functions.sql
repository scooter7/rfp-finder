-- ============================================================
-- Search functions
-- ============================================================

-- ------------------------------------------------------------
-- search_rfps: hybrid keyword + semantic + filter search
-- Callable via Supabase rpc(). Returns enriched results with
-- classification joined and optional similarity score.
-- ------------------------------------------------------------
create or replace function public.search_rfps(
  p_keyword text default null,
  p_query_embedding vector(1536) default null,
  p_vertical text default null,
  p_category text default null,
  p_state text default null,
  p_posted_after timestamptz default null,
  p_due_after timestamptz default null,
  p_min_value_cents bigint default null,
  p_similarity_threshold numeric default 0.0,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  rfp_id uuid,
  title text,
  description text,
  agency_name text,
  state text,
  url text,
  posted_at timestamptz,
  due_at timestamptz,
  estimated_value_cents bigint,
  vertical text,
  category text,
  tags text[],
  similarity numeric
)
language sql stable as $$
  select
    r.id as rfp_id,
    r.title,
    r.description,
    r.agency_name,
    r.state,
    r.url,
    r.posted_at,
    r.due_at,
    r.estimated_value_cents,
    c.vertical,
    c.category,
    c.tags,
    case
      when p_query_embedding is not null
        then (1 - (e.embedding <=> p_query_embedding))::numeric
      else null
    end as similarity
  from public.rfps r
  left join public.rfp_classifications c on c.rfp_id = r.id
  left join public.rfp_embeddings e on e.rfp_id = r.id
  where
    (p_keyword is null
      or r.title ilike '%' || p_keyword || '%'
      or r.description ilike '%' || p_keyword || '%'
      or r.agency_name ilike '%' || p_keyword || '%')
    and (p_vertical is null or c.vertical = p_vertical)
    and (p_category is null or c.category = p_category)
    and (p_state is null or r.state = p_state)
    and (p_posted_after is null or r.posted_at >= p_posted_after)
    and (p_due_after is null or r.due_at >= p_due_after)
    and (p_min_value_cents is null or r.estimated_value_cents >= p_min_value_cents)
    and (
      p_query_embedding is null
      or (1 - (e.embedding <=> p_query_embedding)) >= p_similarity_threshold
    )
  order by
    -- If semantic search active, rank by similarity; else by recency
    case when p_query_embedding is not null
      then e.embedding <=> p_query_embedding
      else null
    end nulls last,
    r.posted_at desc nulls last
  limit p_limit offset p_offset;
$$;

grant execute on function public.search_rfps to authenticated;

-- ------------------------------------------------------------
-- find_similar_rfps: given an rfp_id, find N most similar
-- Used for dedup detection and "related RFPs" UI.
-- ------------------------------------------------------------
create or replace function public.find_similar_rfps(
  p_rfp_id uuid,
  p_limit int default 5,
  p_min_similarity numeric default 0.85
)
returns table (
  rfp_id uuid,
  title text,
  agency_name text,
  state text,
  posted_at timestamptz,
  similarity numeric
)
language sql stable as $$
  with source as (
    select embedding
    from public.rfp_embeddings
    where rfp_id = p_rfp_id
    limit 1
  )
  select
    r.id,
    r.title,
    r.agency_name,
    r.state,
    r.posted_at,
    (1 - (e.embedding <=> (select embedding from source)))::numeric as similarity
  from public.rfp_embeddings e
  join public.rfps r on r.id = e.rfp_id
  where
    e.rfp_id != p_rfp_id
    and (1 - (e.embedding <=> (select embedding from source))) >= p_min_similarity
  order by e.embedding <=> (select embedding from source)
  limit p_limit;
$$;

grant execute on function public.find_similar_rfps to authenticated;
