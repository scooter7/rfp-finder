import { NextResponse } from "next/server";

import { UsaSpendingAdapter } from "@/ingestion/adapters/usaspending";
import { runAwardIngestion } from "@/ingestion/awards-pipeline";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const deadlineMs = startedAt + 270_000;

  const since = new Date(startedAt - 14 * 86_400_000); // 14-day window
  const adapter = new UsaSpendingAdapter({
    awardTypeGroups: ["CONTRACTS", "GRANTS"],
  });

  try {
    const stats = await runAwardIngestion(adapter, {
      since,
      minValueCents: 10_000 * 100, // $10K floor
      deadlineMs,
    });
    return NextResponse.json({
      source: "usaspending",
      since: since.toISOString(),
      durationMs: Date.now() - startedAt,
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/usaspending] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
