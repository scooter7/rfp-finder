/**
 * Seed script. Run once after `supabase db push`:
 *   tsx scripts/seed-sources.ts
 *
 * Idempotent — re-running updates existing rows by adapter_key.
 */
import { createAdminClient } from "../src/lib/supabase/admin";

const SEED_SOURCES = [
  {
    adapter_key: "sam_gov",
    name: "SAM.gov Contract Opportunities",
    type: "federal",
    state: null,
    url: "https://sam.gov/search/?index=opp",
    metadata: {
      api: "https://api.sam.gov/opportunities/v2/search",
      notes: "Federal contract opportunities. Rate-limited to 1000 req/hr on public tier.",
    },
  },
  {
    adapter_key: "grants_gov",
    name: "Grants.gov Federal Grant Opportunities",
    type: "federal",
    state: null,
    url: "https://www.grants.gov/search-grants",
    metadata: {
      api: "https://api.grants.gov/v1/api/search2",
      notes: "Federal financial assistance. No auth. ~1000 posted + ~700 forecasted at any time. Big signal for higher-ed (NIH/NSF/DOE/ED), healthcare (HHS/CDC), K-12 (ED).",
    },
  },
  {
    adapter_key: "usaspending_gov",
    name: "USAspending.gov Federal Awards",
    type: "federal",
    state: null,
    url: "https://www.usaspending.gov/",
    metadata: {
      api: "https://api.usaspending.gov/api/v2/search/spending_by_award/",
      notes: "Historical federal awards (contracts + grants). No auth. Powers the 'similar past awards' competitor-intel view on RFP detail pages.",
    },
  },
  // ----- Phase 2B (state portals) -----
  // Every major state portal (CA, TX, NY, FL, IL) either disallows scraping
  // via robots.txt or runs as a client-side SPA requiring Playwright.
  // We'll need per-portal ToS review + a more careful scraping strategy
  // (polite rate limits, caching, possibly commercial licensing for some states).
  //
  // { adapter_key: "ca_state", name: "California Cal eProcure", type: "state",
  //   state: "CA", url: "https://caleprocure.ca.gov/", metadata: {} },
  // { adapter_key: "tx_state", name: "Texas SmartBuy ESBD", type: "state",
  //   state: "TX", url: "https://www.txsmartbuy.gov/esbd", metadata: {} },
  // { adapter_key: "ny_state", name: "NY State Contract Reporter", type: "state",
  //   state: "NY", url: "https://www.nyscr.ny.gov/", metadata: {} },
];

async function main() {
  const supabase = createAdminClient();

  for (const source of SEED_SOURCES) {
    const { error } = await supabase
      .from("sources")
      .upsert(source, { onConflict: "adapter_key" });

    if (error) {
      console.error(`❌ ${source.adapter_key}: ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ ${source.adapter_key}`);
  }

  console.log(`\nSeeded ${SEED_SOURCES.length} source(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
