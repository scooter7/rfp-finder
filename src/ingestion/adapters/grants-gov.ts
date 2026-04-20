import pRetry from "p-retry";

import type {
  IngestionAdapter,
  NormalizedRfp,
  FetchOptions,
} from "./base";

/**
 * Grants.gov REST adapter.
 *
 * API: POST https://api.grants.gov/v1/api/search2
 * Docs: https://grants.gov/api/common/search2
 *
 * No authentication required. Public, rate-limited.
 *
 * Why this matters for our verticals:
 *   - Higher-ed: NIH/NSF/DOE/ED grants flow here in huge volume
 *   - Healthcare: HHS/CDC grants to hospitals and health systems
 *   - K-12: Department of Education grants to districts
 *   - State/local gov: competitive federal grants
 *
 * SAM.gov covers procurement contracts; Grants.gov covers financial assistance.
 * They're complementary, not overlapping — we want both.
 *
 * Limitations:
 *   - search2 returns basic fields only (title, agency, dates, status, ALN list,
 *     eligibilities). Full descriptions require a separate fetchOpportunity call
 *     — we skip that for now and enrich lazily if ever needed.
 *   - `state` is null for all records (federal grants don't have a state concept
 *     at this level; place-of-performance lives inside the award downstream).
 */

const ENDPOINT = "https://api.grants.gov/v1/api/search2";
const PAGE_SIZE = 100;

interface GrantsGovHit {
  id: string;
  number: string;
  title: string;
  agencyCode?: string;
  agencyName?: string;
  openDate?: string; // MM/DD/YYYY
  closeDate?: string; // MM/DD/YYYY
  oppStatus?: "posted" | "forecasted" | "closed" | "archived";
  docType?: string;
  alnist?: string[]; // list of Assistance Listing Numbers (CFDA)
}

interface GrantsGovSearch2Response {
  errorcode: number;
  msg: string;
  data: {
    hitCount: number;
    startRecord: number;
    oppHits: GrantsGovHit[];
    eligibilities?: Array<{ label: string; value: string; count: number }>;
    fundingCategories?: Array<{ label: string; value: string; count: number }>;
    agencies?: Array<{ label: string; value: string; count: number }>;
  };
}

export interface GrantsGovAdapterOptions {
  /** Grants.gov opportunity statuses to fetch. Default: posted + forecasted */
  statuses?: Array<"posted" | "forecasted" | "closed" | "archived">;
  /** Filter to specific agencies (e.g. ["ED", "HHS", "NSF"]) */
  agencies?: string[];
  /** Filter to specific eligibility codes (e.g. "20,21" for higher ed) */
  eligibilities?: string[];
}

export class GrantsGovAdapter implements IngestionAdapter {
  readonly key = "grants_gov";
  readonly name = "Grants.gov Federal Grant Opportunities";
  readonly sourceType = "federal" as const;

  constructor(private readonly options: GrantsGovAdapterOptions = {}) {}

  async *fetch(options: FetchOptions): AsyncIterable<NormalizedRfp> {
    const statuses = this.options.statuses ?? ["posted", "forecasted"];
    const cap = options.limit ?? Number.POSITIVE_INFINITY;
    let startRecordNum = 0;
    let yielded = 0;

    while (yielded < cap) {
      const response = await this.page({
        startRecordNum,
        rows: Math.min(PAGE_SIZE, cap - yielded),
        oppStatuses: statuses.join("|"),
        agencies: this.options.agencies?.join("|") ?? "",
        eligibilities: this.options.eligibilities?.join("|") ?? "",
      });

      const hits = response.data?.oppHits ?? [];
      if (hits.length === 0) break;

      for (const hit of hits) {
        // Filter by postedAt (since) in adapter — Grants.gov doesn't support
        // a server-side date range filter in the public API.
        if (options.since && hit.openDate) {
          const posted = parseMdy(hit.openDate);
          if (posted && posted < options.since) continue;
        }

        yield this.normalize(hit);
        yielded++;
        if (yielded >= cap) return;
      }

      startRecordNum += hits.length;
      if (startRecordNum >= response.data.hitCount) break;

      await sleep(300);
    }
  }

  private async page(body: {
    startRecordNum: number;
    rows: number;
    oppStatuses: string;
    agencies: string;
    eligibilities: string;
  }): Promise<GrantsGovSearch2Response> {
    return pRetry(
      async () => {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Grants.gov ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as GrantsGovSearch2Response;
        if (json.errorcode !== 0) {
          throw new Error(`Grants.gov error: ${json.msg}`);
        }
        return json;
      },
      { retries: 3, minTimeout: 2000, factor: 2 },
    );
  }

  private normalize(hit: GrantsGovHit): NormalizedRfp {
    return {
      externalId: hit.id,
      title: hit.title,
      // search2 doesn't return the description. Classification still works well
      // off title + agency + ALN list; we can enrich later via fetchOpportunity.
      description: buildSyntheticDescription(hit),
      url: `https://www.grants.gov/search-results-detail/${hit.id}`,
      agencyName: hit.agencyName ?? hit.agencyCode ?? null,
      state: null, // federal grants don't carry state at this level
      postedAt: parseMdy(hit.openDate),
      dueAt: parseMdy(hit.closeDate),
      estimatedValueCents: null, // not in search response; would need fetchOpportunity
      rawPayload: hit,
    };
  }
}

// ----- helpers -----

/**
 * Build a pseudo-description from what search2 returns. Gives the classifier
 * something to chew on beyond just the title. When we add fetchOpportunity
 * enrichment later, this gets replaced by the real text.
 */
function buildSyntheticDescription(hit: GrantsGovHit): string {
  const parts: string[] = [];
  parts.push(`Opportunity ${hit.number}`);
  if (hit.docType) parts.push(`Type: ${hit.docType}`);
  if (hit.oppStatus) parts.push(`Status: ${hit.oppStatus}`);
  if (hit.alnist && hit.alnist.length > 0) {
    parts.push(`Assistance Listing Numbers (CFDA): ${hit.alnist.join(", ")}`);
  }
  return parts.join(". ");
}

function parseMdy(s: string | undefined): Date | null {
  if (!s) return null;
  // Expected format: MM/DD/YYYY
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
