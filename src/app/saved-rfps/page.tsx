import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RfpList } from "@/components/rfp-list";

type Rfp = {
  rfp_id: string;
  title: string;
  description: string | null;
  agency_name: string | null;
  state: string | null;
  url: string;
  posted_at: string | null;
  due_at: string | null;
  estimated_value_cents: number | null;
  vertical: string | null;
  category: string | null;
  tags: string[] | null;
  similarity: number | null;
};

type RfpJoinRow = {
  id: string;
  title: string;
  description: string | null;
  agency_name: string | null;
  state: string | null;
  url: string;
  posted_at: string | null;
  due_at: string | null;
  estimated_value_cents: number | null;
};

type ClassificationRow = {
  rfp_id: string;
  vertical: string | null;
  category: string | null;
  tags: string[] | null;
};

type SavedRow = {
  rfp_id: string;
  created_at: string;
  rfps: RfpJoinRow | null;
};

export default async function SavedRfpsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/saved-rfps");

  const supabase = await createServerSupabaseClient();

  // 1. Pull the user's saved rows joined to the base rfps record.
  const savedRes = await supabase
    .from("saved_rfps")
    .select(
      "rfp_id, created_at, rfps!inner(id,title,description,agency_name,state,url,posted_at,due_at,estimated_value_cents)",
    )
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });
  const rows = (savedRes.data ?? []) as unknown as SavedRow[];
  const savedRfpIds = new Set(rows.map((r) => r.rfp_id));

  // 2. Fetch classifications separately (they live on a different table and
  //    supabase-js's nested-select chain can't reach them through saved_rfps).
  const classMap = new Map<string, ClassificationRow>();
  if (rows.length > 0) {
    const classRes = await supabase
      .from("rfp_classifications")
      .select("rfp_id, vertical, category, tags")
      .in(
        "rfp_id",
        rows.map((r) => r.rfp_id),
      );
    for (const c of (classRes.data ?? []) as ClassificationRow[]) {
      classMap.set(c.rfp_id, c);
    }
  }

  const rfps: Rfp[] = rows
    .filter((r): r is SavedRow & { rfps: RfpJoinRow } => r.rfps !== null)
    .map((r) => {
      const c = classMap.get(r.rfp_id);
      return {
        rfp_id: r.rfps.id,
        title: r.rfps.title,
        description: r.rfps.description,
        agency_name: r.rfps.agency_name,
        state: r.rfps.state,
        url: r.rfps.url,
        posted_at: r.rfps.posted_at,
        due_at: r.rfps.due_at,
        estimated_value_cents: r.rfps.estimated_value_cents,
        vertical: c?.vertical ?? null,
        category: c?.category ?? null,
        tags: c?.tags ?? null,
        similarity: null,
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saved RFPs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {rfps.length} RFP{rfps.length === 1 ? "" : "s"} you&apos;ve bookmarked.
        </p>
      </div>
      <RfpList rfps={rfps} savedRfpIds={savedRfpIds} signedIn />
    </div>
  );
}
