/**
 * 50-state + DC procurement-portal survey.
 *
 * Source of truth for the RFP-data-availability map. Powers:
 *   - docs/state-portal-survey.md (human-readable, generated)
 *   - scripts/robots-audit.ts --all-states (re-run probe)
 *
 * Re-survey procedure:
 *   1. Update entries here as portals move / policies change.
 *   2. `npm run survey:render` regenerates the Markdown.
 *   3. `tsx scripts/robots-audit.ts --all-states` re-validates robots.txt.
 *
 * Tiers drive the ingestion roadmap:
 *   1 = Easy (public API or verified RSS → existing adapter, minimal work)
 *   2 = Scrape (robots-permitted, server-rendered HTML → HtmlPortalAdapter)
 *   3 = Hard (SPA / auth-gated / bot-protected → Playwright worker or signup+parse)
 *   4 = Commercial-only (ToS blocks, unreachable, or no public path)
 *
 * Data collected via a combined robots.txt + homepage-fingerprint probe
 * (scripts/probe-state-portals.sh) on 2026-04-20. Fingerprints matched
 * against a curated list of govtech platforms (Bonfire, Periscope/OpenGov,
 * Ionwave, BidNet, Jaggaer, PeopleSoft, Public Purchase, DemandStar).
 */

export type Mechanism =
  | "api"
  | "rss"
  | "email"
  | "html_permitted"
  | "html_spa"
  | "auth_gated"
  | "commercial_only"
  | "unknown";

export type SuggestedAdapter =
  | "existing-api" // e.g. wraps into SamGovAdapter-like custom class
  | "RssFeedAdapter"
  | "HtmlPortalAdapter"
  | "playwright" // future — not yet implemented
  | "email-parser" // future — inbound-email + LLM extraction
  | "commercial"
  | "none";

export interface StatePortal {
  state: string; // 2-char postal code
  stateName: string;
  portalUrl: string;
  /** Detected govtech platform, if any */
  platform: string | null;
  /** robots.txt verdict for path "/" under user-agent "*" */
  robots: "permitted" | "disallowed" | "unknown" | "error";
  /** HTTP status observed on homepage fetch (000 = network/TLS failure) */
  httpStatus: number;
  rssUrl: string | null;
  apiUrl: string | null;
  emailSignupUrl: string | null;
  mechanism: Mechanism;
  suggestedAdapter: SuggestedAdapter;
  tier: 1 | 2 | 3 | 4;
  notes: string;
}

