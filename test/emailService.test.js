import test from "node:test";
import assert from "node:assert/strict";
import { sendAdminInquiryEmail } from "../services/emailService.js";

test("Brevo request contains the inquiry and escapes HTML", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME,
    ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL,
  };

  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.com";
  process.env.BREVO_SENDER_NAME = "MedTravia";
  process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.com";

  let capturedRequest;
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return new Response(JSON.stringify({ messageId: "message-123" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const messageId = await sendAdminInquiryEmail({
      id: "550e8400-e29b-41d4-a716-446655440000",
      fullName: "Jane <script>alert(1)</script>",
      country: "India",
      mobileNumber: "+91 98765 43210",
      email: "jane@example.com",
      treatment: "Cardiology",
      preferredDestination: "India",
      message: "Please contact me",
      createdAt: new Date("2026-10-27T12:00:00.000Z"),
    });

    const body = JSON.parse(capturedRequest.options.body);
    assert.equal(messageId, "message-123");
    assert.equal(capturedRequest.url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(capturedRequest.options.headers["api-key"], "test-api-key");
    assert.equal(body.to[0].email, "admin@example.com");
    assert.match(body.htmlContent, /Jane &lt;script&gt;/);
    assert.doesNotMatch(body.htmlContent, /Jane <script>/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
