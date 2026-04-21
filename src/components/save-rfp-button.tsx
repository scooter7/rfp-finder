"use client";

import { useState, useTransition } from "react";

import { toggleSavedRfp } from "@/app/actions/save-rfp";

export function SaveRfpButton({
  rfpId,
  initialSaved,
  signedIn,
}: {
  rfpId: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      window.location.href = `/login?next=/`;
      return;
    }
    const previous = saved;
    setSaved(!previous);
    setError(null);
    startTransition(async () => {
      const res = await toggleSavedRfp(rfpId);
      if (res.error) {
        setSaved(previous);
        setError(res.error);
        return;
      }
      setSaved(res.saved);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={saved ? "Remove from saved" : "Save for later"}
      aria-pressed={saved}
      className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition ${
        saved
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:border-foreground/20"
      } ${pending ? "opacity-50" : ""}`}
    >
      {saved ? "★ Saved" : "☆ Save"}
      {error ? <span className="ml-1 text-destructive">!</span> : null}
    </button>
  );
}
