import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOut } from "./saved-searches/actions";

export const metadata: Metadata = {
  title: "RFP Aggregator",
  description: "Track RFPs across all 50 states for higher-ed, healthcare, K-12, and gov.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-border">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              RFP&nbsp;Aggregator
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition">
                Browse
              </Link>
              <Link
                href="/saved-searches"
                className="hover:text-foreground transition"
              >
                Saved Searches
              </Link>
              {user ? (
                <form action={signOut} className="flex items-center gap-3">
                  <span className="text-xs">{user.email}</span>
                  <button
                    type="submit"
                    className="text-xs hover:text-foreground transition"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="hover:text-foreground transition"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
