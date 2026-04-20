/**
 * Adapter contract for historical AWARD sources (USAspending.gov, etc.).
 * Parallel to IngestionAdapter but produces NormalizedAward.
 *
 * Awards are a different entity from RFPs:
 *   - RFP = future-looking opportunity (Do work X, deadline Y)
 *   - Award = historical result (Vendor Z won work X on date Y for $Z)
 *
 * We keep the interfaces parallel rather than merging into a generic
 * <T>-parameterized adapter because:
 *   1. Award-specific fields (recipient, NAICS, obligated amount) differ
 *      meaningfully from RFP fields.
 *   2. The ingestion pipeline does different things with each (no LLM
 *      classification for awards — their metadata is already structured).
 *   3. Keeping them separate makes the type system more honest.
 */

export interface NormalizedAward {
  /** USAspending's generated_internal_id — permanent, unique */
  externalId: string;
  awardType: "contract" | "grant" | "loan" | "direct_payment" | "idv" | "other";
  title?: string | null;
  description?: string | null;
  /** Contract PIID or grant FAIN. Useful for matching back to the original RFP */
  piidOrFain?: string | null;
  url: string;
  recipientName?: string | null;
  recipientUei?: string | null;
  recipientState?: string | null;
  awardingAgency?: string | null;
  awardingSubAgency?: string | null;
  actionDate?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  totalObligatedCents?: number | null;
  baseAndAllOptionsCents?: number | null;
  naicsCode?: string | null;
  pscCode?: string | null;
  placeOfPerformanceState?: string | null;
  rawPayload: unknown;
}

export interface AwardFetchOptions {
  /** Earliest action_date to fetch */
  since: Date;
  until?: Date;
  limit?: number;
  /** Minimum award amount in cents — filter out rounding-error-sized awards */
  minValueCents?: number;
}

export interface AwardAdapter {
  readonly key: string;
  readonly name: string;
  fetch(options: AwardFetchOptions): AsyncIterable<NormalizedAward>;
}
