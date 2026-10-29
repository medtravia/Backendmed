import { getBrevoConfig } from "../config/env.js";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function field(label, value) {
  return `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">${label}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(value)}</td></tr>`;
}

function createEmailContent(inquiry) {
  const rows = [
    field("Inquiry ID", inquiry.id),
    field("Full name", inquiry.fullName),
    field("Country", inquiry.country),
    field("Mobile number", inquiry.mobileNumber),
    field("Email", inquiry.email),
    field("Treatment", inquiry.treatment),
    field("Preferred destination", inquiry.preferredDestination),
    field("Message", inquiry.message),
    field("Submitted at", inquiry.createdAt.toISOString()),
  ].join("");

  return {
    subject: `New treatment inquiry #${inquiry.id} from ${inquiry.fullName}`,
    textContent: [
      `New treatment inquiry #${inquiry.id}`,
      `Full name: ${inquiry.fullName}`,
      `Country: ${inquiry.country}`,
      `Mobile number: ${inquiry.mobileNumber}`,
      `Email: ${inquiry.email}`,
      `Treatment: ${inquiry.treatment}`,
      `Preferred destination: ${inquiry.preferredDestination}`,
      `Message: ${inquiry.message}`,
      `Submitted at: ${inquiry.createdAt.toISOString()}`,
    ].join("\n"),
    htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222"><h2>New treatment inquiry</h2><table style="border-collapse:collapse;width:100%;max-width:700px">${rows}</table></body></html>`,
  };
}

export async function sendAdminInquiryEmail(inquiry) {
  const config = getBrevoConfig();
  const content = createEmailContent(inquiry);
  const response = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": config.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: config.senderName,
        email: config.senderEmail,
      },
      to: config.recipients.map((email) => ({ email })),
      replyTo: {
        name: inquiry.fullName,
        email: inquiry.email,
      },
      subject: content.subject,
      textContent: content.textContent,
      htmlContent: content.htmlContent,
      tags: ["new-treatment-inquiry"],
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = result.message || `Brevo returned HTTP ${response.status}`;
    throw new Error(detail);
  }

  return result.messageId || null;
}
