/**
 * The ingestion adapter contract. Every source — SAM.gov, state portals,
 * institution purchasing pages — implements this interface.
 *
 * Design principles:
 *   1. Adapters are pure data-fetchers. They do NOT touch the database.
 *      The pipeline wires them up to classification, embedding, and persistence.
 *   2. Output is a normalized shape; source-specific fields go into rawPayload.
 *   3. fetch() returns an AsyncIterable so large sources can stream rather
 *      than buffering thousands of records in memory.
 *   4. Every adapter is a single file in `adapters/` and registered in
 *      the `adapters` barrel. Adding a state = one file + one line.
 */

export type SourceType = "federal" | "state" | "institution" | "aggregator";

export interface NormalizedRfp {
  /** Source-specific stable ID (never changes) */
  externalId: string;
  title: string;
  description?: string | null;
  /** Full RFP text when cheaply available; otherwise fetch lazily later */
  fullText?: string | null;
  url: string;
  agencyName?: string | null;
  /** Two-char state code (place of performance or issuing agency) */
  state?: string | null;
  postedAt?: Date | null;
  dueAt?: Date | null;
  estimatedValueCents?: number | null;
  /** Source-specific payload — store the full original record for debugging */
  rawPayload: unknown;
}

export interface FetchOptions {
  /** Only fetch opportunities posted since this date */
  since: Date;
  /** Optional upper bound; defaults to "now" */
  until?: Date;
  /** Optional cap, mainly for testing */
  limit?: number;
}

export interface IngestionAdapter {
  /** Stable identifier — matches `sources.adapter_key` */
  readonly key: string;
  readonly name: string;
  readonly sourceType: SourceType;
  /** 2-char state code, if state-scoped */
  readonly state?: string;
  /** Fetch RFPs, streaming normalized records */
  fetch(options: FetchOptions): AsyncIterable<NormalizedRfp>;
}
