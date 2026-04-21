import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import pRetry from "p-retry";

import type {
  IngestionAdapter,
  NormalizedRfp,
  FetchOptions,
  SourceType,
} from "./base";

/**
 * HtmlPortalAdapter — a generic, config-driven adapter for institutional and
 * state portals that publish RFPs as plain HTML.
 *
 * How it works:
 *   1. Fetch the listing URL (respecting robots.txt — see scripts/robots-audit.ts)
 *   2. Pass the page to Claude Haiku with a structured-output schema
 *   3. Haiku extracts an array of opportunity records
 *   4. For each record with a detailUrl, optionally fetch + extract full text
 *   5. Yield normalized records
 *
 * Why LLM extraction instead of CSS selectors:
 *   Portals redesign every few years. Selector-based scrapers break often and
 *   silently. LLM extraction adapts to layout changes automatically — a few
 *   thousand tokens of Haiku per portal per run is cheaper than a dev fixing
 *   broken selectors quarterly.
 *
 * When to use Firecrawl instead:
 *   Client-side SPAs (content rendered by JS). This adapter uses plain fetch,
 *   so it only works for server-rendered pages. For SPAs, swap the fetch call
 *   below for a Firecrawl.scrape() call with the same downstream logic.
 */

const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";

const extractedOpportunitySchema = z.object({
  title: z
    .string()
    .min(3)
    .describe("The title of the RFP/solicitation"),
  detailUrl: z
    .string()
    .optional()
    .describe(
      "The href to the detail page for this opportunity (may be relative — will be resolved). Omit if the listing row has no detail link.",
    ),
  externalId: z
    .string()
    .optional()
    .describe(
      "The portal's own ID for this RFP if visible (bid number, solicitation #, etc.)",
    ),
  postedAt: z
    .string()
    .optional()
    .describe("Posted date in ISO format or any parseable date string"),
  dueAt: z
    .string()
    .optional()
    .describe("Response deadline in ISO format or any parseable date string"),
  briefDescription: z
    .string()
    .optional()
    .describe("A short summary if visible on the listing page"),
});

const extractionSchema = z.object({
  opportunities: z
    .array(extractedOpportunitySchema)
    .describe("All RFP/bid opportunities visible on the page"),
  nextPageUrl: z
    .string()
    .optional()
    .describe("URL of the next page of results if pagination is visible"),
});

export interface HtmlPortalConfig {
  /** Stable adapter key — matches sources.adapter_key */
  key: string;
  name: string;
  sourceType: SourceType;
  /** 2-char state code for filtering (institutions in a state) */
  state?: string;
  /** Default agency_name for normalized records (e.g., "University of Oregon") */
  defaultAgencyName: string;
  /** The URL of the public RFP listing page */
  listingUrl: string;
  /**
   * Optional additional context for the extractor — portal quirks, how to
   * recognize a real opportunity vs navigation, date format hints, etc.
   */
  extractionHints?: string;
  /** Maximum listing pages to follow (protects against pagination loops) */
  maxPages?: number;
  /**
   * Route the request through Jina Reader (https://r.jina.ai) so JS-rendered
   * SPAs serve their post-hydration content. Free tier; rate-limited but fine
   * at 6h cron cadence.
   */
  requiresJs?: boolean;
}

export class HtmlPortalAdapter implements IngestionAdapter {
  readonly key: string;
  readonly name: string;
  readonly sourceType: SourceType;
  readonly state?: string;

  constructor(private readonly config: HtmlPortalConfig) {
    this.key = config.key;
    this.name = config.name;
    this.sourceType = config.sourceType;
    this.state = config.state;
  }

  async *fetch(options: FetchOptions): AsyncIterable<NormalizedRfp> {
    const cap = options.limit ?? Number.POSITIVE_INFINITY;
    let yielded = 0;
    let url: string | null = this.config.listingUrl;
    let page = 0;
    const maxPages = this.config.maxPages ?? 5;

    while (url && yielded < cap && page < maxPages) {
      const extracted = await this.extractFromUrl(url);
      page++;

      for (const op of extracted.opportunities) {
        if (yielded >= cap) return;

        const postedAt = op.postedAt ? safeDate(op.postedAt) : null;
        // since-filter
        if (options.since && postedAt && postedAt < options.since) continue;

        yield {
          externalId: op.externalId || op.detailUrl || op.title,
          title: op.title,
          description: op.briefDescription ?? null,
          url: op.detailUrl
            ? resolveUrl(this.config.listingUrl, op.detailUrl)
            : this.config.listingUrl,
          agencyName: this.config.defaultAgencyName,
          state: this.config.state ?? null,
          postedAt,
          dueAt: op.dueAt ? safeDate(op.dueAt) : null,
          estimatedValueCents: null,
          rawPayload: op,
        };
        yielded++;
      }

      url = extracted.nextPageUrl
        ? resolveUrl(this.config.listingUrl, extracted.nextPageUrl)
        : null;
    }
  }

