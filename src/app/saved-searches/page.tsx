import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteSavedSearch } from "./actions";

export default async function SavedSearchesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: searches } = await supabase
    .from("saved_searches")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Saved Searches
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Get emailed when new RFPs match your criteria.
          </p>
        </div>
        <Link
          href="/saved-searches/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          New saved search
        </Link>
      </div>

      {!searches || searches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          <p className="text-sm">No saved searches yet.</p>
          <p className="text-xs mt-2">
            Create one to start receiving email alerts for matching RFPs.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {searches.map((s) => {
            const f = (s.filters ?? {}) as Record<string, string>;
            return (
              <li
                key={s.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {s.keyword_query ? (
                        <Chip label="keyword" value={s.keyword_query} />
                      ) : null}
                      {s.semantic_query ? (
                        <Chip label="semantic" value={s.semantic_query} />
                      ) : null}
                      {f.vertical ? (
                        <Chip label="vertical" value={f.vertical} />
                      ) : null}
                      {f.category ? (
                        <Chip label="category" value={f.category} />
                      ) : null}
                      {f.state ? <Chip label="state" value={f.state} /> : null}
                      <Chip label="frequency" value={s.alert_frequency} />
                    </div>
                    {s.last_matched_at ? (
                      <div className="text-xs text-muted-foreground">
                        Last matched:{" "}
                        {new Date(s.last_matched_at).toLocaleString()}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Not yet run
                      </div>
                    )}
                  </div>

                  <form
                    action={async () => {
                      "use server";
                      await deleteSavedSearch(s.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground hover:text-destructive transition"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
      <span className="text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </span>
  );
}
