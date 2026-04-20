import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/embeddings/embed";

const searchSchema = z.object({
  keyword: z.string().optional(),
  semantic: z.string().optional(),
  vertical: z.string().optional(),
  category: z.string().optional(),
  state: z.union([z.string().length(2), z.array(z.string().length(2))]).optional(),
  postedAfter: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  minValueCents: z.number().int().min(0).optional(),
  similarityThreshold: z.number().min(0).max(1).default(0),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = searchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const params = parsed.data;

  // Embed semantic query if present
  let queryEmbedding: number[] | null = null;
  if (params.semantic && params.semantic.trim().length > 0) {
    try {
      queryEmbedding = await embedText(params.semantic);
    } catch (err) {
      console.error("[search] embedding failed:", err);
      return NextResponse.json(
        { error: "Failed to embed semantic query" },
        { status: 500 },
      );
    }
  }

  const states = Array.isArray(params.state)
    ? params.state
    : params.state
      ? [params.state]
      : null;

  const { data, error } = await supabase.rpc("search_rfps", {
    p_keyword: params.keyword ?? null,
    p_query_embedding: queryEmbedding,
    p_vertical: params.vertical ?? null,
    p_category: params.category ?? null,
    p_states: states,
    p_posted_after: params.postedAfter ?? null,
    p_due_after: params.dueAfter ?? null,
    p_min_value_cents: params.minValueCents ?? null,
    p_similarity_threshold: params.similarityThreshold,
    p_limit: params.limit,
    p_offset: params.offset,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
