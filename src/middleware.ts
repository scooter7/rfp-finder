import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Refreshes the user's Supabase session on every request and protects
 * authenticated-only routes.
 *
 * Protected routes:
 *   - /saved-searches/*      (user-specific data)
 *
 * Public routes (no auth required):
 *   - /                      (browse RFPs)
 *   - /rfps/*                (RFP detail)
 *   - /login                 (auth entry)
 *   - /auth/callback         (OAuth / magic-link callback)
 *   - /api/*                 (search + webhooks — enforce auth per-route)
 */

const PROTECTED_PREFIXES = ["/saved-searches", "/saved-rfps", "/admin"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Enforce auth on protected routes
  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
