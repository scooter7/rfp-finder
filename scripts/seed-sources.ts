/**
 * Seed script. Run once after `supabase db push`:
 *   tsx scripts/seed-sources.ts
 *
 * Idempotent — re-running updates existing rows by adapter_key.
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import type { Database } from "../src/lib/supabase/database.types";

type SourceInsert = Database["public"]["Tables"]["sources"]["Insert"];

const SEED_SOURCES: SourceInsert[] = [
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
  // ----- State portals: tier-2 HTML-scrape (HtmlPortalAdapter) -----
  // These have server-rendered listing pages that don't need JS. The
  // ingest-html-portals cron picks them up via metadata.html_portal.
  {
    adapter_key: "me_dafs_bbm",
    name: "Maine Division of Purchases",
    type: "state",
    state: "ME",
    url: "https://www.maine.gov/dafs/bbm/procurementservices/vendors/rfps",
    metadata: {
      html_portal: {
        listing_url: "https://www.maine.gov/dafs/bbm/procurementservices/vendors/rfps",
        default_agency: "Maine BBM Division of Purchases",
        extraction_hints:
          "Single HTML table. Each row = one RFP. Columns: Title, RFP # (externalId), Issuing Department, Date Posted, Q&A, Amendment. Detail URL is in the Title cell.",
      },
    },
  },
  {
    adapter_key: "in_idoa",
    name: "Indiana IDOA Current Business Opportunities",
    type: "state",
    state: "IN",
    url: "https://www.in.gov/idoa/procurement/current-business-opportunities/",
    metadata: {
      html_portal: {
        listing_url: "https://www.in.gov/idoa/procurement/current-business-opportunities/",
        default_agency: "Indiana Department of Administration",
        extraction_hints:
          "Current business opportunities table. Columns: Solicitation Number, Title, Agency, Issue Date, Close Date. Only current (not archive).",
        max_pages: 1,
      },
    },
  },
  {
    adapter_key: "la_lapac",
    name: "Louisiana LaPAC",
    type: "state",
    state: "LA",
    url: "https://wwwcfprd.doa.louisiana.gov/OSP/LaPAC/pubmain.cfm",
    metadata: {
      html_portal: {
        listing_url: "https://wwwcfprd.doa.louisiana.gov/osp/lapac/deptbids.cfm",
        default_agency: "Louisiana Office of State Procurement",
        extraction_hints:
          "Bids grouped by department. Capture title, proposal number, open/close dates.",
      },
    },
  },
  {
    adapter_key: "ne_materiel",
    name: "Nebraska DAS Materiel Purchasing",
    type: "state",
    state: "NE",
    url: "https://das.nebraska.gov/materiel/purchasing.html",
    metadata: {
      html_portal: {
        listing_url: "https://das.nebraska.gov/materiel/purchasing.html",
        default_agency: "Nebraska DAS Materiel Division",
        extraction_hints:
          "Open solicitations listed in tables. Columns: Solicitation number (externalId), Title, Issue Date, Close Date.",
      },
    },
  },
  {
    adapter_key: "ak_opn",
    name: "Alaska Online Public Notices (Procurement)",
    type: "state",
    state: "AK",
    url: "https://aws.state.ak.us/OnlinePublicNotices/",
    metadata: {
      html_portal: {
        listing_url: "https://aws.state.ak.us/OnlinePublicNotices/Notices/Search.aspx?st=1",
        default_agency: "State of Alaska",
        extraction_hints:
          "Public notices filtered to Solicitations. Columns: Subject (title), Department, Publication Date, Close Date, Notice Number (externalId). Only procurement-related.",
      },
    },
  },
  {
    adapter_key: "sd_boa",
    name: "South Dakota BOA Current Solicitations",
    type: "state",
    state: "SD",
    url: "https://boa.sd.gov/vendor-info/current-solicitations/",
    status: "paused",
    metadata: {
      html_portal: {
        listing_url: "https://boa.sd.gov/vendor-info/current-solicitations/",
        default_agency: "South Dakota Bureau of Administration",
        paused_reason: "962KB HTML blows 80KB simplifier budget; need narrower listing URL",
      },
    },
  },

  // ----- State portals: tier-3 SPA via Jina Reader (requires_js: true) -----
  // The Jina Reader free endpoint renders the page and returns Markdown; our
  // HtmlPortalAdapter detects requires_js and proxies through r.jina.ai.
  {
    adapter_key: "mo_missouribuys",
    name: "Missouri MissouriBUYS MOVERS",
    type: "state",
    state: "MO",
    url: "https://missouribuys.mo.gov/bid-board/movers",
    metadata: {
      html_portal: {
        listing_url:
          "https://ewqg.fa.us8.oraclecloud.com/fscmUI/redwood/negotiation-abstracts/view/abstractlisting?prcBuId=300000005255687&ojSpLang=en",
        default_agency: "State of Missouri",
        requires_js: true,
        extraction_hints:
          "Oracle MOVERS solicitation abstracts page. Each bullet is one opportunity with type (RFP/SFS/RFI/IFB/RFQ), solicitation number (externalId), and title. Extract only Active ones; skip Closed.",
      },
    },
  },
  {
    adapter_key: "nj_njstart",
    name: "NJSTART",
    type: "state",
    state: "NJ",
    url: "https://www.njstart.gov/",
    metadata: {
      html_portal: {
        listing_url: "https://www.njstart.gov/bso/external/publicBids.sdo",
        default_agency: "State of New Jersey",
        requires_js: true,
        extraction_hints:
          "NJSTART (Periscope) public bids. Extract current solicitations with title, bid number, open/close dates.",
      },
    },
  },
  {
    adapter_key: "or_oregonbuys",
    name: "OregonBuys",
    type: "state",
    state: "OR",
    url: "https://oregonbuys.gov/",
    metadata: {
      html_portal: {
        listing_url: "https://oregonbuys.gov/bso/external/publicBids.sdo",
        default_agency: "State of Oregon",
        requires_js: true,
        extraction_hints:
          "OregonBuys (Periscope S2G) public bids. Each row is a solicitation.",
      },
    },
  },
  {
    adapter_key: "va_eva",
    name: "Virginia eVA",
    type: "state",
    state: "VA",
    url: "https://eva.virginia.gov/",
    metadata: {
      html_portal: {
        listing_url: "https://eva.virginia.gov/pr/public",
        default_agency: "Commonwealth of Virginia",
        requires_js: true,
        extraction_hints:
          "eVA public opportunities. Each row represents a solicitation; capture title, reference number, agency, open/close dates.",
      },
    },
  },

  // ----- State portals: RSS-based (paused — feeds proved abandoned) -----
  // Kept as declared sources so the repo remembers they were tried and why.
  {
    adapter_key: "dc_ocp",
    name: "DC Office of Contracting & Procurement",
    type: "state",
    state: "DC",
    url: "https://ocp.dc.gov/",
    status: "paused",
    metadata: {
      rss_url: "https://ocp.dc.gov/rss.xml",
      default_agency: "DC Office of Contracting & Procurement",
      paused_reason: "RSS feed abandoned — DC last updated 2024-09; re-check 2026-Q3",
    },
  },
  {
    adapter_key: "nm_state_purchasing",
    name: "New Mexico State Purchasing",
    type: "state",
    state: "NM",
    url: "https://www.generalservices.state.nm.us/state-purchasing/",
    status: "paused",
    metadata: {
      rss_url: "https://generalservices.state.nm.us/feed/",
      default_agency: "New Mexico General Services Department",
      paused_reason: "WordPress feed has 0 items; not a procurement feed",
    },
  },

  // ----- Institution-level HTML portals (Phase 3, not yet wired) -----
  // When adding one: run `tsx scripts/robots-audit.ts <URL>` first, then add
  // an entry here with type="institution" and 2-char state. The existing
  // ingest-html-portals cron picks it up automatically.
];

async function main() {
  const supabase = createAdminClient();

  for (const source of SEED_SOURCES) {
    const { error } = await supabase
      .from("sources")
      // Cast: our hand-written Database types omit `Relationships`, which
      // supabase-js needs to infer the Insert param type; it falls back to
      // `never` for a named variable (inline literals happen to work).
      .upsert(source as never, { onConflict: "adapter_key" });

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
