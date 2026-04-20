import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? "rfp-aggregator",
  runtime: "node",
  logLevel: "info",
  // Most tasks are IO-bound (API + Supabase); 15min is plenty for SAM.gov backfill pages.
  maxDuration: 900,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 2000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./trigger"],
});
