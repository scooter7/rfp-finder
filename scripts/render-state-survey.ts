/**
 * Render docs/state-portal-survey.md from src/ingestion/state-portals.ts.
 *
 * Usage: tsx scripts/render-state-survey.ts
 *        (or: npm run survey:render)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { STATE_PORTALS, tierCounts, type StatePortal } from "../src/ingestion/state-portals";

const DOC_PATH = join(process.cwd(), "docs", "state-portal-survey.md");

const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "1 — Easy (API / RSS)",
  2: "2 — Scrape (HTML permitted)",
  3: "3 — Hard (SPA / auth-gated)",
  4: "4 — Commercial-only (blocked / unreachable)",
};

function linkOrDash(url: string | null): string {
  if (!url) return "—";
  const short = url.length > 60 ? url.slice(0, 57) + "…" : url;
  return `[${short}](${url})`;
}

function row(p: StatePortal): string {
  const robotsCell =
    p.robots === "permitted" ? "✅" :
    p.robots === "disallowed" ? "🚫" :
    p.robots === "unknown" ? "?" : "err";
  const httpCell = p.httpStatus === 0 ? "—" : String(p.httpStatus);
  return `| ${p.state} | ${p.stateName} | ${linkOrDash(p.portalUrl)} | ${p.platform ?? "—"} | ${robotsCell} | ${httpCell} | ${p.mechanism} | ${p.suggestedAdapter} | ${escape(p.notes)} |`;
}

function escape(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function sortForDoc(a: StatePortal, b: StatePortal): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.state.localeCompare(b.state);
}

function render(): string {
  const counts = tierCounts();
  const total = STATE_PORTALS.length;
  const sorted = [...STATE_PORTALS].sort(sortForDoc);

  const lines: string[] = [];
  lines.push("# State procurement-portal survey");
  lines.push("");
  lines.push("_Generated from [`src/ingestion/state-portals.ts`](../src/ingestion/state-portals.ts) — do not edit by hand. Regenerate with `npm run survey:render`._");
  lines.push("");
  lines.push(`**${total} jurisdictions** (50 states + DC). Tier distribution:`);
  lines.push("");
  lines.push(`- **Tier 1 (easy):** ${counts[1]} — public API or verified RSS; existing adapter works.`);
  lines.push(`- **Tier 2 (scrape):** ${counts[2]} — robots-permitted, server-rendered HTML; use \`HtmlPortalAdapter\`.`);
  lines.push(`- **Tier 3 (hard):** ${counts[3]} — SPA / auth-gated / bot-protected; Playwright worker or inbound-email parser.`);
  lines.push(`- **Tier 4 (commercial):** ${counts[4]} — ToS blocks, unreachable, or no public path; commercial feed (GovTribe / GovWin / BidPrime).`);
  lines.push("");
  lines.push("## Recommended roadmap");
  lines.push("");
  lines.push("1. **Ship tier-1 first.** Low effort, immediate coverage. Register `sources` rows with `metadata.rss_url` and the existing `/api/cron/ingest-rss` picks them up.");
  lines.push("2. **Batch tier-2 by platform.** Many states share a common govtech platform (Periscope, Ionwave, Bonfire, Jaggaer). Writing one parser per platform unlocks several states at once.");
  lines.push("3. **Tier-3 deferred.** Needs Playwright on a long-running worker (Railway, Fly, dedicated VM) — won't fit Vercel's 300s cron timeout.");
  lines.push("4. **Tier-4 → commercial decision.** If your customer base needs these states, license aggregated data rather than fight WAFs and ToS clauses.");
  lines.push("");
  lines.push("## Methodology");
  lines.push("");
  lines.push("- **robots.txt** probed with `user-agent: *`, verdict for path `/`. `✅` = permitted, `🚫` = disallowed, `?` = could not read robots.txt.");
  lines.push("- **HTTP** is the status code returned by `curl -L` on the portal homepage. `000` means network/TLS failure; often indicates a WAF or enterprise-only cert.");
  lines.push("- **Platform** detected by regex-matching vendor fingerprints (Bonfire, Periscope/OpenGov, Ionwave, BidNet, Jaggaer, PeopleSoft, etc.) against the homepage body.");
  lines.push("- **Mechanism / adapter** is my recommendation after combining the probe result with domain knowledge of each platform.");
  lines.push("");
  lines.push("Re-run the automated half with `tsx scripts/robots-audit.ts --all-states`.");
  lines.push("");
  lines.push("## All states");
  lines.push("");

  // Grouped by tier
  for (const tier of [1, 2, 3, 4] as const) {
    const rows = sorted.filter((p) => p.tier === tier);
    if (rows.length === 0) continue;
    lines.push(`### Tier ${TIER_LABELS[tier]} — ${rows.length}`);
    lines.push("");
    lines.push("| ST | State | Portal | Platform | robots | HTTP | Mechanism | Adapter | Notes |");
    lines.push("|----|-------|--------|----------|:-:|:-:|-----------|---------|-------|");
    for (const p of rows) lines.push(row(p));
    lines.push("");
  }

  lines.push("## Outside the survey");
  lines.push("");
  lines.push("Federal sources are already wired:");
  lines.push("- **SAM.gov** — public API, `SamGovAdapter` in `src/ingestion/adapters/sam-gov.ts`.");
  lines.push("- **Grants.gov** — public API, `GrantsGovAdapter`.");
  lines.push("- **USAspending.gov** — historical awards, `UsaSpendingAdapter` (for similar-past-award surfacing).");
  lines.push("");
  lines.push("Institution-level procurement (public universities, hospital systems) is a separate thousand-portal surface and is not covered here. The `HtmlPortalAdapter` pattern generalizes to any permitted institution portal.");
  lines.push("");

  return lines.join("\n");
}

const markdown = render();
writeFileSync(DOC_PATH, markdown);
console.log(`wrote ${DOC_PATH} (${markdown.length} chars, ${STATE_PORTALS.length} rows)`);
