import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RfpFilters } from "@/components/rfp-filters";
import { RfpList } from "@/components/rfp-list";

type SearchParams = {
  q?: string;
  vertical?: string;
  category?: string;
  state?: string;
  semantic?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  // For semantic search we'd need to embed the query server-side.
  // Phase 1: keyword + filter only. The /api/search route handles semantic
  // when called from the client (so embedding happens out-of-band).
  const { data: rfps, error } = await supabase.rpc("search_rfps", {
    p_keyword: params.q || null,
    p_vertical: params.vertical || null,
    p_category: params.category || null,
    p_state: params.state || null,
    p_limit: 50,
    p_offset: 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Federal + state + institutional RFPs, classified and searchable.
        </p>
      </div>

      <RfpFilters current={params} />

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
          Search failed: {error.message}
        </div>
      ) : (
        <RfpList rfps={rfps ?? []} />
      )}
    </div>
  );
}
