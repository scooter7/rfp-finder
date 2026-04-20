import { schedules, task, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { UsaSpendingAdapter } from "@/ingestion/adapters/usaspending";
import { runAwardIngestion } from "@/ingestion/awards-pipeline";

/**
 * Weekly pull of recent federal awards.
 * Awards show up in USAspending 2-3 weeks after action_date, so a weekly
 * cron is plenty — no benefit to more frequent runs.
 *
 * Default scope: contracts + grants, >= $10K, last 14 days.
 * Over time this builds up a rich corpus for similar-award search.
 */
export const ingestUsaSpending = schedules.task({
  id: "ingest-usaspending",
  cron: "0 4 * * 1", // Monday 04:00 UTC — off-peak
  maxDuration: 1800, // 30 min; the default adapter filters keep this well under
  run: async (payload, { ctx }) => {
    const since = new Date(Date.now() - 14 * 86_400_000);
    logger.info("Starting USAspending weekly ingestion", {
      since: since.toISOString(),
      runId: ctx.run.id,
    });

    const adapter = new UsaSpendingAdapter({
      awardTypeGroups: ["CONTRACTS", "GRANTS"],
    });

    const stats = await runAwardIngestion(adapter, {
      since,
      minValueCents: 10_000 * 100, // $10K floor
    });

    logger.info("USAspending ingestion complete", stats);
    return stats;
  },
});

/**
 * Manually-triggerable backfill for historical awards.
 *
 * Payload example:
 *   { "monthsAgo": 18, "minValueCents": 2500000, "keywords": ["website"] }
 */
const backfillPayloadSchema = z.object({
  monthsAgo: z.number().int().min(1).max(60).default(12),
  minValueCents: z.number().int().min(0).default(2_500_000), // $25K
  limit: z.number().int().min(1).max(50_000).optional(),
  keywords: z.array(z.string()).optional(),
  naicsPrefixes: z.array(z.string()).optional(),
  awardTypeGroups: z
    .array(z.enum(["CONTRACTS", "IDVS", "GRANTS", "DIRECT_PAYMENTS", "LOANS", "OTHER"]))
    .default(["CONTRACTS", "GRANTS"]),
});

export const backfillUsaSpending = task({
  id: "backfill-usaspending",
  maxDuration: 3600, // up to an hour for big backfills
  run: async (rawPayload, { ctx }) => {
    const payload = backfillPayloadSchema.parse(rawPayload);
    const since = new Date();
    since.setMonth(since.getMonth() - payload.monthsAgo);

    logger.info("Starting USAspending backfill", {
      since: since.toISOString(),
      limit: payload.limit,
      keywords: payload.keywords,
      naicsPrefixes: payload.naicsPrefixes,
    });

    const adapter = new UsaSpendingAdapter({
      awardTypeGroups: payload.awardTypeGroups,
      keywords: payload.keywords,
      naicsPrefixes: payload.naicsPrefixes,
    });

    const stats = await runAwardIngestion(adapter, {
      since,
      limit: payload.limit,
      minValueCents: payload.minValueCents,
    });

    logger.info("USAspending backfill complete", stats);
    return stats;
  },
});
