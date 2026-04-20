# RFP Aggregator

A multi-source RFP intelligence platform covering higher-ed, healthcare, K-12, and state/local government across all 50 states.

**Stack:** TypeScript · Next.js 15 · Supabase (Postgres + pgvector) · Vercel · Trigger.dev v3 · Claude Haiku (classification) · OpenAI text-embedding-3-small

**Status:** Week 1 sprint complete. Federal ingestion live, classification pipeline wired, dashboard functional. State adapters are next.

---

## What works today

- **Federal contracts** via SAM.gov Opportunities API — every 4 hours
- **Federal grants** via Grants.gov search2 API — every 6 hours (covers NIH/NSF/DOE/ED/HHS to universities, hospitals, districts)
- **Historical awards** via USAspending.gov search API — weekly pull of contracts + grants for the competitor-intel layer
- **Institution & state portal adapter** — `HtmlPortalAdapter`, config-driven, uses Haiku for LLM-based list extraction (no fragile CSS selectors)
- **LLM classification** of every RFP (vertical, category, tags, confidence) via Claude Haiku 4.5
- **Semantic search** — pgvector HNSW index over 1536-dim OpenAI embeddings
- **"Similar past awards"** on every RFP detail page — given any RFP, instantly surface who won comparable work, when, and for how much
- **Keyword + filter search** with hybrid ranking via the `search_rfps` RPC
- **Dedup** — content hash + embedding similarity to catch the same RFP posted on multiple portals
- **Saved searches + email alerts** via Resend — realtime / daily / weekly digests
- **Supabase magic-link auth** — header shows signed-in state, middleware protects user routes
- **robots.txt audit tool** (`pnpm audit:robots`) — check before adding any new portal

## What's next

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Schema, federal ingestion, dashboard | ✓ |
| 1.5 | Saved searches + Resend email alerts | ✓ |
| 2A | Grants.gov adapter | ✓ |
| 2B | USAspending.gov adapter + competitor intel | ✓ |
| 2C | State portals — audit + pattern ready; concrete states to onboard case-by-case | 🟡 pattern ready |
| 3 | Institution portals (universities, health systems) — pattern ready; first institutions to onboard | 🟡 pattern ready |
| 4 | Multi-tenant SaaS (Stripe billing, tiered plans, team workspaces) | — |

### How to onboard a new portal (state or institution)

This is the repeatable workflow. ~30 minutes per portal.

**1. Audit robots.txt:**
```bash
pnpm audit:robots https://your-portal.gov/bids
```
Check the verdict column. If ❌, don't build — either the owner doesn't want this, or we need commercial licensing.

**2. Add a seed row** in `scripts/seed-sources.ts`:
```ts
{
  adapter_key: "university_of_oregon",
  name: "University of Oregon Procurement",
  type: "institution",
  state: "OR",
  url: "https://uoregon.bonfirehub.com/portal/",
  metadata: { platform: "Bonfire" },
},
```

Then `pnpm seed:sources` to create the row.

**3. Create a Trigger.dev task** at `trigger/tasks/ingest-university-of-oregon.ts`:
```ts
import { schedules, logger } from "@trigger.dev/sdk/v3";
import { HtmlPortalAdapter } from "@/ingestion/adapters/html-portal";
import { runIngestion } from "@/ingestion/pipeline";

const adapter = new HtmlPortalAdapter({
  key: "university_of_oregon",
  name: "University of Oregon Procurement",
  sourceType: "institution",
  state: "OR",
  defaultAgencyName: "University of Oregon",
  listingUrl: "https://uoregon.bonfirehub.com/portal/?tab=openOpportunities",
  extractionHints: "Bonfire-hosted. Opportunities are in cards with a title, posted date, and due date. Ignore the 'Past Opportunities' tab.",
});

export const ingestUoRegon = schedules.task({
  id: "ingest-university-of-oregon",
  cron: "0 5 * * *",
  run: async () => {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const stats = await runIngestion(adapter, { since });
    logger.info("UO ingestion complete", stats);
    return stats;
  },
});
```

**4. Deploy and observe the first run.** `HtmlPortalAdapter` uses Haiku to extract; if results are off, tune `extractionHints` and re-run.

