import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { HtmlPortalAdapter, type HtmlPortalConfig } from "@/ingestion/adapters/html-portal";
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

interface HtmlPortalMetadata {
  listing_url: string;
  default_agency?: string;
  extraction_hints?: string;
  max_pages?: number;
  requires_js?: boolean;
}

/**
 * Cron that iterates every active `sources` row configured with a
 * `metadata.html_portal` block and dispatches to HtmlPortalAdapter.
 *
 * Register a source like:
 *   insert into public.sources (name, type, state, url, adapter_key, metadata)
 *   values ('Maine RFPs', 'state', 'ME', 'https://...', 'me_dafs_bbm',
 *     '{"html_portal":{"listing_url":"https://...","default_agency":"...","extraction_hints":"..."}}'::jsonb);
 */
export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const deadlineMs = startedAt + 270_000;

  // HTML portals pre-filter to currently-listed (i.e. still-open) RFPs, so
  // there's no value re-filtering by postedAt — an RFP posted a year ago
  // that's still listed is still relevant. Default to a 5-year window to
  // effectively disable the since-filter; `?days=N` can narrow it.
  const daysParam = new URL(request.url).searchParams.get("days");
  const lookbackMs = daysParam
    ? Math.max(1, Math.min(3650, Number(daysParam))) * 86_400_000
    : 5 * 365 * 86_400_000;
  const since = new Date(startedAt - lookbackMs);

  const supabase = createAdminClient();
  const sourcesRes = await supabase
    .from("sources")
    .select("id, adapter_key, name, state, type, metadata")
    .eq("status", "active");
  const sources = ((sourcesRes.data ?? []) as SourceRow[]).filter((s) => {
    const meta = s.metadata?.html_portal;
    return meta && typeof meta === "object" && typeof (meta as HtmlPortalMetadata).listing_url === "string";
  });

  if (sources.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No html_portal sources configured. Register one with metadata.html_portal.listing_url.",
      durationMs: Date.now() - startedAt,
    });
  }

  const perPortalBudget = Math.max(
    30_000, // HtmlPortalAdapter calls an LLM per page — give each portal at least 30s
    Math.floor((deadlineMs - Date.now()) / sources.length),
  );

  const results: Array<{ adapter_key: string; stats: IngestionStats | null; error?: string }> = [];
  let overallTimedOut = false;

  for (const source of sources) {
    if (Date.now() >= deadlineMs) {
      overallTimedOut = true;
      break;
    }
    const portalMeta = source.metadata.html_portal as HtmlPortalMetadata;
    const config: HtmlPortalConfig = {
      key: source.adapter_key,
      name: source.name,
      sourceType: source.type,
      state: source.state ?? undefined,
      defaultAgencyName: portalMeta.default_agency ?? source.name,
      listingUrl: portalMeta.listing_url,
      extractionHints: portalMeta.extraction_hints,
      maxPages: portalMeta.max_pages,
      requiresJs: portalMeta.requires_js,
    };

    const portalDeadline = Math.min(Date.now() + perPortalBudget, deadlineMs);
    const adapter = new HtmlPortalAdapter(config);

    try {
      const stats = await runIngestion(adapter, {
        since,
        deadlineMs: portalDeadline,
      });
      results.push({ adapter_key: source.adapter_key, stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/html-portals] ${source.adapter_key} failed:`, message);
      results.push({ adapter_key: source.adapter_key, stats: null, error: message });
    }
  }

  return NextResponse.json({
    portalsProcessed: results.length,
    portalsTotal: sources.length,
    timedOut: overallTimedOut,
    durationMs: Date.now() - startedAt,
    results,
  });
}
