import { task, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { createAdapter } from "@/ingestion/adapters";
import { runIngestion } from "@/ingestion/pipeline";

const payloadSchema = z.object({
  adapterKey: z.string(),
  sinceDaysAgo: z.number().int().min(1).max(90).default(7),
  limit: z.number().int().min(1).max(5000).optional(),
});

/**
 * Manually-triggerable backfill. Invoke via Trigger.dev dashboard or API:
 *   { "adapterKey": "sam_gov", "sinceDaysAgo": 30, "limit": 500 }
 */
export const backfillAdapter = task({
  id: "backfill-adapter",
  maxDuration: 900,
  run: async (rawPayload, { ctx }) => {
    const payload = payloadSchema.parse(rawPayload);
    const since = new Date(Date.now() - payload.sinceDaysAgo * 86_400_000);

    logger.info("Starting backfill", {
      adapterKey: payload.adapterKey,
      since: since.toISOString(),
      limit: payload.limit,
    });

    const adapter = createAdapter(payload.adapterKey);
    const stats = await runIngestion(adapter, {
      since,
      limit: payload.limit,
    });

    logger.info("Backfill complete", stats);
    return stats;
  },
});
