import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

// Lazy so builds / cron routes that never send email don't need RESEND_API_KEY.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is required to send alert emails — set it in Vercel env vars.",
    );
  }
  _resend = new Resend(key);
  return _resend;
}

const FROM =
  process.env.ALERT_FROM_EMAIL ?? "RFP Aggregator <alerts@example.com>";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface AlertDigestRfp {
  rfp_id: string;
  title: string;
  agency_name: string | null;
  state: string | null;
  due_at: string | null;
  url: string;
  vertical: string | null;
  category: string | null;
}

/**
 * Send a digest email for a saved search with its matching RFPs.
 * Marks the alert rows as sent on success so we don't double-send.
 */
export async function sendDigestEmail(
  supabase: SupabaseClient<Database>,
  params: {
    userEmail: string;
    searchName: string;
    rfps: AlertDigestRfp[];
    alertIds: string[];
  },
): Promise<void> {
  if (params.rfps.length === 0) return;

  const subject =
    params.rfps.length === 1
      ? `New RFP match: ${params.rfps[0].title.slice(0, 60)}`
      : `${params.rfps.length} new RFPs matching "${params.searchName}"`;

  const html = buildDigestHtml({
    searchName: params.searchName,
    rfps: params.rfps,
  });

  const text = buildDigestText({
    searchName: params.searchName,
    rfps: params.rfps,
  });

  try {
    await getResend().emails.send({
      from: FROM,
      to: params.userEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[alerts] Resend send failed:", err);
    throw err;
  }

  // Mark alerts as sent
  const now = new Date().toISOString();
  await supabase
    .from("alerts")
    .update({ sent_at: now })
    .in("id", params.alertIds);
}

function buildDigestHtml(params: {
  searchName: string;
  rfps: AlertDigestRfp[];
}): string {
  const rows = params.rfps
    .map((r) => {
      const meta = [r.agency_name, r.state].filter(Boolean).join(" · ");
      const due = r.due_at
        ? `<div style="color:#64748b;font-size:13px;margin-top:4px">Due ${new Date(r.due_at).toLocaleDateString()}</div>`
        : "";
      const tags = [r.vertical, r.category]
        .filter(Boolean)
        .map(
          (t) =>
            `<span style="display:inline-block;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:3px;font-size:11px;margin-right:4px">${escape(t as string)}</span>`,
        )
        .join("");
      return `
<tr>
  <td style="padding:16px;border-bottom:1px solid #e2e8f0">
    <a href="${SITE_URL}/rfps/${r.rfp_id}" style="color:#0f172a;text-decoration:none;font-weight:500;line-height:1.3">${escape(r.title)}</a>
    <div style="color:#64748b;font-size:13px;margin-top:4px">${escape(meta)}</div>
    ${due}
    <div style="margin-top:8px">${tags}</div>
  </td>
</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0">
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">RFP matches</div>
      <div style="font-size:18px;font-weight:600;margin-top:4px">${escape(params.searchName)}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${rows}
    </table>
    <div style="padding:16px 24px;background:#f8fafc;font-size:13px;color:#64748b">
      <a href="${SITE_URL}/saved-searches" style="color:#0f172a">Manage saved searches</a>
    </div>
  </div>
</body>
</html>`;
}

function buildDigestText(params: {
  searchName: string;
  rfps: AlertDigestRfp[];
}): string {
  const lines = [
    `RFP matches: ${params.searchName}`,
    "",
    ...params.rfps.map((r, i) => {
      const meta = [r.agency_name, r.state].filter(Boolean).join(" · ");
      const due = r.due_at ? ` (due ${new Date(r.due_at).toLocaleDateString()})` : "";
      return `${i + 1}. ${r.title}${due}\n   ${meta}\n   ${SITE_URL}/rfps/${r.rfp_id}`;
    }),
    "",
    `Manage saved searches: ${SITE_URL}/saved-searches`,
  ];
  return lines.join("\n");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
