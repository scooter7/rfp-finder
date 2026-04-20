"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const VERTICALS = [
  { value: "", label: "All verticals" },
  { value: "higher_ed", label: "Higher Ed" },
  { value: "healthcare", label: "Healthcare" },
  { value: "k12", label: "K-12" },
  { value: "state_local_gov", label: "State/Local Gov" },
  { value: "federal_gov", label: "Federal" },
];

const CATEGORIES = [
  { value: "", label: "All categories" },
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

const STATES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "D.C." }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

export function RfpFilters({
  current,
}: {
  current: {
    q?: string;
    vertical?: string;
    category?: string;
    states?: string[];
  };
}) {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? "");
  const [vertical, setVertical] = useState(current.vertical ?? "");
  const [category, setCategory] = useState(current.category ?? "");
  const [states, setStates] = useState<string[]>(current.states ?? []);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (vertical) params.set("vertical", vertical);
    if (category) params.set("category", category);
    // Empty array = "all states" — omit param entirely
    for (const s of states) params.append("state", s);
    router.push(params.toString() ? `/?${params}` : "/");
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3"
    >
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Keyword search..."
        className="flex-1 min-w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Select value={vertical} onChange={setVertical} options={VERTICALS} />
      <Select value={category} onChange={setCategory} options={CATEGORIES} />
      <StatesPicker value={states} onChange={setStates} />
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Apply
      </button>
    </form>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StatesPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = new Set(value);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle(code: string) {
    const next = new Set(value);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(Array.from(next).sort());
  }

  const allSelected = selected.size === 0 || selected.size === STATES.length;
  const label =
    selected.size === 0 || selected.size === STATES.length
      ? "All states"
      : selected.size === 1
        ? value[0]
        : `${selected.size} states`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {label} ▾
      </button>
      {open ? (
        <div className="absolute z-10 mt-1 w-72 max-h-80 overflow-auto rounded-md border border-border bg-popover shadow-lg">
          <div className="sticky top-0 flex justify-between gap-2 border-b border-border bg-popover px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => onChange([])}
              className="hover:underline"
            >
              All states
            </button>
            <button
              type="button"
              onClick={() => onChange(STATES.map((s) => s.code))}
              className="hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="hover:underline text-muted-foreground"
            >
              Clear
            </button>
          </div>
          <ul className="py-1">
            {STATES.map((s) => (
              <li key={s.code}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={selected.has(s.code)}
                    onChange={() => toggle(s.code)}
                  />
                  <span className="font-mono text-xs text-muted-foreground w-7">
                    {s.code}
                  </span>
                  <span>{s.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {/* hint when nothing picked */}
      {!open && allSelected ? null : null}
    </div>
  );
}
