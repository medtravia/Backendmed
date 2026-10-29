import test from "node:test";
import assert from "node:assert/strict";
import { validateInquiry } from "../validation/inquiryValidation.js";

const validInquiry = {
  fullName: " Jane Doe ",
  country: "India",
  mobileNumber: "+91 98765 43210",
  email: "JANE@EXAMPLE.COM",
  treatment: "Cardiology",
  preferredDestination: "India",
  message: "Please contact me.",
};

test("valid inquiry is normalized", () => {
  const result = validateInquiry(validInquiry);
  assert.deepEqual(result.errors, {});
  assert.equal(result.cleaned.fullName, "Jane Doe");
  assert.equal(result.cleaned.email, "jane@example.com");
});

test("missing and malformed fields are rejected", () => {
  const result = validateInquiry({ email: "not-an-email", mobileNumber: "12" });
  assert.equal(result.errors.email, "email must be a valid email address");
  assert.equal(result.errors.mobileNumber, "mobileNumber must be a valid phone number");
  assert.equal(result.errors.fullName, "fullName is required");
});
