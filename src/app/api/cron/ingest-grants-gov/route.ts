import { NextResponse } from "next/server";

import { createAdapter } from "@/ingestion/adapters";
import { runIngestion } from "@/ingestion/pipeline";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const deadlineMs = startedAt + 270_000;

  const daysParam = new URL(request.url).searchParams.get("days");
  const lookbackMs = daysParam
    ? Math.max(1, Math.min(365, Number(daysParam))) * 86_400_000
    : 12 * 60 * 60 * 1000;
  const since = new Date(startedAt - lookbackMs);
  const adapter = createAdapter("grants_gov");

  try {
    const stats = await runIngestion(adapter, { since, deadlineMs });
    return NextResponse.json({
      source: "grants_gov",
      since: since.toISOString(),
      durationMs: Date.now() - startedAt,
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/grants_gov] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
