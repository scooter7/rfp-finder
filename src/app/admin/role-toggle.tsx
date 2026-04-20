"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RoleToggle({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: "admin" | "member";
  isSelf: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(role);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: "admin" | "member") {
    setError(null);
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: next }),
      });
      if (!res.ok) {
        setCurrent(previous);
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value as "admin" | "member")}
        disabled={pending || isSelf}
        title={isSelf ? "You can't change your own role" : undefined}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
