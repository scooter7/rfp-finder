import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  buildEmbedText,
  embedText,
  EMBEDDING_VERSION,
} from "@/lib/embeddings/embed";
import type { AwardAdapter, NormalizedAward } from "./adapters/award-base";

export interface AwardIngestionStats {
  fetched: number;
  inserted: number;
  updated: number;
  embedded: number;
  errors: Array<{ externalId: string; message: string }>;
}

export interface AwardIngestionOptions {
  since: Date;
  limit?: number;
  minValueCents?: number;
  /** If true, skip embedding — useful for fast backfills */
  skipEmbedding?: boolean;
}

/**
 * Run an award adapter end-to-end:
 *   1. Fetch normalized records from adapter
 *   2. Upsert into `awards`
 *   3. Embed new records (description or title via OpenAI)
 *   4. Store in `award_embeddings` for similarity search
 *
 * No LLM classification — award metadata (NAICS, PSC, agency) is already
 * structured and doesn't need Haiku to make sense of it.
 */
export async function runAwardIngestion(
  adapter: AwardAdapter,
  options: AwardIngestionOptions,
): Promise<AwardIngestionStats> {
  const supabase = createAdminClient();
  const stats: AwardIngestionStats = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    embedded: 0,
    errors: [],
  };

  const sourceId = await resolveSourceId(supabase, adapter);

  try {
    for await (const record of adapter.fetch({
      since: options.since,
      limit: options.limit,
      minValueCents: options.minValueCents,
    })) {
      stats.fetched++;

      // Skip records with no usable identity
      if (!record.externalId) continue;

      try {
        await processAward(
          supabase,
          sourceId,
          record,
          stats,
          options.skipEmbedding ?? false,
        );
      } catch (err) {
        stats.errors.push({
          externalId: record.externalId,
          message: err instanceof Error ? err.message : String(err),
        });
        console.error(
          `[awards/${adapter.key}] failed on ${record.externalId}:`,
          err,
        );
      }
    }

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

async function processAward(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  record: NormalizedAward,
  stats: AwardIngestionStats,
  skipEmbedding: boolean,
): Promise<void> {
  const contentHash = createHash("sha256")
    .update(
      [
        record.externalId,
        record.recipientName ?? "",
        record.totalObligatedCents ?? "",
      ].join("|"),
    )
    .digest("hex");

  const { data: upserted, error: upsertErr } = await supabase
    .from("awards")
    .upsert(
      {
        source_id: sourceId,
        external_id: record.externalId,
        award_type: record.awardType,
        title: record.title ?? null,
        description: record.description ?? null,
        piid_or_fain: record.piidOrFain ?? null,
        url: record.url,
        recipient_name: record.recipientName ?? null,
        recipient_uei: record.recipientUei ?? null,
        recipient_state: record.recipientState ?? null,
        awarding_agency: record.awardingAgency ?? null,
        awarding_sub_agency: record.awardingSubAgency ?? null,
        action_date: record.actionDate?.toISOString() ?? null,
        start_date: record.startDate?.toISOString() ?? null,
        end_date: record.endDate?.toISOString() ?? null,
        total_obligated_cents: record.totalObligatedCents ?? null,
        base_and_all_options_cents: record.baseAndAllOptionsCents ?? null,
        naics_code: record.naicsCode ?? null,
        psc_code: record.pscCode ?? null,
        place_of_performance_state: record.placeOfPerformanceState ?? null,
        raw_payload: record.rawPayload as Database["public"]["Tables"]["rfps"]["Row"]["raw_payload"],
        content_hash: contentHash,
      } as never,
      { onConflict: "source_id,external_id" },
    )
    .select("id, created_at, updated_at")
    .single();

  if (upsertErr || !upserted) {
    throw new Error(`award upsert: ${upsertErr?.message}`);
  }

  const isNew = upserted.created_at === upserted.updated_at;
  if (isNew) stats.inserted++;
  else stats.updated++;

  if (skipEmbedding) return;

  // Skip embedding if it already exists
  if (!isNew) {
    const { data: existing } = await supabase
      .from("award_embeddings")
      .select("award_id")
      .eq("award_id", upserted.id)
      .maybeSingle();
    if (existing) return;
  }

  // Embed using title + recipient + agency — the signal we want is
  // "what kind of work was done, for whom"
  const text = buildEmbedText({
    title: record.title ?? record.description ?? "Untitled award",
    description: [
      record.description,
      record.recipientName ? `Recipient: ${record.recipientName}` : null,
      record.awardingAgency ? `Agency: ${record.awardingAgency}` : null,
      record.naicsCode ? `NAICS: ${record.naicsCode}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const embedding = await embedText(text);

  const { error: embedErr } = await supabase
    .from("award_embeddings")
    .upsert({
      award_id: upserted.id,
      embedding: embedding as unknown as number[],
      model_version: EMBEDDING_VERSION,
    } as never);

  if (embedErr) throw new Error(`award embedding: ${embedErr.message}`);
  stats.embedded++;
}

async function resolveSourceId(
  supabase: SupabaseClient<Database>,
  adapter: AwardAdapter,
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
      state: null,
      type: "federal",
      url: `https://${adapter.key}.placeholder`,
      adapter_key: adapter.key,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`failed to create source row: ${error?.message}`);
  }
  return inserted.id;
}
