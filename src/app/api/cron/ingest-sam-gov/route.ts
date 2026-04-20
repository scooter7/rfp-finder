import { NextResponse } from "next/server";

import { createAdapter } from "@/ingestion/adapters";
import { runIngestion } from "@/ingestion/pipeline";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Pro cap

export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const deadlineMs = startedAt + 270_000; // leave 30s margin under maxDuration

  const since = new Date(startedAt - 6 * 60 * 60 * 1000); // 6h overlap window
  const adapter = createAdapter("sam_gov");

  try {
    const stats = await runIngestion(adapter, { since, deadlineMs });
    return NextResponse.json({
      source: "sam_gov",
      since: since.toISOString(),
      durationMs: Date.now() - startedAt,
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/sam_gov] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