### Why LLM-based extraction over CSS selectors

Traditional scrapers use CSS selectors tied to portal markup. That breaks every time the portal redesigns — and state/institution portals redesign every 2–3 years. The fix is always reactive, costs dev time, and fails silently when a selector matches nothing.

`HtmlPortalAdapter` hands the full HTML (cleaned) to Haiku with a Zod schema describing what an opportunity looks like. Haiku adapts to layout changes automatically. A few thousand tokens per portal per run is vastly cheaper than quarterly scraper maintenance across dozens of sources.

### State portal findings from the audit

Ran `pnpm audit:robots` against the Phase 2C candidate set (CA, TX, NY, FL, IL plus alternates OR, WA, GA, VA, PA). Headline findings:

- **Texas ESBD** — `robots.txt` disallows automated access. Not a target.
- **California Cal eProcure** — client-side SPA; `HtmlPortalAdapter` won't work as-is. Would need Firecrawl or Playwright.
- **NY State Contract Reporter** — requires registration for content access.
- **Florida / Illinois** — similar session/auth constraints to NY.
- **Oregon, Georgia, Virginia** — rescan these first; precedent suggests they're more permissive (Public Bid Tracker scrapes them).

The `HtmlPortalAdapter` pattern is ready. Concrete state adapters become a matter of running the audit and writing a Trigger.dev task per permitted state — no new adapter code required.

### State portal research notes

Investigated CA, TX, NY, FL, IL for Phase 2B. Findings:

- **Texas ESBD** (txsmartbuy.gov): `robots.txt` disallows automated access.
- **California Cal eProcure** (caleprocure.ca.gov): client-side SPA, requires Playwright + JS execution.
- **NY State Contract Reporter** (nyscr.ny.gov): requires registration for content access.
- **Florida Vendor Bid System**: similar registration/session constraints.
- **Illinois BidBuy**: runs on Periscope S2G (third-party platform).

None of the major state portals publish a documented RSS feed or open API. Respecting robots.txt on portals that disallow scraping is a policy decision we've deferred — the commercial alternatives (Public Bid Tracker, BidNet) scrape these regardless of robots.txt, but that posture has legal and ethical downsides we shouldn't adopt by default.

**Revised Phase 2B strategy** (to validate before building):
1. Start with states whose `robots.txt` permits crawling (needs per-state audit)
2. Use state email-alert subscription services (many states offer these) and parse inbound emails
3. For portals that require Playwright, deploy scrapers on dedicated long-running workers (not Trigger.dev) with polite rate limits
4. Consider commercial licensing for the 5-10 hardest states rather than scraping them

---

## Setup

### Prerequisites

