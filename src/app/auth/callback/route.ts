import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Magic-link callback. Supabase redirects here with `?code=...` after the
 * user clicks the email link. We exchange it for a session, then forward
 * to the originally-requested route (via `?next=...`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/saved-searches";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // Fall through to an error page
  return NextResponse.redirect(
    new URL("/login?error=callback_failed", url.origin),
  );
}
