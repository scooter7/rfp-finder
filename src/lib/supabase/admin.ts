import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Admin client — uses the service role key and BYPASSES RLS.
 *
 * Use ONLY in trusted server contexts:
 *   - Ingestion jobs (Vercel Cron routes under /api/cron/*)
 *   - Server-side webhook handlers
 *   - Seed scripts
 *
 * NEVER import this from a client component, route handler that acts on
 * user input, or anywhere the SUPABASE_SERVICE_ROLE_KEY could leak.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin client");
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
