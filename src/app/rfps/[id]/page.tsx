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
