import { schedules, logger } from "@trigger.dev/sdk/v3";

import { createAdapter } from "@/ingestion/adapters";
import { runIngestion } from "@/ingestion/pipeline";

/**
 * Pulls Grants.gov opportunities every 6 hours.
 * Grants.gov publishes less frequently than SAM.gov, so we don't need a 4h cadence.
 * Overlap window is 12h so a skipped run is never a disaster.
 */
export const ingestGrantsGov = schedules.task({
  id: "ingest-grants-gov",
  cron: "30 */6 * * *", // offset 30min from SAM.gov to avoid clumping
  maxDuration: 900,
  run: async (payload, { ctx }) => {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
    logger.info("Starting Grants.gov ingestion", {
      since: since.toISOString(),
      runId: ctx.run.id,
    });

    const adapter = createAdapter("grants_gov");
    const stats = await runIngestion(adapter, { since });

    logger.info("Grants.gov ingestion complete", stats);
    if (stats.errors.length > 0) {
      logger.warn(`${stats.errors.length} records failed`, {
        sample: stats.errors.slice(0, 5),
      });
    }

    return stats;
  },
});
