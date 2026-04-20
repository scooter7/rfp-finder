import pRetry from "p-retry";

import type {
  IngestionAdapter,
  NormalizedRfp,
  FetchOptions,
  SourceType,
} from "./base";

/**
 * Generic RSS 2.0 / Atom feed adapter. One instance per feed URL.
 *
 * Most state procurement portals with "subscribe for updates" also expose
 * RSS. Items are usually sparse (title + link + summary + pubDate), which
 * is fine — the classifier + embedder fill in the rest from the text.
 */
export class RssFeedAdapter implements IngestionAdapter {
  readonly key: string;
  readonly name: string;
  readonly sourceType: SourceType;
  readonly state?: string;

  constructor(
    private readonly config: {
      key: string;
      name: string;
      feedUrl: string;
      state?: string;
      sourceType?: SourceType;
      /** Static agency label when the feed doesn't provide per-item agency */
      defaultAgency?: string;
    },
  ) {
    this.key = config.key;
    this.name = config.name;
    this.sourceType = config.sourceType ?? "state";
    this.state = config.state;
  }

  async *fetch(options: FetchOptions): AsyncIterable<NormalizedRfp> {
    const xml = await pRetry(
      async () => {
        const res = await fetch(this.config.feedUrl, {
          headers: {
            accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
            "user-agent": "rfp-aggregator/0.1 (+https://github.com/scooter7/rfp-finder)",
          },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          throw new Error(`${this.config.feedUrl} → ${res.status}`);
        }
        return await res.text();
      },
      { retries: 2, minTimeout: 1500 },
    );

    const items = parseFeed(xml);
    const cap = options.limit ?? Number.POSITIVE_INFINITY;
    let yielded = 0;

    for (const item of items) {
      if (yielded >= cap) return;
      const postedAt = item.pubDate ?? null;
      // Filter by since — items without a date pass through (some feeds omit it)
      if (postedAt && postedAt < options.since) continue;

      const externalId =
        item.guid ??
        item.link ??
        `${this.config.key}:${hash(`${item.title}|${item.pubDate?.toISOString() ?? ""}`)}`;

      yield {
        externalId,
        title: item.title.slice(0, 500),
        description: item.description ?? null,
        url: item.link ?? this.config.feedUrl,
        agencyName: this.config.defaultAgency ?? null,
        state: this.config.state ?? null,
        postedAt,
        dueAt: null, // RSS almost never exposes this; classifier will tag
        estimatedValueCents: null,
        rawPayload: item,
      };
      yielded++;
    }
  }
}

// ----- minimal RSS 2.0 / Atom parser -----

interface FeedItem {
  title: string;
  link: string | null;
  description: string | null;
  pubDate: Date | null;
  guid: string | null;
}

function parseFeed(xml: string): FeedItem[] {
  // Atom feeds use <entry>, RSS 2.0 uses <item>
  const isAtom = /<feed\b[^>]*xmlns=["'][^"']*atom/i.test(xml);
  const blockRe = isAtom
    ? /<entry\b[\s\S]*?<\/entry>/gi
    : /<item\b[\s\S]*?<\/item>/gi;

  const items: FeedItem[] = [];
  for (const block of xml.match(blockRe) ?? []) {
    const title = stripCdata(extractTag(block, "title"));
    if (!title) continue;

    let link: string | null = null;
    if (isAtom) {
      // Atom: <link href="..."/> (prefer rel="alternate" or unspecified)
      const linkMatch =
        block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ??
        block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
      link = linkMatch?.[1] ?? null;
    } else {
      link = stripCdata(extractTag(block, "link")) || null;
    }

    const description =
      stripCdata(
        extractTag(block, "description") ||
          extractTag(block, "summary") ||
          extractTag(block, "content") ||
          "",
      ) || null;

    const rawDate =
      extractTag(block, "pubDate") ||
      extractTag(block, "published") ||
      extractTag(block, "updated") ||
      extractTag(block, "dc:date") ||
      "";
    const parsed = rawDate ? new Date(rawDate.trim()) : null;
    const pubDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

    const guid = stripCdata(extractTag(block, "guid") || extractTag(block, "id")) || null;

    items.push({ title, link, description, pubDate, guid });
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  // Matches <tag>...</tag> and <tag attr="x">...</tag>. Last-match wins.
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() ?? "";
}

function stripCdata(s: string): string {
  if (!s) return "";
  const cdata = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (cdata ? cdata[1] : s)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(s: string): string {
  // Tiny non-crypto hash for stable externalId when the feed omits guid
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
