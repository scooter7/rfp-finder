/**
 * robots.txt audit script.
 *
 * Run before adding any new HtmlPortalAdapter:
 *   tsx scripts/robots-audit.ts
 *
 * Or with custom candidates:
 *   tsx scripts/robots-audit.ts https://example.gov/bids
 *
 * For each candidate, fetches /robots.txt and determines whether our
 * user-agent is permitted to fetch the listing path. Output is a markdown
 * table suitable for pasting into README.md.
 *
 * This does NOT enforce robots.txt — that's the adapter's job. The audit
 * only tells you which portals are safe to build against.
 */

interface Candidate {
  name: string;
  url: string;
}

const DEFAULT_CANDIDATES: Candidate[] = [
  // ----- State procurement portals (Phase 2C targets) -----
  { name: "California Cal eProcure", url: "https://caleprocure.ca.gov/" },
  { name: "Texas SmartBuy ESBD", url: "https://www.txsmartbuy.gov/esbd" },
  { name: "NY Contract Reporter", url: "https://www.nyscr.ny.gov/" },
  { name: "Florida Vendor Bid System", url: "https://vbs.dms.state.fl.us/vbs/" },
  { name: "Illinois BidBuy", url: "https://www2.illinois.gov/cms/business/" },
  { name: "Oregon OregonBuys", url: "https://oregonbuys.gov/" },
  { name: "Washington WEBS", url: "https://pr-webs-vendor.des.wa.gov/" },
  { name: "Georgia Procurement Registry", url: "https://ssl.doas.state.ga.us/gpr/" },
  { name: "Virginia eVA", url: "https://eva.virginia.gov/" },
  { name: "Pennsylvania eMarketplace", url: "https://www.emarketplace.state.pa.us/" },

  // ----- Institution-level candidates (Phase 3 targets) -----
  { name: "University of Oregon (Bonfire)", url: "https://uoregon.bonfirehub.com/portal/" },
  { name: "Public Purchase (multi-tenant)", url: "https://www.publicpurchase.com/gems/" },
];

async function checkRobots(candidate: Candidate) {
  const baseUrl = new URL(candidate.url);
  const robotsUrl = `${baseUrl.origin}/robots.txt`;
  const pathToCheck = baseUrl.pathname || "/";

  try {
    const res = await fetch(robotsUrl, {
      headers: { "user-agent": "rfp-aggregator-audit/0.1" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        ...candidate,
        status: res.status === 404 ? "no-robots" : "error",
        verdict: res.status === 404 ? "✅ no robots.txt" : `⚠️ HTTP ${res.status}`,
        pathChecked: pathToCheck,
      };
    }

    const text = await res.text();
    const verdict = evaluateRobots(text, pathToCheck);
    return {
      ...candidate,
      status: verdict.allowed ? "ok" : "disallowed",
      verdict: verdict.allowed
        ? "✅ permitted"
        : `❌ disallowed by: \`${verdict.rule}\``,
      pathChecked: pathToCheck,
    };
  } catch (err) {
    return {
      ...candidate,
      status: "error",
      verdict: `⚠️ ${err instanceof Error ? err.message : "fetch failed"}`,
      pathChecked: pathToCheck,
    };
  }
}

/**
 * Minimal robots.txt interpreter. Looks for User-agent: * (or our UA) and
 * evaluates whether the given path is covered by any Disallow directive.
 * Not RFC-complete — doesn't handle Allow-overrides-Disallow, wildcards, or
 * sitemaps. Good enough for initial audit.
 */
function evaluateRobots(
  text: string,
  path: string,
): { allowed: boolean; rule?: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let inGroup = false;
  const disallows: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.toLowerCase().trim();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      inGroup = value === "*" || value.toLowerCase().includes("rfp-aggregator");
      continue;
    }
    if (!inGroup) continue;

    if (key === "disallow") {
      if (value === "") continue; // empty disallow = allow all
      disallows.push(value);
    }
  }

  for (const rule of disallows) {
    if (path.startsWith(rule) || rule === "/") {
      return { allowed: false, rule };
    }
  }
  return { allowed: true };
}

async function main() {
  const candidates: Candidate[] =
    process.argv.length > 2
      ? process.argv.slice(2).map((url) => ({ name: url, url }))
      : DEFAULT_CANDIDATES;

  console.log(`Checking ${candidates.length} portal(s)...\n`);

  const results = await Promise.all(candidates.map(checkRobots));

  // Markdown table output
  console.log("| Portal | Path | Verdict |");
  console.log("|--------|------|---------|");
  for (const r of results) {
    console.log(`| ${r.name} | \`${r.pathChecked}\` | ${r.verdict} |`);
  }

  const ok = results.filter((r) => r.status === "ok" || r.status === "no-robots");
  const blocked = results.filter((r) => r.status === "disallowed");
  console.log(
    `\n${ok.length} permitted · ${blocked.length} disallowed · ${results.length - ok.length - blocked.length} error`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