  private async extractFromUrl(
    url: string,
  ): Promise<z.infer<typeof extractionSchema>> {
    // JS-rendered portals: proxy through Jina Reader to get the hydrated
    // page as Markdown. Direct fetch otherwise.
    const fetchUrl = this.config.requiresJs
      ? `https://r.jina.ai/${url}`
      : url;
    const acceptHeader = this.config.requiresJs ? "text/plain" : "text/html";

    const body = await pRetry(
      async () => {
        const res = await fetch(fetchUrl, {
          headers: {
            accept: acceptHeader,
            "user-agent": "rfp-aggregator/0.1 (respecting robots.txt)",
          },
          signal: AbortSignal.timeout(45_000), // Jina is slower than direct
        });
        if (!res.ok) {
          throw new Error(`${this.config.key} ${res.status} at ${fetchUrl}`);
        }
        return res.text();
      },
      { retries: 2, minTimeout: 1000, factor: 2 },
    );

    // For Jina Reader output we already have Markdown — no HTML to strip.
    // For direct fetch, strip scripts/styles to reduce tokens.
    const cleaned = this.config.requiresJs
      ? body.slice(0, 80_000)
      : simplifyHtml(body).slice(0, 80_000);

    const system = `You extract RFP/bid opportunities from public procurement portal HTML.

Return every real opportunity visible on the page. Ignore navigation, headers, footers, and non-opportunity links. If no opportunities are visible, return an empty array.

${this.config.extractionHints ? `Portal-specific notes:\n${this.config.extractionHints}` : ""}`;
    const prompt = `URL: ${url}\n\nHTML:\n${cleaned}`;

    try {
      const { object } = await generateObject({
        model: anthropic(EXTRACTION_MODEL),
        schema: extractionSchema,
        system,
        prompt,
        temperature: 0,
        maxTokens: 4000,
      });
      return object;
    } catch (err) {
      // Fall back to free-form JSON when the strict schema rejects the
      // LLM output (common on portals where some rows lack one field or
      // another). We re-validate with a partial schema.
      console.warn(
        `[html-portal/${this.config.key}] strict extraction failed, retrying with lenient parse:`,
        err instanceof Error ? err.message : err,
      );
      return await this.extractLenient(url, cleaned, system);
    }
  }

  private async extractLenient(
    _url: string,
    cleaned: string,
    system: string,
  ): Promise<z.infer<typeof extractionSchema>> {
    const { text } = await generateText({
      model: anthropic(EXTRACTION_MODEL),
      system:
        system +
        "\n\nReturn ONLY valid JSON with shape: {\"opportunities\":[{\"title\":\"\",\"detailUrl\":\"\",\"externalId\":\"\",\"postedAt\":\"\",\"dueAt\":\"\",\"briefDescription\":\"\"}],\"nextPageUrl\":\"\"}. Omit fields that aren't visible. No prose.",
      prompt: cleaned,
      temperature: 0,
      maxTokens: 4000,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { opportunities: [] };

    try {
      const raw = JSON.parse(jsonMatch[0]) as {
        opportunities?: Array<Record<string, unknown>>;
        nextPageUrl?: string;
      };
      const opportunities = (raw.opportunities ?? [])
        .map((op): z.infer<typeof extractedOpportunitySchema> | null => {
          const title = typeof op.title === "string" ? op.title.trim() : "";
          if (title.length < 3) return null;
          return {
            title,
            detailUrl:
              typeof op.detailUrl === "string" && op.detailUrl ? op.detailUrl : undefined,
            externalId:
              typeof op.externalId === "string" && op.externalId ? op.externalId : undefined,
            postedAt:
              typeof op.postedAt === "string" && op.postedAt ? op.postedAt : undefined,
            dueAt: typeof op.dueAt === "string" && op.dueAt ? op.dueAt : undefined,
            briefDescription:
              typeof op.briefDescription === "string" && op.briefDescription
                ? op.briefDescription
                : undefined,
          };
        })
        .filter((op): op is z.infer<typeof extractedOpportunitySchema> => op !== null);
      return {
        opportunities,
        nextPageUrl: typeof raw.nextPageUrl === "string" ? raw.nextPageUrl : undefined,
      };
    } catch {
      return { opportunities: [] };
    }
  }
}

// ----- helpers -----

function simplifyHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(base: string, ref: string): string {
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