export const STATE_PORTALS: StatePortal[] = [
  {
    state: "AL", stateName: "Alabama",
    portalUrl: "https://vss.alabama.gov/webapp/PRDVSS1X1/AltSelfService",
    platform: "CGI Advantage VSS", robots: "unknown", httpStatus: 0,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "CGI Advantage Vendor Self Service — unreachable from standard HTTP clients; WAF/geo-blocked.",
  },
  {
    state: "AK", stateName: "Alaska",
    portalUrl: "https://aws.state.ak.us/OnlinePublicNotices/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "Online Public Notices system. Server-rendered; scrapable with HtmlPortalAdapter.",
  },
  {
    state: "AZ", stateName: "Arizona",
    portalUrl: "https://app.az.gov/",
    platform: null, robots: "permitted", httpStatus: 403,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "APP (Arizona Procurement Portal) — Jaggaer/ProcureAZ. SPA with bot-protection (403 on curl).",
  },
  {
    state: "AR", stateName: "Arkansas",
    portalUrl: "https://www.ark.org/dfa/procurement/",
    platform: null, robots: "permitted", httpStatus: 404,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "unknown", suggestedAdapter: "none", tier: 4,
    notes: "Arkansas OSP — URL structure shifted; vendor alerts are email-based via ark.org subscription.",
  },
  {
    state: "CA", stateName: "California",
    portalUrl: "https://caleprocure.ca.gov/",
    platform: null, robots: "permitted", httpStatus: 403,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx",
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "Cal eProcure — client-side SPA, bot-protected. Needs Playwright; ToS explicitly prohibits automated scraping of event details.",
  },
  {
    state: "CO", stateName: "Colorado",
    portalUrl: "https://supplier.colorado.gov/",
    platform: "CGI Advantage VSS", robots: "unknown", httpStatus: 0,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "CGI Advantage VSS — unreachable from public internet without registration.",
  },
  {
    state: "CT", stateName: "Connecticut",
    portalUrl: "https://www.biznet.ct.gov/SCP_Search/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://portal.ct.gov/DAS/Procurement/State-Contracting-Portal",
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "State Contracting Portal. Simple search form; results paginate cleanly. Good scrape candidate.",
  },
  {
    state: "DE", stateName: "Delaware",
    portalUrl: "https://mymarketplace.delaware.gov/",
    platform: "Ionwave", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "auth_gated", suggestedAdapter: "email-parser", tier: 3,
    notes: "MyMarketplace (Ionwave). Public bid list partially visible; full details require vendor account. Email alerts on signup.",
  },
  {
    state: "DC", stateName: "District of Columbia",
    portalUrl: "https://ocp.dc.gov/",
    platform: null, robots: "disallowed", httpStatus: 200,
    rssUrl: "https://ocp.dc.gov/rss.xml", apiUrl: null, emailSignupUrl: null,
    mechanism: "rss", suggestedAdapter: "RssFeedAdapter", tier: 1,
    notes: "Office of Contracting & Procurement. RSS is site-wide (not just RFPs) — filter by category after ingest.",
  },
  {
    state: "FL", stateName: "Florida",
    portalUrl: "https://vbs.dms.state.fl.us/",
    platform: null, robots: "unknown", httpStatus: 0,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://www.myfloridamarketplace.com/vendor-registration",
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "Vendor Bid System — unreachable from external HTTP; MyFloridaMarketplace requires vendor registration.",
  },
  {
    state: "GA", stateName: "Georgia",
    portalUrl: "https://ssl.doas.state.ga.us/PRSapp/PR_index.jsp",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://doas.ga.gov/state-purchasing/state-purchasing-updates",
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "Georgia Procurement Registry. Old-school JSP, server-rendered. Clean scrape target; tier-1 readability.",
  },
  {
    state: "HI", stateName: "Hawaii",
    portalUrl: "https://hiepro.ehawaii.gov/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "HIePRO — eHawaii platform. Public RFP list; registration only needed to bid. Scrape-friendly.",
  },
  {
    state: "ID", stateName: "Idaho",
    portalUrl: "https://luma.idaho.gov/",
    platform: null, robots: "unknown", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "Luma (Infor ERP). SPA; public bids accessible but require JS. Playwright needed.",
  },
  {
    state: "IL", stateName: "Illinois",
    portalUrl: "https://www.bidbuy.illinois.gov/",
    platform: "Ionwave", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "auth_gated", suggestedAdapter: "email-parser", tier: 3,
    notes: "BidBuy (Ionwave). Full solicitation detail behind free vendor signup; subscribe for email alerts then parse.",
  },
  {
    state: "IN", stateName: "Indiana",
    portalUrl: "https://www.in.gov/idoa/procurement/",
    platform: "PeopleSoft", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://www.in.gov/idoa/procurement/",
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "IDOA Procurement lists open solicitations on a static page; PeopleSoft Supplier Portal behind login for bidding.",
  },
  {
    state: "IA", stateName: "Iowa",
    portalUrl: "https://bidopportunities.iowa.gov/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "Bid Opportunities site — single-page listing of open bids, server-rendered. Ideal scrape target.",
  },
  {
    state: "KS", stateName: "Kansas",
    portalUrl: "https://admin.ks.gov/offices/procurement-and-contracts",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "Procurement & Contracts index page links to individual bid PDFs. Simple scrape.",
  },
  {
    state: "KY", stateName: "Kentucky",
    portalUrl: "https://finance.ky.gov/services/eprocurement/Pages/default.aspx",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "auth_gated", suggestedAdapter: "email-parser", tier: 3,
    notes: "eMARS / VSS requires vendor account for solicitation detail. Email alerts on registration.",
  },
  {
    state: "LA", stateName: "Louisiana",
    portalUrl: "https://wwwcfprd.doa.louisiana.gov/OSP/LaPAC/pubmain.cfm",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "LaPAC — public. ColdFusion app, server-rendered search and detail pages. Easy scrape.",
  },
  {
    state: "ME", stateName: "Maine",
    portalUrl: "https://www.maine.gov/dafs/bbm/procurementservices/vendors/rfps",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "BBM maintains a plain HTML RFP index with download links. Trivial to scrape.",
  },
  {
    state: "MD", stateName: "Maryland",
    portalUrl: "https://emma.maryland.gov/page.aspx/en/rfp/request_browse_public",
    platform: "Periscope/OpenGov", robots: "disallowed", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "eMMA — Periscope platform. robots.txt disallows crawling. Email subscription exists but ToS restrictive.",
  },
  {
    state: "MA", stateName: "Massachusetts",
    portalUrl: "https://www.commbuys.com/",
    platform: "Periscope/OpenGov", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "COMMBUYS (Periscope). Partially SPA; public search works but detail pages render client-side.",
  },
  {
    state: "MI", stateName: "Michigan",
    portalUrl: "https://www.michigan.gov/sigma",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "SIGMA Vendor portal; DTMB maintains a bid opportunities page linked off michigan.gov/sigma.",
  },
  {
    state: "MN", stateName: "Minnesota",
    portalUrl: "https://mn.gov/admin/osp/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://mn.gov/admin/osp/vendors/subscribe-vendor/",
    mechanism: "email", suggestedAdapter: "email-parser", tier: 3,
    notes: "OSP vendor page. Full supplier portal requires SWIFT account. Vendor email-subscription is the primary notification channel.",
  },
  {
    state: "MS", stateName: "Mississippi",
    portalUrl: "https://www.ms.gov/dfa/contract_bid_search/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "DFA Contract & Bid Search. Public form + search results; full MAGIC portal is auth-gated.",
  },
  {
    state: "MO", stateName: "Missouri",
    portalUrl: "https://missouribuys.mo.gov/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "MissouriBUYS. Public bid search; notifications require registered vendor account.",
  },
  {
    state: "MT", stateName: "Montana",
    portalUrl: "https://emacs.mt.gov/",
    platform: "Jaggaer", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "eMACS (Jaggaer / SciQuest). SPA; public solicitations exposed but list renders via JS.",
  },
  {
    state: "NE", stateName: "Nebraska",
    portalUrl: "https://das.nebraska.gov/materiel/bidopps.html",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "Materiel Division bidopps page — plain HTML list of open solicitations with PDF links. Easy scrape.",
  },
  {
    state: "NV", stateName: "Nevada",
    portalUrl: "https://nevadaepro.com/",
    platform: "Periscope/OpenGov", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "NevadaEPro (Periscope). Public search; JS-rendered. Playwright or Periscope-specific parser needed.",
  },
  {
    state: "NH", stateName: "New Hampshire",
    portalUrl: "https://www.das.nh.gov/purchasing/BidSummary.aspx",
    platform: null, robots: "permitted", httpStatus: 403,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "DAS Purchasing Bid Summary — ASP.NET page; blocks generic curl (403) but accessible with browser headers.",
  },
  {
    state: "NJ", stateName: "New Jersey",
    portalUrl: "https://www.njstart.gov/",
    platform: "Periscope/OpenGov", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "NJSTART (Periscope). SPA; public solicitations need JS to list.",
  },
  {
    state: "NM", stateName: "New Mexico",
    portalUrl: "https://www.generalservices.state.nm.us/state-purchasing/",
    platform: "Bonfire", robots: "permitted", httpStatus: 200,
    rssUrl: "https://generalservices.state.nm.us/feed/", apiUrl: null, emailSignupUrl: null,
    mechanism: "rss", suggestedAdapter: "RssFeedAdapter", tier: 1,
    notes: "State Purchasing. WordPress feed (not procurement-filtered) — usable but classify/filter on ingest. Bonfire used for bid detail.",
  },
  {
    state: "NY", stateName: "New York",
    portalUrl: "https://www.nyscr.ny.gov/",
    platform: null, robots: "unknown", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "auth_gated", suggestedAdapter: "email-parser", tier: 3,
    notes: "NY State Contract Reporter — free account required to view full solicitations. Email subscription is the practical ingestion path.",
  },
  {
    state: "NC", stateName: "North Carolina",
    portalUrl: "https://www.ips.state.nc.us/ips/",
    platform: null, robots: "unknown", httpStatus: 0,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://ncadmin.nc.gov/government/procurement",
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "Interactive Purchasing System — unreachable from public HTTP clients. DOA provides an email subscription for vendors.",
  },
  {
    state: "ND", stateName: "North Dakota",
    portalUrl: "https://www.omb.nd.gov/agency/procurement",
    platform: "PeopleSoft", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "OMB Procurement page links to current solicitations via PDFs. Scrape the index.",
  },
  {
    state: "OH", stateName: "Ohio",
    portalUrl: "https://procure.ohio.gov/",
    platform: "Ionwave", robots: "permitted", httpStatus: 404,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "auth_gated", suggestedAdapter: "email-parser", tier: 3,
    notes: "OhioBuys / procure.ohio.gov redirects to Ionwave tenant. Free vendor signup; email alerts are the cleanest feed.",
  },
  {
    state: "OK", stateName: "Oklahoma",
    portalUrl: "https://oklahoma.gov/omes/divisions/central-purchasing.html",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "OMES Central Purchasing — static index of open solicitations linked from a single page.",
  },
  {
    state: "OR", stateName: "Oregon",
    portalUrl: "https://oregonbuys.gov/",
    platform: "Periscope/OpenGov", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "OregonBuys (Periscope). SPA; public search works with JS. Same platform as NJ/MA/NV — single Periscope adapter would cover them all.",
  },
  {
    state: "PA", stateName: "Pennsylvania",
    portalUrl: "https://www.emarketplace.state.pa.us/",
    platform: null, robots: "disallowed", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "eMarketplace. robots.txt disallows crawling. Vendor registration + email notifications exist but ToS restrictive.",
  },
  {
    state: "RI", stateName: "Rhode Island",
    portalUrl: "https://ridop.ri.gov/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "Division of Purchases. Public index of open solicitations. Server-rendered; clean scrape.",
  },
  {
    state: "SC", stateName: "South Carolina",
    portalUrl: "https://procurement.sc.gov/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "Procurement Services. Public solicitation list. Scrape-friendly.",
  },
  {
    state: "SD", stateName: "South Dakota",
    portalUrl: "https://boa.sd.gov/vendor-info/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "BOA vendor-info page links to OpenBidding system. Front page is static HTML.",
  },
  {
    state: "TN", stateName: "Tennessee",
    portalUrl: "https://sso.edison.tn.gov/",
    platform: "PeopleSoft", robots: "unknown", httpStatus: 0,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://www.tn.gov/generalservices/procurement.html",
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "Edison Supplier Portal — login only; SSO gateway unreachable from external clients without session.",
  },
  {
    state: "TX", stateName: "Texas",
    portalUrl: "https://www.txsmartbuy.gov/esbd",
    platform: null, robots: "disallowed", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "SmartBuy ESBD. robots.txt explicitly disallows automated access. Email subscription available but ToS blocks scraping.",
  },
  {
    state: "UT", stateName: "Utah",
    portalUrl: "https://u3p.utah.gov/",
    platform: "BidSync", robots: "unknown", httpStatus: 0,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "U3P (BidSync by Periscope). Unreachable from external HTTP clients without TLS negotiation adjustments.",
  },
  {
    state: "VT", stateName: "Vermont",
    portalUrl: "https://bgs.vermont.gov/purchasing-contracting/bids",
    platform: null, robots: "permitted", httpStatus: 403,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "BGS purchasing-contracting/bids — blocks generic curl (403 Cloudfront) but accessible with browser headers.",
  },
  {
    state: "VA", stateName: "Virginia",
    portalUrl: "https://eva.virginia.gov/",
    platform: "Ivalua", robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_spa", suggestedAdapter: "playwright", tier: 3,
    notes: "eVA (Ivalua). Public opportunities list is SPA-rendered; accessible with Playwright. Broad vendor email subscription available.",
  },
  {
    state: "WA", stateName: "Washington",
    portalUrl: "https://pr-webs-vendor.des.wa.gov/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "auth_gated", suggestedAdapter: "email-parser", tier: 3,
    notes: "WEBS vendor portal — public search partial; detail pages require account. Email alerts on signup.",
  },
  {
    state: "WV", stateName: "West Virginia",
    portalUrl: "https://prdvss.wvoasis.gov/",
    platform: "CGI Advantage VSS", robots: "unknown", httpStatus: 0,
    rssUrl: null, apiUrl: null,
    emailSignupUrl: "https://state.wv.gov/admin/purchasing/",
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "wvOASIS VSS — CGI Advantage, unreachable without registration.",
  },
  {
    state: "WI", stateName: "Wisconsin",
    portalUrl: "https://vendornet.wi.gov/",
    platform: null, robots: "permitted", httpStatus: 200,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "html_permitted", suggestedAdapter: "HtmlPortalAdapter", tier: 2,
    notes: "VendorNet — public bid search (server-rendered). Classic stable target.",
  },
  {
    state: "WY", stateName: "Wyoming",
    portalUrl: "https://procurement.wyo.gov/",
    platform: null, robots: "unknown", httpStatus: 0,
    rssUrl: null, apiUrl: null, emailSignupUrl: null,
    mechanism: "commercial_only", suggestedAdapter: "commercial", tier: 4,
    notes: "Wyoming Procurement — URL unreachable from external client; behind WAF.",
  },
];

/** Aggregated counts by tier — useful for the doc header. */
export function tierCounts(): Record<1 | 2 | 3 | 4, number> {
  const counts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of STATE_PORTALS) counts[p.tier]++;
  return counts;
}
