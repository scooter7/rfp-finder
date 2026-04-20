import pRetry from "p-retry";

import type {
  IngestionAdapter,
  NormalizedRfp,
  FetchOptions,
} from "./base";

/**
 * SAM.gov Opportunities API adapter.
 *
 * Docs: https://open.gsa.gov/api/get-opportunities-public-api/
 *
 * Notes:
 *   - Requires a free API key (env: SAM_GOV_API_KEY).
 *   - Public tier is rate-limited (~1,000 requests/hour). Page size max 1000.
 *   - Date params use MM/dd/yyyy format.
 *   - `description` in the response is a URL, not the text. We fetch it
 *     inline (with a soft failure mode) so the pipeline gets real content.
 *   - Notice types we pull:
 *       o = Solicitation
 *       p = Presolicitation
 *       k = Combined Synopsis/Solicitation
 *       r = Sources Sought
 *     (award notices, sale of surplus, intent-to-bundle, and special notices
 *      are excluded — they're rarely useful for vendor lead-gen.)
 */

const BASE_URL = "https://api.sam.gov/prod/opportunities/v2/search";
const NOTICE_TYPES = ["o", "p", "k", "r"].join(",");
const PAGE_SIZE = 1000;

interface SamGovOpportunity {
  noticeId: string;
  title: string;
  solicitationNumber?: string;
  fullParentPathName?: string; // dot-delimited agency hierarchy
  postedDate?: string; // YYYY-MM-DD
  type?: string;
  baseType?: string;
  archiveType?: string;
  archiveDate?: string | null;
  typeOfSetAsideDescription?: string | null;
  responseDeadLine?: string | null; // ISO
  naicsCode?: string;
  classificationCode?: string;
  active?: string; // "Yes" | "No"
  award?: { amount?: string } | null;
  description?: string; // URL to description text
  organizationType?: string;
  officeAddress?: { state?: string | null };
  placeOfPerformance?: { state?: { code?: string; name?: string } };
  uiLink?: string;
  links?: Array<{ rel?: string; href?: string }>;
}

interface SamGovSearchResponse {
  totalRecords: number;
  limit: number;
  offset: number;
  opportunitiesData: SamGovOpportunity[];
}

export class SamGovAdapter implements IngestionAdapter {
  readonly key = "sam_gov";
  readonly name = "SAM.gov Contract Opportunities";
  readonly sourceType = "federal" as const;

  constructor(
    private readonly apiKey: string = process.env.SAM_GOV_API_KEY ?? "",
    private readonly fetchDescriptions = true,
  ) {
    if (!this.apiKey) {
      throw new Error("SAM_GOV_API_KEY is required");
    }
  }

  async *fetch(options: FetchOptions): AsyncIterable<NormalizedRfp> {
    const postedFrom = formatSamDate(options.since);
    const postedTo = formatSamDate(options.until ?? new Date());
    const cap = options.limit ?? Number.POSITIVE_INFINITY;

    let offset = 0;
    let yielded = 0;

    while (yielded < cap) {
      const { opportunitiesData, totalRecords } = await this.page({
        postedFrom,
        postedTo,
        offset,
        limit: Math.min(PAGE_SIZE, cap - yielded),
      });

      if (opportunitiesData.length === 0) break;

      for (const op of opportunitiesData) {
        yield this.normalize(op);
        yielded++;
        if (yielded >= cap) return;
      }

      offset += opportunitiesData.length;
      if (offset >= totalRecords) break;

      // Polite pause between pages
      await sleep(200);
    }
  }

  private async page(params: {
    postedFrom: string;
    postedTo: string;
    offset: number;
    limit: number;
  }): Promise<SamGovSearchResponse> {
    const url = new URL(BASE_URL);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("postedFrom", params.postedFrom);
    url.searchParams.set("postedTo", params.postedTo);
    url.searchParams.set("limit", String(params.limit));
    url.searchParams.set("offset", String(params.offset));
    url.searchParams.set("ptype", NOTICE_TYPES);

    return pRetry(
      async () => {
        const res = await fetch(url.toString(), {
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`SAM.gov ${res.status}: ${body.slice(0, 200)}`);
        }
        return (await res.json()) as SamGovSearchResponse;
      },
      { retries: 3, minTimeout: 2000, factor: 2 },
    );
  }

  private async normalize(op: SamGovOpportunity): Promise<NormalizedRfp> {
    let description: string | null = null;
    if (this.fetchDescriptions && op.description) {
      description = await this.fetchDescriptionSoft(op.description);
    }

    const state =
      op.placeOfPerformance?.state?.code ??
      op.officeAddress?.state ??
      null;

    const awardAmount = op.award?.amount ? Number(op.award.amount) : null;
    const estimatedValueCents =
      awardAmount && Number.isFinite(awardAmount)
        ? Math.round(awardAmount * 100)
        : null;

    return {
      externalId: op.noticeId,
      title: op.title,
      description,
      url: op.uiLink ?? `https://sam.gov/opp/${op.noticeId}/view`,
      agencyName: op.fullParentPathName
        ? prettifyAgencyPath(op.fullParentPathName)
        : null,
      state,
      postedAt: op.postedDate ? new Date(op.postedDate) : null,
      dueAt: op.responseDeadLine ? new Date(op.responseDeadLine) : null,
      estimatedValueCents,
      rawPayload: op,
    };
  }

  private async fetchDescriptionSoft(descUrl: string): Promise<string | null> {
    try {
      // SAM.gov description URLs redirect to plain text or HTML.
      const res = await fetch(descUrl, {
        headers: {
          accept: "text/html, text/plain",
          "user-agent": "rfp-aggregator/0.1",
        },
        // Individual description fetches shouldn't block the pipeline if slow
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const text = await res.text();
      return stripHtml(text).slice(0, 20_000);
    } catch (err) {
      // Descriptions are nice-to-have; never let them kill ingestion
      return null;
    }
  }
}

// ----- helpers -----

function formatSamDate(d: Date): string {
  // SAM.gov wants MM/dd/yyyy
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function prettifyAgencyPath(path: string): string {
  // "DEPT OF HOMELAND SECURITY.FEMA" → "Dept of Homeland Security / FEMA"
  return path
    .split(".")
    .map((part) =>
      part
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bOf\b/g, "of")
        .replace(/\bThe\b/g, "the")
        .replace(/\bAnd\b/g, "and")
        .replace(/\bFor\b/g, "for"),
    )
    .join(" / ");
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
