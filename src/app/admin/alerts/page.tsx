import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminAlertsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/admin/alerts");
  if (session.role !== "admin") redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data: alerts } = await supabase
    .from("alerts")
    .select("id, user_id, rfp_id, saved_search_id, relevance_score, sent_at, clicked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const userIds = Array.from(new Set((alerts ?? []).map((a) => a.user_id)));
  const rfpIds = Array.from(new Set((alerts ?? []).map((a) => a.rfp_id)));

  const [{ data: owners }, { data: rfps }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; email: string }[] }),
    rfpIds.length
      ? supabase.from("rfps").select("id, title").in("id", rfpIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const ownerEmail = new Map(owners?.map((o) => [o.id, o.email]) ?? []);
  const rfpTitle = new Map(rfps?.map((r) => [r.id, r.title]) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">All alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Most recent 500. {alerts?.length ?? 0} shown.
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Owner</th>
              <th className="text-left px-4 py-2">RFP</th>
              <th className="text-left px-4 py-2">Score</th>
              <th className="text-left px-4 py-2">Sent</th>
              <th className="text-left px-4 py-2">Clicked</th>
              <th className="text-left px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {(alerts ?? []).map((a) => (
              <tr key={a.id} className="border-t border-border align-top">
                <td className="px-4 py-2">
                  {ownerEmail.get(a.user_id) ?? a.user_id}
                </td>
                <td className="px-4 py-2">
                  {rfpTitle.get(a.rfp_id) ?? a.rfp_id}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {a.relevance_score ?? "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {a.sent_at ? new Date(a.sent_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {a.clicked_at ? new Date(a.clicked_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
