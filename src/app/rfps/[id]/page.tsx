import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function RfpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: rfp } = await supabase
    .from("rfps")
    .select(
      `
      id, title, description, full_text, url, agency_name, state,
      posted_at, due_at, estimated_value_cents,
      classification:rfp_classifications(vertical, category, tags, confidence)
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!rfp) notFound();

  // Find similar RFPs via pgvector
  const { data: similar } = await supabase.rpc("find_similar_rfps", {
    p_rfp_id: id,
    p_limit: 5,
    p_min_similarity: 0.8,
  });

  // Find similar PAST AWARDS — competitor intelligence
  const { data: similarAwards } = await supabase.rpc("find_similar_awards", {
    p_rfp_id: id,
    p_limit: 10,
    p_min_similarity: 0.75,
    p_max_age_days: 1095, // last 3 years
  });

  const classification = Array.isArray(rfp.classification)
    ? rfp.classification[0]
    : rfp.classification;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← Back to list
        </a>
      </div>

      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight leading-snug">
          {rfp.title}
        </h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {classification?.vertical ? (
            <Badge variant="primary">{classification.vertical}</Badge>
          ) : null}
          {classification?.category ? (
            <Badge>{classification.category}</Badge>
          ) : null}
          {classification?.tags?.map((t: string) => (
            <Badge key={t} variant="muted">
              {t}
            </Badge>
          ))}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Agency" value={rfp.agency_name ?? "—"} />
        <Field label="State" value={rfp.state ?? "—"} />
        <Field
          label="Posted"
          value={rfp.posted_at ? new Date(rfp.posted_at).toLocaleDateString() : "—"}
        />
        <Field
          label="Due"
          value={rfp.due_at ? new Date(rfp.due_at).toLocaleString() : "—"}
        />
      </dl>

      {rfp.description ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Description
          </h2>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">
            {rfp.description}
          </div>
        </section>
      ) : null}

      <a
        href={rfp.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        View on source site →
      </a>

      {similar && similar.length > 0 ? (
        <section className="space-y-2 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Similar opportunities
          </h2>
          <ul className="space-y-2">
            {similar.map((s) => (
              <li key={s.rfp_id} className="text-sm">
                <a
                  href={`/rfps/${s.rfp_id}`}
                  className="hover:underline font-medium"
                >
                  {s.title}
                </a>{" "}
                <span className="text-muted-foreground">
                  — {s.agency_name} ({Math.round(s.similarity * 100)}% match)
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {similarAwards && similarAwards.length > 0 ? (
        <section className="space-y-3 border-t border-border pt-6">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Similar past awards
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Who won comparable work, when, and for how much. Competitive intel from USAspending.gov.
            </p>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Recipient</th>
                  <th className="px-3 py-2 text-left font-medium">Agency</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Date</th>
                  <th className="px-3 py-2 text-right font-medium">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {similarAwards.map((a) => (
                  <tr key={a.award_id} className="hover:bg-muted/50 transition">
                    <td className="px-3 py-2">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        {a.recipient_name ?? "—"}
                      </a>
                      {a.title ? (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {a.title}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{a.awarding_agency ?? "—"}</div>
                      {a.awarding_sub_agency ? (
                        <div className="text-muted-foreground">
                          {a.awarding_sub_agency}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs capitalize">
                      {a.award_type}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(a.total_obligated_cents)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                      {a.action_date
                        ? new Date(a.action_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                      {Math.round(a.similarity * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "muted";
}) {
  const styles = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary text-primary-foreground",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    return `$${(dollars / 1_000).toFixed(0)}K`;
  }
  return `$${dollars.toFixed(0)}`;
}