- Node 20+, pnpm (or npm/yarn)
- Supabase CLI: `brew install supabase/tap/supabase`
- Accounts: Supabase, Anthropic, OpenAI, [SAM.gov API key](https://open.gsa.gov/api/get-opportunities-public-api/), Trigger.dev

### 1. Install

```bash
pnpm install
cp .env.example .env.local
# fill in the values
```

### 2. Database

```bash
# Link to your Supabase project
supabase link --project-ref <your-ref>

# Push migrations (creates schema + RLS + search functions)
supabase db push

# Regenerate types (overwrites the placeholder)
pnpm db:types

# Seed the initial SAM.gov source row
pnpm seed:sources
```

### 3. Trigger.dev

```bash
# One-time init
npx trigger.dev@latest init

# Run the worker locally
pnpm trigger:dev
```

In a separate terminal, kick off a backfill from the Trigger.dev dashboard:
- Task: `backfill-adapter`
- Payload: `{ "adapterKey": "sam_gov", "sinceDaysAgo": 7, "limit": 200 }`

You'll see records flow into Supabase within a minute.

### 4. Dashboard

```bash
pnpm dev
# http://localhost:3000
```

### 5. Deploy

- **Vercel:** push the repo, set env vars, deploy. The dashboard + `/api/search` work immediately.
- **Trigger.dev:** `pnpm trigger:deploy` ships the cron task and the backfill task to production. Cron fires every 4 hours in prod automatically.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INGESTION                                │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │ SAM.gov  │   │ CA state │   │ TX state │   │   ...    │    │
│  │ adapter  │   │ adapter  │   │ adapter  │   │          │    │
│  └─────┬────┘   └─────┬────┘   └─────┬────┘   └─────┬────┘    │
│        │              │              │              │           │
│        └──────────────┴──────┬───────┴──────────────┘           │
│                              ▼                                   │
│                    ┌──────────────────┐                          │
│                    │ pipeline.ts      │                          │
│                    │  • normalize     │                          │
│                    │  • classify (AI) │                          │
│                    │  • embed         │                          │
│                    │  • dedup         │                          │
│                    │  • upsert        │                          │
│                    └────────┬─────────┘                          │
└─────────────────────────────┼───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                 │
│  rfps · rfp_classifications · rfp_embeddings (pgvector HNSW)    │
│  sources · profiles · saved_searches · alerts                   │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS + VERCEL                            │
│  /            — filter + keyword search (SSR)                   │
│  /rfps/[id]   — detail + "similar opportunities"                │
│  /api/search  — semantic search (embeds query, calls RPC)       │
└─────────────────────────────────────────────────────────────────┘
                          ▲
                          │ schedules + manual backfills
┌─────────────────────────┴───────────────────────────────────────┐
│                      TRIGGER.DEV                                 │
│  ingest-sam-gov    — every 4h cron                              │
│  backfill-adapter  — manual, parameterized                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Adding a new source (state portal, institution, etc.)

This is the key extensibility point. Adding a state takes roughly one file:

1. **Create the adapter** in `src/ingestion/adapters/<state>.ts` implementing `IngestionAdapter`:

   ```ts
   import type { IngestionAdapter, FetchOptions, NormalizedRfp } from "./base";

   export class CaliforniaAdapter implements IngestionAdapter {
     readonly key = "ca_state";
     readonly name = "California Cal eProcure";
     readonly sourceType = "state" as const;
     readonly state = "CA";

     async *fetch(opts: FetchOptions): AsyncIterable<NormalizedRfp> {
       // ... yield normalized records
     }
   }
   ```

2. **Register it** in `src/ingestion/adapters/index.ts`:

   ```ts
   case "ca_state":
     return new CaliforniaAdapter();
   ```

3. **Seed the source row** — add to `scripts/seed-sources.ts` and re-run `pnpm seed:sources`.

4. **Add a Trigger.dev cron** (or reuse the generic backfill task) in `trigger/tasks/`.

That's it. The pipeline handles normalization, classification, embedding, dedup, and storage automatically.

---

## Key design decisions

**Why Trigger.dev over Vercel cron.** Scraping jobs routinely exceed Vercel's 5-minute function timeout. Trigger.dev is TypeScript-native, has built-in retries, and scales to long-running scrapers cleanly.

**Why pgvector over a dedicated vector DB.** Supabase includes it free, RLS still works, and HNSW is fast enough for millions of RFPs. Zero operational overhead.

**Why classify separately from normalize.** Classifications get cheaper and better over time (new models, better prompts). Keeping them in a separate table means we can reclassify the entire corpus with a single backfill task — no data loss.

**Why not just use BidNet's data.** Their ToS prohibits scraping, their lawyers are motivated, and they're incentivized to protect the moat. Source portals are public information — stay in that lane.

**Why store raw_payload.** State portals change formats every few years. Keeping the original source JSON means re-parsing after a schema change doesn't require re-fetching — critical for long-term data integrity.

---

## Project structure

```
.
├── supabase/migrations/        # Schema, RLS, search functions
├── src/
│   ├── app/                    # Next.js app router
│   ├── components/             # RFP list, filters
│   ├── lib/
│   │   ├── supabase/           # client, server, admin
│   │   ├── classification/     # Haiku classifier + schemas
│   │   ├── embeddings/         # OpenAI embedder
│   │   ├── dedup/              # content hash + semantic dedup
│   │   └── utils/
│   └── ingestion/
│       ├── adapters/           # One file per source
│       └── pipeline.ts         # The orchestrator
├── trigger/
│   ├── trigger.config.ts       # (actually lives at repo root)
│   └── tasks/                  # Scheduled + manual tasks
└── scripts/
    └── seed-sources.ts
```

---

## License

Private. Strategic Insights / Jay.
