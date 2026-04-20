-- ============================================================
-- search_rfps: replace scalar p_state with array p_states so
-- callers can filter across multiple states at once. Passing
-- null or an empty array means "all states".
-- ============================================================

drop function if exists public.search_rfps(
  text, vector, text, text, text, timestamptz, timestamptz, bigint, numeric, int, int
);

create or replace function public.search_rfps(
  p_keyword text default null,
  p_query_embedding vector(1536) default null,
  p_vertical text default null,
  p_category text default null,
  p_states text[] default null,
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
    and (
      p_states is null
      or array_length(p_states, 1) is null
      or r.state = any(p_states)
    )
    and (p_posted_after is null or r.posted_at >= p_posted_after)
    and (p_due_after is null or r.due_at >= p_due_after)
    and (p_min_value_cents is null or r.estimated_value_cents >= p_min_value_cents)
    and (
      p_query_embedding is null
      or (1 - (e.embedding <=> p_query_embedding)) >= p_similarity_threshold
    )
  order by
    case when p_query_embedding is not null
      then e.embedding <=> p_query_embedding
      else null
    end nulls last,
    r.posted_at desc nulls last
  limit p_limit offset p_offset;
$$;

grant execute on function public.search_rfps to authenticated;
