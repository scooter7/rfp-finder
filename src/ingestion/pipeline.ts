import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { classifyRfp } from "@/lib/classification/classify";
import { buildEmbedText, embedText, EMBEDDING_VERSION } from "@/lib/embeddings/embed";
import { computeContentHash } from "@/lib/dedup/dedup";
import type { IngestionAdapter, NormalizedRfp } from "./adapters";

export interface IngestionStats {
  fetched: number;
  inserted: number;
  updated: number;
  skippedDuplicate: number;
  classified: number;
  embedded: number;
  errors: Array<{ externalId: string; message: string }>;
}

export interface IngestionOptions {
  /** Only fetch RFPs posted after this moment */
  since: Date;
  /** Hard cap on records processed (for testing) */
  limit?: number;
  /** If true, skip classification + embedding — useful for backfill tests */
  skipEnrichment?: boolean;
}

/**
 * Run an adapter end-to-end:
 *   1. Stream normalized records from the adapter
 *   2. Upsert RFP into the database
 *   3. Classify new records (Haiku)
 *   4. Embed new records (text-embedding-3-small)
 *   5. Update source.last_crawled_at
 *
 * Runs enrichment inline per-record. For very large sources, fan out
 * classification/embedding into separate Trigger.dev tasks instead.
 */
export async function runIngestion(
  adapter: IngestionAdapter,
  options: IngestionOptions,
): Promise<IngestionStats> {
  const supabase = createAdminClient();
  const stats: IngestionStats = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    skippedDuplicate: 0,
    classified: 0,
    embedded: 0,
    errors: [],
  };

  // Resolve source row (create if missing)
  const sourceId = await resolveSourceId(supabase, adapter);

  try {
    for await (const record of adapter.fetch({
      since: options.since,
      limit: options.limit,
    })) {
      stats.fetched++;
      try {
        await processRecord(
          supabase,
          sourceId,
          record,
          stats,
          options.skipEnrichment ?? false,
        );
      } catch (err) {
        stats.errors.push({
          externalId: record.externalId,
          message: err instanceof Error ? err.message : String(err),
        });
        console.error(
          `[ingest/${adapter.key}] failed on ${record.externalId}:`,
          err,
        );
      }
    }

    // Mark source healthy
    await supabase
      .from("sources")
      .update({
        last_crawled_at: new Date().toISOString(),
        status: "active",
        error_count: 0,
      })
      .eq("id", sourceId);
  } catch (err) {
    await supabase
      .from("sources")
      .update({ status: "errored", error_count: 1 })
      .eq("id", sourceId);
    throw err;
  }

  return stats;
}

async function processRecord(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  record: NormalizedRfp,
  stats: IngestionStats,
  skipEnrichment: boolean,
): Promise<void> {
  const contentHash = computeContentHash({
    title: record.title,
    agencyName: record.agencyName,
    dueAt: record.dueAt,
  });

  // Upsert on (source_id, external_id) — natural unique key
  const { data: upserted, error: upsertErr } = await supabase
    .from("rfps")
    .upsert(
      {
        source_id: sourceId,
        external_id: record.externalId,
        title: record.title,
        description: record.description ?? null,
        full_text: record.fullText ?? null,
        url: record.url,
        agency_name: record.agencyName ?? null,
        state: record.state ?? null,
        posted_at: record.postedAt?.toISOString() ?? null,
        due_at: record.dueAt?.toISOString() ?? null,
        estimated_value_cents: record.estimatedValueCents ?? null,
        raw_payload: record.rawPayload as Database["public"]["Tables"]["rfps"]["Row"]["raw_payload"],
        content_hash: contentHash,
      },
      { onConflict: "source_id,external_id" },
    )
    .select("id, created_at, updated_at")
    .single();

  if (upsertErr || !upserted) {
    throw new Error(`upsert failed: ${upsertErr?.message}`);
  }

  const isNew = upserted.created_at === upserted.updated_at;
  if (isNew) {
    stats.inserted++;
  } else {
    stats.updated++;
  }

  if (skipEnrichment) return;

  // Only enrich new records — classification/embedding is expensive and
  // doesn't usually change when the source republishes.
  if (!isNew) {
    const { data: existing } = await supabase
      .from("rfp_classifications")
      .select("rfp_id")
      .eq("rfp_id", upserted.id)
      .maybeSingle();
    if (existing) return; // already enriched, skip
  }

  // Classify
  const classification = await classifyRfp({
    title: record.title,
    description: record.description,
    agencyName: record.agencyName,
    state: record.state,
  });

  const { error: classErr } = await supabase
    .from("rfp_classifications")
    .upsert({
      rfp_id: upserted.id,
      vertical: classification.vertical,
      category: classification.category,
      confidence: classification.confidence,
      tags: classification.tags,
      model_version: classification.modelVersion,
    });
  if (classErr) throw new Error(`classification upsert: ${classErr.message}`);
  stats.classified++;

  // Embed
  const embedText_ = buildEmbedText({
    title: record.title,
    description: record.description,
    agencyName: record.agencyName,
  });
  const embedding = await embedText(embedText_);

  const { error: embedErr } = await supabase
    .from("rfp_embeddings")
    .upsert({
      rfp_id: upserted.id,
      embedding: embedding as unknown as number[],
      model_version: EMBEDDING_VERSION,
    });
  if (embedErr) throw new Error(`embedding upsert: ${embedErr.message}`);
  stats.embedded++;
}

async function resolveSourceId(
  supabase: SupabaseClient<Database>,
  adapter: IngestionAdapter,
): Promise<string> {
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("adapter_key", adapter.key)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: inserted, error } = await supabase
    .from("sources")
    .insert({
      name: adapter.name,
      state: adapter.state ?? null,
      type: adapter.sourceType,
      url: `https://${adapter.key}.placeholder`, // overwrite via seed
      adapter_key: adapter.key,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`failed to create source row: ${error?.message}`);
  }
  return inserted.id;
}
