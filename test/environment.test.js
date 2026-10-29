import test from "node:test";
import assert from "node:assert/strict";
import { validateProductionEnvironment } from "../config/env.js";

const managedKeys = [
  "NODE_ENV",
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "ADMIN_NOTIFICATION_EMAIL",
  "CORS_ORIGIN",
  "TRUST_PROXY",
];

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const validProductionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@db.example.com/app?sslmode=require",
  JWT_SECRET: "a-secure-random-secret-that-is-long-enough",
  JWT_EXPIRES_IN: "1h",
  BREVO_API_KEY: "xkeysib-test-only-key",
  BREVO_SENDER_EMAIL: "sender@example.com",
  ADMIN_NOTIFICATION_EMAIL: "admin@example.com",
  CORS_ORIGIN: "https://app.example.com",
  TRUST_PROXY: "1",
};

test("valid production environment passes fail-fast validation", () => {
  withEnvironment(validProductionEnvironment, () => {
    assert.doesNotThrow(() => validateProductionEnvironment());
  });
});

test("production rejects localhost CORS and unrestricted proxy trust", () => {
  withEnvironment({ ...validProductionEnvironment, CORS_ORIGIN: "http://localhost:5173" }, () => {
    assert.throws(() => validateProductionEnvironment(), /production origins/);
  });
  withEnvironment({ ...validProductionEnvironment, TRUST_PROXY: "true" }, () => {
    assert.throws(() => validateProductionEnvironment(), /unsafe/);
  });
});
