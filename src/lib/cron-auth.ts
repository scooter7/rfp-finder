import { NextResponse } from "next/server";

/**
 * Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` when the
 * CRON_SECRET env var is set on the project. Verify it on every cron
 * route so the endpoints aren't publicly invokable.
 *
 * Returns a NextResponse to return immediately on failure, or null on success.
 */
export function verifyCronRequest(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
