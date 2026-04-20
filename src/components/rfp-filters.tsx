"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

export function RfpFilters({
  current,
}: {
  current: {
    q?: string;
    vertical?: string;
    category?: string;
    state?: string;
  };
}) {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? "");
  const [vertical, setVertical] = useState(current.vertical ?? "");
  const [category, setCategory] = useState(current.category ?? "");
  const [state, setState] = useState(current.state ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (vertical) params.set("vertical", vertical);
    if (category) params.set("category", category);
    if (state) params.set("state", state);
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
      <Select
        value={vertical}
        onChange={setVertical}
        options={VERTICALS}
      />
      <Select
        value={category}
        onChange={setCategory}
        options={CATEGORIES}
      />
      <input
        type="text"
        value={state}
        onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
        placeholder="State"
        className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-ring"
      />
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
