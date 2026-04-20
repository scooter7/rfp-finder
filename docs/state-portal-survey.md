# State procurement-portal survey

_Generated from [`src/ingestion/state-portals.ts`](../src/ingestion/state-portals.ts) — do not edit by hand. Regenerate with `npm run survey:render`._

**51 jurisdictions** (50 states + DC). Tier distribution:

- **Tier 1 (easy):** 2 — public API or verified RSS; existing adapter works.
- **Tier 2 (scrape):** 21 — robots-permitted, server-rendered HTML; use `HtmlPortalAdapter`.
- **Tier 3 (hard):** 16 — SPA / auth-gated / bot-protected; Playwright worker or inbound-email parser.
- **Tier 4 (commercial):** 12 — ToS blocks, unreachable, or no public path; commercial feed (GovTribe / GovWin / BidPrime).

## Recommended roadmap

1. **Ship tier-1 first.** Low effort, immediate coverage. Register `sources` rows with `metadata.rss_url` and the existing `/api/cron/ingest-rss` picks them up.
2. **Batch tier-2 by platform.** Many states share a common govtech platform (Periscope, Ionwave, Bonfire, Jaggaer). Writing one parser per platform unlocks several states at once.
3. **Tier-3 deferred.** Needs Playwright on a long-running worker (Railway, Fly, dedicated VM) — won't fit Vercel's 300s cron timeout.
4. **Tier-4 → commercial decision.** If your customer base needs these states, license aggregated data rather than fight WAFs and ToS clauses.

## Methodology

- **robots.txt** probed with `user-agent: *`, verdict for path `/`. `✅` = permitted, `🚫` = disallowed, `?` = could not read robots.txt.
- **HTTP** is the status code returned by `curl -L` on the portal homepage. `000` means network/TLS failure; often indicates a WAF or enterprise-only cert.
- **Platform** detected by regex-matching vendor fingerprints (Bonfire, Periscope/OpenGov, Ionwave, BidNet, Jaggaer, PeopleSoft, etc.) against the homepage body.
- **Mechanism / adapter** is my recommendation after combining the probe result with domain knowledge of each platform.

Re-run the automated half with `tsx scripts/robots-audit.ts --all-states`.

## All states

### Tier 1 — Easy (API / RSS) — 2

