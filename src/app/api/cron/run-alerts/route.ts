import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { findMatchesForSearch, recordMatches } from "@/lib/alerts/matcher";
import { sendDigestEmail } from "@/lib/alerts/email";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FREQUENCIES = ["realtime", "daily", "weekly"] as const;
type Frequency = (typeof FREQUENCIES)[number];

export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const raw = url.searchParams.get("frequency");
  if (!raw || !FREQUENCIES.includes(raw as Frequency)) {
    return NextResponse.json(
      { error: "frequency query param must be realtime|daily|weekly" },
      { status: 400 },
    );
  }
  const frequency = raw as Frequency;

  const startedAt = Date.now();
  const deadlineMs = startedAt + 270_000;

  const supabase = createAdminClient();
  const { data: searches, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("alert_frequency", frequency);

  if (error) {
    console.error("[cron/alerts] load failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = searches ?? [];
  let totalMatches = 0;
  let totalEmailed = 0;
  let processed = 0;
  const errors: string[] = [];
  let timedOut = false;

  for (const search of rows) {
    if (Date.now() >= deadlineMs) {
      timedOut = true;
      break;
    }
    processed++;
    try {
      const matches = await findMatchesForSearch(supabase, search);
      if (matches.length === 0) {
        await recordMatches(supabase, search, []); // advance timestamp anyway
        continue;
      }

      const newAlerts = await recordMatches(supabase, search, matches);
      totalMatches += matches.length;
      if (newAlerts.length === 0) continue;

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", search.user_id)
        .single();
      if (!profile?.email) continue;

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
      console.error(`[cron/alerts] search ${search.id} failed:`, msg);
    }
  }

  return NextResponse.json({
    frequency,
    searchesAtFrequency: rows.length,
    searchesProcessed: processed,
    totalMatches,
    totalEmailed,
    timedOut,
    durationMs: Date.now() - startedAt,
    errors,
  });
}
