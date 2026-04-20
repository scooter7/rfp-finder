import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminSavedSearchesPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/admin/saved-searches");
  if (session.role !== "admin") redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data: searches } = await supabase
    .from("saved_searches")
    .select("id, user_id, name, keyword_query, semantic_query, filters, alert_frequency, last_matched_at, created_at")
    .order("created_at", { ascending: false });

  const userIds = Array.from(new Set((searches ?? []).map((s) => s.user_id)));
  const { data: owners } = userIds.length
    ? await supabase.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };
  const ownerEmail = new Map(owners?.map((o) => [o.id, o.email]) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          All saved searches
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Across every user. {searches?.length ?? 0} total.
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Owner</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Keyword</th>
              <th className="text-left px-4 py-2">Semantic</th>
              <th className="text-left px-4 py-2">Frequency</th>
              <th className="text-left px-4 py-2">Last matched</th>
              <th className="text-left px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {(searches ?? []).map((s) => (
              <tr key={s.id} className="border-t border-border align-top">
                <td className="px-4 py-2">{ownerEmail.get(s.user_id) ?? s.user_id}</td>
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {s.keyword_query ?? "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {s.semantic_query ?? "—"}
                </td>
                <td className="px-4 py-2">{s.alert_frequency}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {s.last_matched_at
                    ? new Date(s.last_matched_at).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
