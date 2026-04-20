"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setMessage(body.error ?? "Failed to invite");
      return;
    }

    setStatus("ok");
    setMessage(`Invite sent to ${email}`);
    setEmail("");
    setRole("member");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
    >
      <div className="flex-1 min-w-[240px] space-y-1.5">
        <label htmlFor="invite-email" className="text-xs font-medium">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "sending"}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          placeholder="person@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="invite-role" className="text-xs font-medium">
          Role
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "member")}
          disabled={status === "sending"}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={status === "sending" || !email}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send invite"}
      </button>
      {message ? (
        <p
          className={`w-full text-xs ${
            status === "error" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
