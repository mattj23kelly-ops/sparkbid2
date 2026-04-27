// Thin wrapper around the Resend REST API (https://resend.com/docs).
// Uses fetch directly so we don't add a new npm dependency.
//
// Configure:
//   RESEND_API_KEY       — required
//   RESEND_FROM_EMAIL    — verified sender, e.g. "SparkBid <no-reply@sparkbid.app>"
//   NEXT_PUBLIC_APP_URL  — used to build absolute links in emails

const RESEND_URL = "https://api.resend.com/emails";

export async function sendEmail({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    // In development it's normal to not have these set. Log and no-op
    // so features depending on this don't crash the whole request.
    console.warn("[email] RESEND_API_KEY or RESEND_FROM_EMAIL missing; skipping send.");
    return { skipped: true };
  }

  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch(RESEND_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Template helpers ────────────────────────────────────────
// Each template returns { subject, html, text } so the caller can pass
// straight into sendEmail.

export function bidSubmittedTemplate({ projectTitle, contractorName, amount, projectId }) {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link    = `${appUrl}/gc/bids/${projectId}`;
  const money   = `$${Number(amount).toLocaleString()}`;

  return {
    subject: `New bid on "${projectTitle}" — ${money}`,
    text: `
${contractorName} just submitted a bid of ${money} on your project "${projectTitle}".

Review and compare bids: ${link}

— SparkBid
    `.trim(),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <div style="font-size:14px;color:#64748b;margin-bottom:8px;letter-spacing:.04em;text-transform:uppercase;font-weight:600">New bid received</div>
        <h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(projectTitle)}</h1>
        <p style="margin:0 0 16px;color:#475569;font-size:15px">
          <strong>${escapeHtml(contractorName)}</strong> just submitted a bid for
          <strong style="color:#0f172a">${money}</strong>.
        </p>
        <a href="${link}" style="display:inline-block;background:#FBBF24;color:#0F2B46;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">
          Review bids →
        </a>
        <p style="margin:32px 0 0;color:#94a3b8;font-size:12px">
          You&apos;re receiving this because you posted this project on SparkBid.
        </p>
      </div>
    `,
  };
}

export function bidAwardedTemplate({ projectTitle, gcName, amount, projectId }) {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link    = `${appUrl}/ec/bids`;
  const money   = `$${Number(amount).toLocaleString()}`;

  return {
    subject: `You won the bid on "${projectTitle}"`,
    text: `
Congratulations — ${gcName} awarded you the job "${projectTitle}" for ${money}.

See the details: ${link}

— SparkBid
    `.trim(),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <div style="font-size:14px;color:#16a34a;margin-bottom:8px;letter-spacing:.04em;text-transform:uppercase;font-weight:700">You won the job</div>
        <h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(projectTitle)}</h1>
        <p style="margin:0 0 16px;color:#475569;font-size:15px">
          <strong>${escapeHtml(gcName)}</strong> awarded you this job for
          <strong style="color:#0f172a">${money}</strong>.
        </p>
        <a href="${link}" style="display:inline-block;background:#FBBF24;color:#0F2B46;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">
          View your bids →
        </a>
        <p style="margin:32px 0 0;color:#94a3b8;font-size:12px">
          You&apos;re receiving this because you placed a bid on SparkBid.
        </p>
      </div>
    `,
  };
}

export function verificationDecisionTemplate({ approved, fullName, notes }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link   = `${appUrl}/ec`;

  if (approved) {
    return {
      subject: "Your SparkBid license is verified",
      text: `Hi ${fullName ?? "there"},\n\nYour electrician license has been verified. You can now submit bids on SparkBid.\n\n${link}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
          <h1 style="font-size:22px;margin:0 0 8px">License verified ✓</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:15px">
            Hi ${escapeHtml(fullName ?? "there")} — your electrician license has been verified.
            You can now submit bids on SparkBid.
          </p>
          <a href="${link}" style="display:inline-block;background:#FBBF24;color:#0F2B46;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">
            Open SparkBid →
          </a>
        </div>
      `,
    };
  }
  return {
    subject: "Your SparkBid license verification needs attention",
    text: `Hi ${fullName ?? "there"},\n\nWe couldn't verify your electrician license.${notes ? `\n\nReviewer notes: ${notes}` : ""}\n\nReply to this email with an updated license number or scan and we'll re-review.\n\n${link}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h1 style="font-size:22px;margin:0 0 8px">License verification needs attention</h1>
        <p style="margin:0 0 16px;color:#475569;font-size:15px">
          Hi ${escapeHtml(fullName ?? "there")} — we couldn&apos;t verify your electrician license.
        </p>
        ${notes ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin:0 0 16px;font-size:14px;color:#92400e"><strong>Reviewer notes:</strong> ${escapeHtml(notes)}</div>` : ""}
        <p style="margin:0 0 16px;color:#475569;font-size:15px">
          Reply to this email with an updated license number or photo and we&apos;ll re-review.
        </p>
      </div>
    `,
  };
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
