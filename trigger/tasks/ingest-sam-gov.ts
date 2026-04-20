import { schedules, logger } from "@trigger.dev/sdk/v3";

import { createAdapter } from "@/ingestion/adapters";
import { runIngestion } from "@/ingestion/pipeline";

/**
 * Pulls SAM.gov opportunities every 4 hours.
 * Overlap window (6h) ensures we don't miss anything if a run is delayed.
 */
export const ingestSamGov = schedules.task({
  id: "ingest-sam-gov",
  cron: "0 */4 * * *",
  maxDuration: 900,
  run: async (payload, { ctx }) => {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000); // last 6h
    logger.info("Starting SAM.gov ingestion", {
      since: since.toISOString(),
      runId: ctx.run.id,
    });

    const adapter = createAdapter("sam_gov");
    const stats = await runIngestion(adapter, { since });

    logger.info("SAM.gov ingestion complete", stats);

    if (stats.errors.length > 0) {
      logger.warn(`${stats.errors.length} records failed`, {
        sample: stats.errors.slice(0, 5),
      });
    }

    return stats;
  },
});
