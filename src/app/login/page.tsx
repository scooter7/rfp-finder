"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/saved-searches";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);

    const supabase = createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage(`Check your inbox at ${email} for the sign-in link.`);
  }

  return (
    <div className="max-w-sm mx-auto pt-12 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email you a one-time sign-in link — no password.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "sending" || status === "sent"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={status === "sending" || status === "sent" || !email}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === "sending"
            ? "Sending…"
            : status === "sent"
              ? "Link sent"
              : "Send sign-in link"}
        </button>
      </form>

      {message ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            status === "error"
              ? "border-destructive/50 bg-destructive/5 text-destructive"
              : "border-border bg-muted/50"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
