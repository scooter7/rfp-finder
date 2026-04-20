import Link from "next/link";
import { createSavedSearch } from "../actions";

const VERTICALS = [
  { value: "", label: "Any" },
  { value: "higher_ed", label: "Higher Ed" },
  { value: "healthcare", label: "Healthcare" },
  { value: "k12", label: "K-12" },
  { value: "state_local_gov", label: "State/Local Gov" },
  { value: "federal_gov", label: "Federal" },
];

const CATEGORIES = [
  { value: "", label: "Any" },
  { value: "website_redesign", label: "Website Redesign" },
  { value: "web_development", label: "Web Development" },
  { value: "digital_marketing", label: "Digital Marketing" },
  { value: "ai_ml_services", label: "AI / ML" },
  { value: "data_analytics", label: "Data Analytics" },
  { value: "crm_implementation", label: "CRM" },
  { value: "software_development", label: "Software Dev" },
  { value: "branding_design", label: "Branding" },
  { value: "enrollment_marketing", label: "Enrollment Marketing" },
];

export default function NewSavedSearchPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/saved-searches"
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← Back to saved searches
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New saved search
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Matching RFPs will be emailed to you at the frequency you choose.
        </p>
      </div>

      <form
        action={async (fd) => {
          "use server";
          await createSavedSearch(fd);
        }}
        className="space-y-5"
      >
        <Field label="Name" hint="How you'll recognize this search in your list">
          <input
            type="text"
            name="name"
            required
            placeholder="Higher-ed website redesigns in CA"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field
          label="Keyword query"
          hint="Matches against title, description, and agency name (case-insensitive)"
        >
          <input
            type="text"
            name="keywordQuery"
            placeholder="website OR drupal OR cms"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field
          label="Semantic query"
          hint="Natural language — matches meaning, not just keywords. Procurement jargon OK ('digital communications modernization'). Embeds once; re-used per match."
        >
          <textarea
            name="semanticQuery"
            rows={2}
            placeholder="University website redesign with accessibility focus, ideally Drupal"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Vertical">
            <select
              name="vertical"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {VERTICALS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Category">
            <select
              name="category"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="State">
            <input
              type="text"
              name="state"
              maxLength={2}
              placeholder="CA"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
            />
          </Field>
        </div>

        <Field label="Alert frequency">
          <select
            name="alertFrequency"
            defaultValue="daily"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="realtime">Realtime (checks hourly)</option>
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly digest</option>
            <option value="never">Don&apos;t email (track only)</option>
          </select>
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Save
          </button>
          <Link
            href="/saved-searches"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
