import { schedules, logger } from "@trigger.dev/sdk/v3";

import { createAdminClient } from "@/lib/supabase/admin";
import { findMatchesForSearch, recordMatches } from "@/lib/alerts/matcher";
import { sendDigestEmail } from "@/lib/alerts/email";

/**
 * Alert runner — one scheduled task per frequency. Each iterates the
 * saved searches at its frequency, finds new matches, records them, and
 * emails the user a digest.
 *
 * Design notes:
 *   - Uses admin client (service role) so one task can process searches
 *     across all users.
 *   - Batches matches into a single digest email per search, not one
 *     email per RFP.
 *   - Ignores searches whose user email we can't resolve (shouldn't
 *     happen given the profile trigger, but fail-soft).
 */

async function runForFrequency(frequency: "realtime" | "daily" | "weekly") {
  const supabase = createAdminClient();

  const { data: searches, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("alert_frequency", frequency);

  if (error) {
    logger.error("Failed to load saved searches", { error: error.message });
    throw error;
  }

  const rows = searches ?? [];
  logger.info(`Running ${frequency} alerts for ${rows.length} saved search(es)`);

  let totalMatches = 0;
  let totalEmailed = 0;
  const errors: string[] = [];

  for (const search of rows) {
    try {
      const matches = await findMatchesForSearch(supabase, search);
      if (matches.length === 0) {
        await recordMatches(supabase, search, []); // advance timestamp anyway
        continue;
      }

      const newAlerts = await recordMatches(supabase, search, matches);
      totalMatches += matches.length;

      if (newAlerts.length === 0) continue; // all dedup'd, nothing to email

      // Resolve user's email for delivery
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", search.user_id)
        .single();
      if (!profile?.email) {
        logger.warn(`No email for user ${search.user_id} — skipping`);
        continue;
      }

      // Align the matches we email with the alerts we just inserted
      const newAlertIds = newAlerts.map((a) => a.id);
      const newRfpIds = new Set(newAlerts.map((a) => a.rfp_id));
      const rfpsToEmail = matches.filter((m) => newRfpIds.has(m.rfp_id));

      await sendDigestEmail(supabase, {
        userEmail: profile.email,
        searchName: search.name,
        rfps: rfpsToEmail.map((m) => ({
          rfp_id: m.rfp_id,
          title: m.title,
          agency_name: m.agency_name,
          state: m.state,
          due_at: m.due_at,
          url: m.url,
          vertical: m.vertical,
          category: m.category,
        })),
        alertIds: newAlertIds,
      });
      totalEmailed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${search.id}: ${msg}`);
      logger.error(`Search ${search.id} failed`, { error: msg });
    }
  }

  return {
    frequency,
    searchesProcessed: rows.length,
    totalMatches,
    totalEmailed,
    errors,
  };
}

export const runRealtimeAlerts = schedules.task({
  id: "run-alerts-realtime",
  cron: "0 * * * *", // top of every hour
  maxDuration: 600,
  run: async () => runForFrequency("realtime"),
});

export const runDailyAlerts = schedules.task({
  id: "run-alerts-daily",
  cron: "0 13 * * *", // 13:00 UTC = 9am ET
  maxDuration: 900,
  run: async () => runForFrequency("daily"),
});

export const runWeeklyAlerts = schedules.task({
  id: "run-alerts-weekly",
  cron: "0 13 * * 1", // Monday 13:00 UTC
  maxDuration: 1800,
  run: async () => runForFrequency("weekly"),
});
