import pRetry from "p-retry";

import type {
  AwardAdapter,
  NormalizedAward,
  AwardFetchOptions,
} from "./award-base";

/**
 * USAspending.gov adapter — historical federal awards.
 *
 * API: POST https://api.usaspending.gov/api/v2/search/spending_by_award/
 * Docs: https://api.usaspending.gov/docs/endpoints
 *
 * No auth required.
 *
 * Award type codes:
 *   Contracts:     A, B, C, D
 *   IDVs:          IDV_A, IDV_B, IDV_B_A, IDV_B_B, IDV_B_C, IDV_C, IDV_D, IDV_E
 *   Grants:        02, 03, 04, 05
 *   Direct Pmts:   06, 10
 *   Loans:         07, 08
 *   Other:         09, 11
 *
 * For competitor intelligence we want contracts + grants primarily.
 * Loans and direct payments are less useful as RFP comparables.
 */

const ENDPOINT = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const PAGE_SIZE = 100;
const DETAIL_URL_PREFIX = "https://www.usaspending.gov/award/";

export const AWARD_TYPES = {
  CONTRACTS: ["A", "B", "C", "D"],
  IDVS: ["IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
  GRANTS: ["02", "03", "04", "05"],
  DIRECT_PAYMENTS: ["06", "10"],
  LOANS: ["07", "08"],
  OTHER: ["09", "11"],
} as const;

// Fields to request for contracts
const CONTRACT_FIELDS = [
  "Award ID",
  "Recipient Name",
  "Recipient UEI",
  "Start Date",
  "End Date",
  "Award Amount",
  "Description",
  "Contract Award Type",
  "Awarding Agency",
  "Awarding Sub Agency",
  "Place of Performance State Code",
  "NAICS",
  "PSC",
  "recipient_id",
  "generated_internal_id",
  "Last Modified Date",
];

// Fields to request for grants
const GRANT_FIELDS = [
  "Award ID",
  "Recipient Name",
  "Recipient UEI",
  "Start Date",
  "End Date",
  "Award Amount",
  "Description",
  "Award Type",
  "Awarding Agency",
  "Awarding Sub Agency",
  "Place of Performance State Code",
  "CFDA Number",
  "recipient_id",
  "generated_internal_id",
  "Last Modified Date",
];

interface SpendingByAwardResponse {
  limit: number;
  results: Array<Record<string, unknown>>;
  page_metadata: {
    page: number;
    hasNext: boolean;
    last_record_unique_id?: unknown;
  };
  messages?: string[];
}

export interface UsaSpendingAdapterOptions {
  /** Which award type groups to pull. Default: contracts + grants. */
  awardTypeGroups?: Array<keyof typeof AWARD_TYPES>;
  /** Filter to specific keywords (useful for vertical-scoped imports) */
  keywords?: string[];
  /** Filter to specific NAICS code prefixes */
  naicsPrefixes?: string[];
}

export class UsaSpendingAdapter implements AwardAdapter {
  readonly key = "usaspending_gov";
  readonly name = "USAspending.gov Federal Awards";

  constructor(private readonly options: UsaSpendingAdapterOptions = {}) {}

  async *fetch(
    fetchOptions: AwardFetchOptions,
  ): AsyncIterable<NormalizedAward> {
    const groups = this.options.awardTypeGroups ?? ["CONTRACTS", "GRANTS"];
    const cap = fetchOptions.limit ?? Number.POSITIVE_INFINITY;
    let yielded = 0;

    for (const group of groups) {
      if (yielded >= cap) return;

      const typeCodes = AWARD_TYPES[group];
      const fields = group === "GRANTS" ? GRANT_FIELDS : CONTRACT_FIELDS;

      for await (const record of this.paginate({
        typeCodes: [...typeCodes],
        fields,
        since: fetchOptions.since,
        until: fetchOptions.until ?? new Date(),
        minValueCents: fetchOptions.minValueCents,
      })) {
        yield this.normalize(record, group);
        yielded++;
        if (yielded >= cap) return;
      }
    }
  }

  private async *paginate(params: {
    typeCodes: string[];
    fields: string[];
    since: Date;
    until: Date;
    minValueCents?: number;
  }): AsyncIterable<Record<string, unknown>> {
    let page = 1;

    while (true) {
      const body = this.buildRequest({ ...params, page });
      const response = await this.post(body);

      if (!response.results || response.results.length === 0) break;

      for (const r of response.results) yield r;

      if (!response.page_metadata?.hasNext) break;
      page++;
      await sleep(250); // polite throttle
    }
  }

  private buildRequest(params: {
    typeCodes: string[];
    fields: string[];
    since: Date;
    until: Date;
    page: number;
    minValueCents?: number;
  }) {
    const filters: Record<string, unknown> = {
      award_type_codes: params.typeCodes,
      time_period: [
        {
          start_date: toYmd(params.since),
          end_date: toYmd(params.until),
          date_type: "action_date",
        },
      ],
    };

    if (this.options.keywords && this.options.keywords.length > 0) {
      filters.keywords = this.options.keywords;
    }

    if (params.minValueCents && params.minValueCents > 0) {
      filters.award_amounts = [
        { lower_bound: Math.floor(params.minValueCents / 100) },
      ];
    }

    if (this.options.naicsPrefixes && this.options.naicsPrefixes.length > 0) {
      filters.naics_codes = { require: this.options.naicsPrefixes };
    }

    return {
      filters,
      fields: params.fields,
      page: params.page,
      limit: PAGE_SIZE,
      sort: "Award Amount",
      order: "desc",
    };
  }

  private async post(body: unknown): Promise<SpendingByAwardResponse> {
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
          throw new Error(`USAspending ${res.status}: ${text.slice(0, 200)}`);
        }
        return (await res.json()) as SpendingByAwardResponse;
      },
      { retries: 3, minTimeout: 2000, factor: 2 },
    );
  }

  private normalize(
    r: Record<string, unknown>,
    group: keyof typeof AWARD_TYPES,
  ): NormalizedAward {
    const asString = (k: string): string | null => {
      const v = r[k];
      if (v == null) return null;
      return typeof v === "string" ? v : String(v);
    };
    const asNumber = (k: string): number | null => {
      const v = r[k];
      if (v == null) return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const asDate = (k: string): Date | null => {
      const s = asString(k);
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const amount = asNumber("Award Amount");

    // Extract NAICS (can be a string "541611 -- Description" or an object)
    let naicsCode: string | null = null;
    const rawNaics = r["NAICS"];
    if (typeof rawNaics === "string") {
      const m = /^(\d+)/.exec(rawNaics);
      naicsCode = m ? m[1] : null;
    } else if (rawNaics && typeof rawNaics === "object") {
      const obj = rawNaics as Record<string, unknown>;
      naicsCode = (obj.code as string) ?? null;
    }

    // PSC similarly
    let pscCode: string | null = null;
    const rawPsc = r["PSC"];
    if (typeof rawPsc === "string") {
      const m = /^(\w+)/.exec(rawPsc);
      pscCode = m ? m[1] : null;
    }

    const awardType = mapAwardType(group);
    const externalId = asString("generated_internal_id") ?? asString("Award ID") ?? "";

    return {
      externalId,
      awardType,
      title: asString("Description"),
      description: asString("Description"),
      piidOrFain: asString("Award ID"),
      url: `${DETAIL_URL_PREFIX}${encodeURIComponent(externalId)}`,
      recipientName: asString("Recipient Name"),
      recipientUei: asString("Recipient UEI"),
      recipientState: null, // not in default field set; place-of-performance below
      awardingAgency: asString("Awarding Agency"),
      awardingSubAgency: asString("Awarding Sub Agency"),
      actionDate: asDate("Last Modified Date") ?? asDate("Start Date"),
      startDate: asDate("Start Date"),
      endDate: asDate("End Date"),
      totalObligatedCents: amount ? Math.round(amount * 100) : null,
      baseAndAllOptionsCents: null,
      naicsCode,
      pscCode,
      placeOfPerformanceState: asString("Place of Performance State Code"),
      rawPayload: r,
    };
  }
}

// ----- helpers -----

function mapAwardType(
  group: keyof typeof AWARD_TYPES,
): NormalizedAward["awardType"] {
  switch (group) {
    case "CONTRACTS":
      return "contract";
    case "IDVS":
      return "idv";
    case "GRANTS":
      return "grant";
    case "DIRECT_PAYMENTS":
      return "direct_payment";
    case "LOANS":
      return "loan";
    case "OTHER":
      return "other";
  }
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
