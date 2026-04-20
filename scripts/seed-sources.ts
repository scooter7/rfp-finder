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
  // ----- Phase 2 placeholders (uncomment as adapters are built) -----
  // { adapter_key: "ca_state", name: "California Cal eProcure", type: "state",
  //   state: "CA", url: "https://caleprocure.ca.gov/", metadata: {} },
  // { adapter_key: "tx_state", name: "Texas SmartBuy", type: "state",
  //   state: "TX", url: "https://www.txsmartbuy.gov/esbd", metadata: {} },
  // { adapter_key: "ny_state", name: "New York State Contract Reporter", type: "state",
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
