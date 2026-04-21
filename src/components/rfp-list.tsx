import { SaveRfpButton } from "@/components/save-rfp-button";

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

export function RfpList({
  rfps,
  savedRfpIds,
  signedIn,
}: {
  rfps: Rfp[];
  savedRfpIds?: Set<string>;
  signedIn?: boolean;
}) {
  if (rfps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        <p className="text-sm">No RFPs match the current filters.</p>
        <p className="text-xs mt-2">
          If this is a fresh install, run the SAM.gov cron manually from /api/cron/ingest-sam-gov.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rfps.map((rfp) => (
        <li
          key={rfp.rfp_id}
          className="rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <a
              href={`/rfps/${rfp.rfp_id}`}
              className="block flex-1 min-w-0 space-y-2"
            >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-medium leading-snug line-clamp-2">
                {rfp.title}
              </h2>
              {rfp.due_at ? (
                <time className="shrink-0 text-xs text-muted-foreground">
                  Due {new Date(rfp.due_at).toLocaleDateString()}
                </time>
              ) : null}
            </div>

            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              {rfp.agency_name ? <span>{rfp.agency_name}</span> : null}
              {rfp.state ? <span>· {rfp.state}</span> : null}
              {rfp.posted_at ? (
                <span>· posted {new Date(rfp.posted_at).toLocaleDateString()}</span>
              ) : null}
              {rfp.similarity != null ? (
                <span>· {Math.round(rfp.similarity * 100)}% match</span>
              ) : null}
            </div>

            {rfp.vertical || rfp.category || (rfp.tags && rfp.tags.length > 0) ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {rfp.vertical ? (
                  <Tag variant="primary">{formatLabel(rfp.vertical)}</Tag>
                ) : null}
                {rfp.category ? (
                  <Tag>{formatLabel(rfp.category)}</Tag>
                ) : null}
                {rfp.tags?.slice(0, 4).map((t) => (
                  <Tag key={t} variant="muted">
                    {t}
                  </Tag>
                ))}
              </div>
            ) : null}
            </a>
            <SaveRfpButton
              rfpId={rfp.rfp_id}
              initialSaved={savedRfpIds?.has(rfp.rfp_id) ?? false}
              signedIn={signedIn ?? false}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Tag({
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
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function formatLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
