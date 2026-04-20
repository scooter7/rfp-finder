import type { IngestionAdapter } from "./base";
import { SamGovAdapter } from "./sam-gov";
import { GrantsGovAdapter } from "./grants-gov";

/**
 * Registry of all ingestion adapters.
 * Add new state/institution adapters here.
 */
export function createAdapter(key: string): IngestionAdapter {
  switch (key) {
    case "sam_gov":
      return new SamGovAdapter();
    case "grants_gov":
      return new GrantsGovAdapter();
    // Phase 2B (state portals) — pending per-portal robots.txt + ToS review:
    // case "ca_state":
    //   return new CaliforniaStateAdapter();
    // case "tx_state":
    //   return new TexasSmartBuyAdapter();
    default:
      throw new Error(`Unknown adapter key: ${key}`);
  }
}

export type { IngestionAdapter, NormalizedRfp, FetchOptions } from "./base";