| ST | State | Portal | Platform | robots | HTTP | Mechanism | Adapter | Notes |
|----|-------|--------|----------|:-:|:-:|-----------|---------|-------|
| DC | District of Columbia | [https://ocp.dc.gov/](https://ocp.dc.gov/) | — | 🚫 | 200 | rss | RssFeedAdapter | Office of Contracting & Procurement. RSS is site-wide (not just RFPs) — filter by category after ingest. |
| NM | New Mexico | [https://www.generalservices.state.nm.us/state-purchasing/](https://www.generalservices.state.nm.us/state-purchasing/) | Bonfire | ✅ | 200 | rss | RssFeedAdapter | State Purchasing. WordPress feed (not procurement-filtered) — usable but classify/filter on ingest. Bonfire used for bid detail. |

### Tier 2 — Scrape (HTML permitted) — 21

| ST | State | Portal | Platform | robots | HTTP | Mechanism | Adapter | Notes |
|----|-------|--------|----------|:-:|:-:|-----------|---------|-------|
| AK | Alaska | [https://aws.state.ak.us/OnlinePublicNotices/](https://aws.state.ak.us/OnlinePublicNotices/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | Online Public Notices system. Server-rendered; scrapable with HtmlPortalAdapter. |
| CT | Connecticut | [https://www.biznet.ct.gov/SCP_Search/](https://www.biznet.ct.gov/SCP_Search/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | State Contracting Portal. Simple search form; results paginate cleanly. Good scrape candidate. |
| GA | Georgia | [https://ssl.doas.state.ga.us/PRSapp/PR_index.jsp](https://ssl.doas.state.ga.us/PRSapp/PR_index.jsp) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | Georgia Procurement Registry. Old-school JSP, server-rendered. Clean scrape target; tier-1 readability. |
| HI | Hawaii | [https://hiepro.ehawaii.gov/](https://hiepro.ehawaii.gov/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | HIePRO — eHawaii platform. Public RFP list; registration only needed to bid. Scrape-friendly. |
| IA | Iowa | [https://bidopportunities.iowa.gov/](https://bidopportunities.iowa.gov/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | Bid Opportunities site — single-page listing of open bids, server-rendered. Ideal scrape target. |
| IN | Indiana | [https://www.in.gov/idoa/procurement/](https://www.in.gov/idoa/procurement/) | PeopleSoft | ✅ | 200 | html_permitted | HtmlPortalAdapter | IDOA Procurement lists open solicitations on a static page; PeopleSoft Supplier Portal behind login for bidding. |
| KS | Kansas | [https://admin.ks.gov/offices/procurement-and-contracts](https://admin.ks.gov/offices/procurement-and-contracts) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | Procurement & Contracts index page links to individual bid PDFs. Simple scrape. |
| LA | Louisiana | [https://wwwcfprd.doa.louisiana.gov/OSP/LaPAC/pubmain.cfm](https://wwwcfprd.doa.louisiana.gov/OSP/LaPAC/pubmain.cfm) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | LaPAC — public. ColdFusion app, server-rendered search and detail pages. Easy scrape. |
| ME | Maine | [https://www.maine.gov/dafs/bbm/procurementservices/vendor…](https://www.maine.gov/dafs/bbm/procurementservices/vendors/rfps) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | BBM maintains a plain HTML RFP index with download links. Trivial to scrape. |
| MI | Michigan | [https://www.michigan.gov/sigma](https://www.michigan.gov/sigma) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | SIGMA Vendor portal; DTMB maintains a bid opportunities page linked off michigan.gov/sigma. |
| MO | Missouri | [https://missouribuys.mo.gov/](https://missouribuys.mo.gov/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | MissouriBUYS. Public bid search; notifications require registered vendor account. |
| MS | Mississippi | [https://www.ms.gov/dfa/contract_bid_search/](https://www.ms.gov/dfa/contract_bid_search/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | DFA Contract & Bid Search. Public form + search results; full MAGIC portal is auth-gated. |
| ND | North Dakota | [https://www.omb.nd.gov/agency/procurement](https://www.omb.nd.gov/agency/procurement) | PeopleSoft | ✅ | 200 | html_permitted | HtmlPortalAdapter | OMB Procurement page links to current solicitations via PDFs. Scrape the index. |
| NE | Nebraska | [https://das.nebraska.gov/materiel/bidopps.html](https://das.nebraska.gov/materiel/bidopps.html) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | Materiel Division bidopps page — plain HTML list of open solicitations with PDF links. Easy scrape. |
| NH | New Hampshire | [https://www.das.nh.gov/purchasing/BidSummary.aspx](https://www.das.nh.gov/purchasing/BidSummary.aspx) | — | ✅ | 403 | html_permitted | HtmlPortalAdapter | DAS Purchasing Bid Summary — ASP.NET page; blocks generic curl (403) but accessible with browser headers. |
| OK | Oklahoma | [https://oklahoma.gov/omes/divisions/central-purchasing.html](https://oklahoma.gov/omes/divisions/central-purchasing.html) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | OMES Central Purchasing — static index of open solicitations linked from a single page. |
| RI | Rhode Island | [https://ridop.ri.gov/](https://ridop.ri.gov/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | Division of Purchases. Public index of open solicitations. Server-rendered; clean scrape. |
| SC | South Carolina | [https://procurement.sc.gov/](https://procurement.sc.gov/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | Procurement Services. Public solicitation list. Scrape-friendly. |
| SD | South Dakota | [https://boa.sd.gov/vendor-info/](https://boa.sd.gov/vendor-info/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | BOA vendor-info page links to OpenBidding system. Front page is static HTML. |
| VT | Vermont | [https://bgs.vermont.gov/purchasing-contracting/bids](https://bgs.vermont.gov/purchasing-contracting/bids) | — | ✅ | 403 | html_permitted | HtmlPortalAdapter | BGS purchasing-contracting/bids — blocks generic curl (403 Cloudfront) but accessible with browser headers. |
| WI | Wisconsin | [https://vendornet.wi.gov/](https://vendornet.wi.gov/) | — | ✅ | 200 | html_permitted | HtmlPortalAdapter | VendorNet — public bid search (server-rendered). Classic stable target. |

### Tier 3 — Hard (SPA / auth-gated) — 16

| ST | State | Portal | Platform | robots | HTTP | Mechanism | Adapter | Notes |
|----|-------|--------|----------|:-:|:-:|-----------|---------|-------|
| AZ | Arizona | [https://app.az.gov/](https://app.az.gov/) | — | ✅ | 403 | html_spa | playwright | APP (Arizona Procurement Portal) — Jaggaer/ProcureAZ. SPA with bot-protection (403 on curl). |
| CA | California | [https://caleprocure.ca.gov/](https://caleprocure.ca.gov/) | — | ✅ | 403 | html_spa | playwright | Cal eProcure — client-side SPA, bot-protected. Needs Playwright; ToS explicitly prohibits automated scraping of event details. |
| DE | Delaware | [https://mymarketplace.delaware.gov/](https://mymarketplace.delaware.gov/) | Ionwave | ✅ | 200 | auth_gated | email-parser | MyMarketplace (Ionwave). Public bid list partially visible; full details require vendor account. Email alerts on signup. |
| ID | Idaho | [https://luma.idaho.gov/](https://luma.idaho.gov/) | — | ? | 200 | html_spa | playwright | Luma (Infor ERP). SPA; public bids accessible but require JS. Playwright needed. |
| IL | Illinois | [https://www.bidbuy.illinois.gov/](https://www.bidbuy.illinois.gov/) | Ionwave | ✅ | 200 | auth_gated | email-parser | BidBuy (Ionwave). Full solicitation detail behind free vendor signup; subscribe for email alerts then parse. |
| KY | Kentucky | [https://finance.ky.gov/services/eprocurement/Pages/defaul…](https://finance.ky.gov/services/eprocurement/Pages/default.aspx) | — | ✅ | 200 | auth_gated | email-parser | eMARS / VSS requires vendor account for solicitation detail. Email alerts on registration. |
| MA | Massachusetts | [https://www.commbuys.com/](https://www.commbuys.com/) | Periscope/OpenGov | ✅ | 200 | html_spa | playwright | COMMBUYS (Periscope). Partially SPA; public search works but detail pages render client-side. |
| MN | Minnesota | [https://mn.gov/admin/osp/](https://mn.gov/admin/osp/) | — | ✅ | 200 | email | email-parser | OSP vendor page. Full supplier portal requires SWIFT account. Vendor email-subscription is the primary notification channel. |
| MT | Montana | [https://emacs.mt.gov/](https://emacs.mt.gov/) | Jaggaer | ✅ | 200 | html_spa | playwright | eMACS (Jaggaer / SciQuest). SPA; public solicitations exposed but list renders via JS. |
| NJ | New Jersey | [https://www.njstart.gov/](https://www.njstart.gov/) | Periscope/OpenGov | ✅ | 200 | html_spa | playwright | NJSTART (Periscope). SPA; public solicitations need JS to list. |
| NV | Nevada | [https://nevadaepro.com/](https://nevadaepro.com/) | Periscope/OpenGov | ✅ | 200 | html_spa | playwright | NevadaEPro (Periscope). Public search; JS-rendered. Playwright or Periscope-specific parser needed. |
| NY | New York | [https://www.nyscr.ny.gov/](https://www.nyscr.ny.gov/) | — | ? | 200 | auth_gated | email-parser | NY State Contract Reporter — free account required to view full solicitations. Email subscription is the practical ingestion path. |
| OH | Ohio | [https://procure.ohio.gov/](https://procure.ohio.gov/) | Ionwave | ✅ | 404 | auth_gated | email-parser | OhioBuys / procure.ohio.gov redirects to Ionwave tenant. Free vendor signup; email alerts are the cleanest feed. |
| OR | Oregon | [https://oregonbuys.gov/](https://oregonbuys.gov/) | Periscope/OpenGov | ✅ | 200 | html_spa | playwright | OregonBuys (Periscope). SPA; public search works with JS. Same platform as NJ/MA/NV — single Periscope adapter would cover them all. |
| VA | Virginia | [https://eva.virginia.gov/](https://eva.virginia.gov/) | Ivalua | ✅ | 200 | html_spa | playwright | eVA (Ivalua). Public opportunities list is SPA-rendered; accessible with Playwright. Broad vendor email subscription available. |
| WA | Washington | [https://pr-webs-vendor.des.wa.gov/](https://pr-webs-vendor.des.wa.gov/) | — | ✅ | 200 | auth_gated | email-parser | WEBS vendor portal — public search partial; detail pages require account. Email alerts on signup. |

### Tier 4 — Commercial-only (blocked / unreachable) — 12

| ST | State | Portal | Platform | robots | HTTP | Mechanism | Adapter | Notes |
|----|-------|--------|----------|:-:|:-:|-----------|---------|-------|
| AL | Alabama | [https://vss.alabama.gov/webapp/PRDVSS1X1/AltSelfService](https://vss.alabama.gov/webapp/PRDVSS1X1/AltSelfService) | CGI Advantage VSS | ? | — | commercial_only | commercial | CGI Advantage Vendor Self Service — unreachable from standard HTTP clients; WAF/geo-blocked. |
| AR | Arkansas | [https://www.ark.org/dfa/procurement/](https://www.ark.org/dfa/procurement/) | — | ✅ | 404 | unknown | none | Arkansas OSP — URL structure shifted; vendor alerts are email-based via ark.org subscription. |
| CO | Colorado | [https://supplier.colorado.gov/](https://supplier.colorado.gov/) | CGI Advantage VSS | ? | — | commercial_only | commercial | CGI Advantage VSS — unreachable from public internet without registration. |
| FL | Florida | [https://vbs.dms.state.fl.us/](https://vbs.dms.state.fl.us/) | — | ? | — | commercial_only | commercial | Vendor Bid System — unreachable from external HTTP; MyFloridaMarketplace requires vendor registration. |
| MD | Maryland | [https://emma.maryland.gov/page.aspx/en/rfp/request_browse…](https://emma.maryland.gov/page.aspx/en/rfp/request_browse_public) | Periscope/OpenGov | 🚫 | 200 | commercial_only | commercial | eMMA — Periscope platform. robots.txt disallows crawling. Email subscription exists but ToS restrictive. |
| NC | North Carolina | [https://www.ips.state.nc.us/ips/](https://www.ips.state.nc.us/ips/) | — | ? | — | commercial_only | commercial | Interactive Purchasing System — unreachable from public HTTP clients. DOA provides an email subscription for vendors. |
| PA | Pennsylvania | [https://www.emarketplace.state.pa.us/](https://www.emarketplace.state.pa.us/) | — | 🚫 | 200 | commercial_only | commercial | eMarketplace. robots.txt disallows crawling. Vendor registration + email notifications exist but ToS restrictive. |
| TN | Tennessee | [https://sso.edison.tn.gov/](https://sso.edison.tn.gov/) | PeopleSoft | ? | — | commercial_only | commercial | Edison Supplier Portal — login only; SSO gateway unreachable from external clients without session. |
| TX | Texas | [https://www.txsmartbuy.gov/esbd](https://www.txsmartbuy.gov/esbd) | — | 🚫 | 200 | commercial_only | commercial | SmartBuy ESBD. robots.txt explicitly disallows automated access. Email subscription available but ToS blocks scraping. |
| UT | Utah | [https://u3p.utah.gov/](https://u3p.utah.gov/) | BidSync | ? | — | commercial_only | commercial | U3P (BidSync by Periscope). Unreachable from external HTTP clients without TLS negotiation adjustments. |
| WV | West Virginia | [https://prdvss.wvoasis.gov/](https://prdvss.wvoasis.gov/) | CGI Advantage VSS | ? | — | commercial_only | commercial | wvOASIS VSS — CGI Advantage, unreachable without registration. |
| WY | Wyoming | [https://procurement.wyo.gov/](https://procurement.wyo.gov/) | — | ? | — | commercial_only | commercial | Wyoming Procurement — URL unreachable from external client; behind WAF. |

## Outside the survey

Federal sources are already wired:
- **SAM.gov** — public API, `SamGovAdapter` in `src/ingestion/adapters/sam-gov.ts`.
- **Grants.gov** — public API, `GrantsGovAdapter`.
- **USAspending.gov** — historical awards, `UsaSpendingAdapter` (for similar-past-award surfacing).

Institution-level procurement (public universities, hospital systems) is a separate thousand-portal surface and is not covered here. The `HtmlPortalAdapter` pattern generalizes to any permitted institution portal.
