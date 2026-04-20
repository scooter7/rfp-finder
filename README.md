# RFP Aggregator

A multi-source RFP intelligence platform covering higher-ed, healthcare, K-12, and state/local government across all 50 states.

**Stack:** TypeScript · Next.js 15 · Supabase (Postgres + pgvector) · Vercel · Trigger.dev v3 · Claude Haiku (classification) · OpenAI text-embedding-3-small

**Status:** Week 1 sprint complete. Federal ingestion live, classification pipeline wired, dashboard functional. State adapters are next.

---

## What works today

- **Federal ingestion** via SAM.gov Opportunities API — automatic every 4 hours
- **LLM classification** of every RFP (vertical, category, tags, confidence) via Claude Haiku 4.5
- **Semantic search** — pgvector HNSW index over 1536-dim OpenAI embeddings
- **Keyword + filter search** with hybrid ranking via the `search_rfps` RPC
- **Dedup** — content hash + embedding similarity to catch the same RFP posted on multiple portals
- **Dashboard** — list + detail views with "similar opportunities" on each RFP page
- **Manual backfill** — kick off historical pulls from the Trigger.dev dashboard

## What's next

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1.5 | Saved searches + Resend email alerts | 3-5 days |
| 2 | State portal adapters — CA, TX, NY, FL, IL | 2-3 weeks |
| 3 | Remaining 45 states + institution-level (top R1 universities, major health systems) | 4-6 weeks |
| 4 | Multi-tenant SaaS (Stripe billing, tiered plans, team workspaces) | 3-4 weeks |

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
