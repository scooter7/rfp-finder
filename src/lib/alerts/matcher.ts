import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type SavedSearch = Database["public"]["Tables"]["saved_searches"]["Row"];

export interface MatchedRfp {
  rfp_id: string;
  title: string;
  description: string | null;
  agency_name: string | null;
  state: string | null;
  url: string;
  posted_at: string | null;
  due_at: string | null;
  estimated_value_cents: number | null;
  vertical: string | null;
  category: string | null;
  tags: string[] | null;
  similarity: number | null;
}

/**
 * Find RFPs matching a saved search that were posted after its last match.
 * Relies on search_rfps RPC; doesn't touch the LLM.
 *
 * We intentionally filter by `posted_after = last_matched_at ?? created_at`
 * so the first run gets everything since the search was created, and
 * subsequent runs are incremental.
 */
export async function findMatchesForSearch(
  supabase: SupabaseClient<Database>,
  search: SavedSearch,
): Promise<MatchedRfp[]> {
  const postedAfter = search.last_matched_at ?? search.created_at;
  const filters = (search.filters ?? {}) as {
    vertical?: string;
    category?: string;
    state?: string | string[];
    minValueCents?: number;
  };

  const states = Array.isArray(filters.state)
    ? filters.state
    : filters.state
      ? [filters.state]
      : null;

  const { data, error } = await supabase.rpc("search_rfps", {
    p_keyword: search.keyword_query ?? null,
    p_query_embedding: (search.semantic_query_embedding as unknown as number[]) ?? null,
    p_vertical: filters.vertical ?? null,
    p_category: filters.category ?? null,
    p_states: states,
    p_posted_after: postedAfter,
    p_min_value_cents: filters.minValueCents ?? null,
    p_similarity_threshold: search.semantic_query_embedding ? 0.7 : 0,
    p_limit: 50,
    p_offset: 0,
  });

  if (error) {
    console.error(`[matcher] search ${search.id} failed:`, error.message);
    return [];
  }

  return (data ?? []) as MatchedRfp[];
}

/**
 * Record matches into the alerts table (unique per user+rfp+search),
 * advance the search's last_matched_at, and return the newly-created
 * alert rows (for email delivery).
 */
export async function recordMatches(
  supabase: SupabaseClient<Database>,
  search: SavedSearch,
  matches: MatchedRfp[],
): Promise<Array<{ id: string; rfp_id: string }>> {
  if (matches.length === 0) {
    // Still advance the timestamp so we don't re-check the same window
    await supabase
      .from("saved_searches")
      .update({ last_matched_at: new Date().toISOString() })
      .eq("id", search.id);
    return [];
  }

  const rows = matches.map((m) => ({
    user_id: search.user_id,
    rfp_id: m.rfp_id,
    saved_search_id: search.id,
    relevance_score: m.similarity ?? null,
  }));

  // Upsert with ignore-duplicates — alerts has a unique constraint on
  // (user_id, rfp_id, saved_search_id), so re-runs don't create dupes.
  const { data: inserted, error } = await supabase
    .from("alerts")
    .upsert(rows, {
      onConflict: "user_id,rfp_id,saved_search_id",
      ignoreDuplicates: true,
    })
    .select("id, rfp_id");

  if (error) {
    console.error(`[matcher] alert upsert failed:`, error.message);
    return [];
  }

  await supabase
    .from("saved_searches")
    .update({ last_matched_at: new Date().toISOString() })
    .eq("id", search.id);

  return inserted ?? [];
}
