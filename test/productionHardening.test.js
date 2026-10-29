import test from "node:test";
import assert from "node:assert/strict";
import { decodeInquiryCursor, encodeInquiryCursor } from "../services/adminInquiryService.js";
import { notificationRetryDelayMs } from "../services/inquiryService.js";
import { isUuid } from "../validation/uuid.js";

test("UUID validation accepts resource IDs and rejects sequential IDs", () => {
  assert.equal(isUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isUuid("42"), false);
  assert.equal(isUuid(42), false);
  assert.equal(isUuid("not-a-uuid"), false);
});

test("inquiry cursor round-trips a stable timestamp and UUID", () => {
  const inquiry = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: new Date("2026-10-29T10:15:30.000Z"),
  };
  const decoded = decodeInquiryCursor(encodeInquiryCursor(inquiry));
  assert.equal(decoded.id, inquiry.id);
  assert.equal(decoded.createdAt.toISOString(), inquiry.createdAt.toISOString());
  assert.equal(decodeInquiryCursor("invalid"), null);
});

test("notification retry delay uses capped exponential backoff", () => {
  assert.equal(notificationRetryDelayMs(1), 30_000);
  assert.equal(notificationRetryDelayMs(2), 60_000);
  assert.equal(notificationRetryDelayMs(8), 3_600_000);
  assert.equal(notificationRetryDelayMs(20), 3_600_000);
});
