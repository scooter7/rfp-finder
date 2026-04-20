import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { RssFeedAdapter } from "@/ingestion/adapters/rss-feed";
import { runIngestion, type IngestionStats } from "@/ingestion/pipeline";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface SourceRow {
  id: string;
  adapter_key: string;
  name: string;
  state: string | null;
  type: "federal" | "state" | "institution" | "aggregator";
  metadata: Record<string, unknown>;
}

export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const deadlineMs = startedAt + 270_000;

  const daysParam = new URL(request.url).searchParams.get("days");
  const lookbackMs = daysParam
    ? Math.max(1, Math.min(365, Number(daysParam))) * 86_400_000
    : 24 * 60 * 60 * 1000; // 24h default overlap for RSS
  const since = new Date(startedAt - lookbackMs);

  const supabase = createAdminClient();
  const sourcesRes = await supabase
    .from("sources")
    .select("id, adapter_key, name, state, type, metadata")
    .eq("status", "active");
  const sources = ((sourcesRes.data ?? []) as SourceRow[]).filter(
    (s) => typeof s.metadata?.rss_url === "string",
  );

  if (sources.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No RSS feeds configured. Register one by inserting a sources row with metadata.rss_url.",
      durationMs: Date.now() - startedAt,
    });
  }

  const perFeedBudget = Math.max(
    15_000,
    Math.floor((deadlineMs - Date.now()) / sources.length),
  );

  const results: Array<{ adapter_key: string; stats: IngestionStats | null; error?: string }> = [];
  let overallTimedOut = false;

  for (const source of sources) {
    if (Date.now() >= deadlineMs) {
      overallTimedOut = true;
      break;
    }
    const feedDeadline = Math.min(Date.now() + perFeedBudget, deadlineMs);
    const adapter = new RssFeedAdapter({
      key: source.adapter_key,
      name: source.name,
      feedUrl: source.metadata.rss_url as string,
      state: source.state ?? undefined,
      sourceType: source.type,
      defaultAgency:
        typeof source.metadata.default_agency === "string"
          ? (source.metadata.default_agency as string)
          : undefined,
    });

    try {
      const stats = await runIngestion(adapter, {
        since,
        deadlineMs: feedDeadline,
      });
      results.push({ adapter_key: source.adapter_key, stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/rss] ${source.adapter_key} failed:`, message);
      results.push({ adapter_key: source.adapter_key, stats: null, error: message });
    }
  }

  return NextResponse.json({
    feedsProcessed: results.length,
    feedsTotal: sources.length,
    timedOut: overallTimedOut,
    durationMs: Date.now() - startedAt,
    results,
  });
}
