import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Stable content hash for dedup. We hash the pieces most likely to be
 * identical across different sources republishing the same RFP:
 *   - normalized title
 *   - normalized agency name
 *   - due date (day-precision)
 *
 * Intentionally does NOT include description — source portals rewrite
 * boilerplate in incompatible ways.
 */
export function computeContentHash(input: {
  title: string;
  agencyName?: string | null;
  dueAt?: Date | string | null;
}): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s]/g, "")
      .trim();

  const dueDay = input.dueAt
    ? new Date(input.dueAt).toISOString().slice(0, 10)
    : "no-due";

  const canonical = [
    norm(input.title),
    norm(input.agencyName ?? ""),
    dueDay,
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Check whether a semantically near-identical RFP already exists.
 * Uses pgvector cosine similarity against existing embeddings.
 *
 * Returns the rfp_id of the duplicate (if any), or null.
 *
 * Threshold tuning:
 *   0.95+ → only cross-source reposts of the same RFP
 *   0.90  → same RFP + minor description edits
 *   0.85  → risk of false positives on similar-but-different RFPs
 */
export async function findSemanticDuplicate(
  supabase: SupabaseClient<Database>,
  params: {
    embedding: number[];
    agencyName?: string | null;
    dueAt?: Date | string | null;
    threshold?: number;
    excludeRfpId?: string;
  },
): Promise<string | null> {
  const threshold = params.threshold ?? 0.95;

  // Query for high-similarity neighbors. Restrict to same agency + same due
  // date when possible, since those are strong dedup signals.
  const { data, error } = await supabase.rpc("find_similar_rfps", {
    p_rfp_id: params.excludeRfpId ?? "00000000-0000-0000-0000-000000000000",
    p_limit: 5,
    p_min_similarity: threshold,
  });

  if (error) {
    console.warn("[dedup] similarity query failed:", error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Additional filter: agency must match if we have it
  if (params.agencyName) {
    const agencyNorm = params.agencyName.toLowerCase().trim();
    const match = data.find(
      (r) => r.agency_name?.toLowerCase().trim() === agencyNorm,
    );
    return match?.rfp_id ?? null;
  }

  return data[0]?.rfp_id ?? null;
}
