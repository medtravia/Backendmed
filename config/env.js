import "dotenv/config";

function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function integerSetting(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

export function getJwtConfig() {
  const secret = required("JWT_SECRET");

  if (secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  const expiresIn = process.env.JWT_EXPIRES_IN?.trim() || "1h";
  if (!/^\d+(?:ms|s|m|h|d|w|y)$/.test(expiresIn) && !/^\d+$/.test(expiresIn)) {
    throw new Error("JWT_EXPIRES_IN must be a duration such as 1h or 30m");
  }

  return {
    secret,
    expiresIn,
    issuer: "medtravia-api",
    audience: "medtravia-admin",
  };
}

export function getBrevoConfig() {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = required("ADMIN_NOTIFICATION_EMAIL")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (recipients.length === 0 || recipients.some((email) => !emailPattern.test(email))) {
    throw new Error("ADMIN_NOTIFICATION_EMAIL must contain valid email addresses");
  }

  const senderEmail = required("BREVO_SENDER_EMAIL").toLowerCase();
  if (!emailPattern.test(senderEmail)) throw new Error("BREVO_SENDER_EMAIL must be valid");

  return {
    apiKey: required("BREVO_API_KEY"),
    senderEmail,
    senderName: process.env.BREVO_SENDER_NAME?.trim() || "MedTravia",
    recipients,
  };
}

export function getCorsOrigins() {
  return (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getNotificationWorkerConfig() {
  return {
    pollIntervalMs: integerSetting("NOTIFICATION_POLL_INTERVAL_MS", 5_000, { min: 1_000, max: 60_000 }),
    leaseMs: integerSetting("NOTIFICATION_LEASE_MS", 60_000, { min: 15_000, max: 15 * 60_000 }),
    maxAttempts: integerSetting("NOTIFICATION_MAX_ATTEMPTS", 5, { min: 1, max: 20 }),
  };
}

export function getPort() {
  return integerSetting("PORT", 3000, { min: 1, max: 65_535 });
}

export function getTrustProxy() {
  const value = process.env.TRUST_PROXY?.trim();

  if (!value) return false;
  if (value === "true") return true;
  if (value === "false") return false;

  const hops = Number.parseInt(value, 10);
  return Number.isNaN(hops) ? value : hops;
}

export function validateProductionEnvironment() {
  const databaseUrl = required("DATABASE_URL");
  const nodeEnvironment = required("NODE_ENV");
  if (!["development", "test", "production"].includes(nodeEnvironment)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  const jwt = getJwtConfig();
  const brevo = getBrevoConfig();
  getNotificationWorkerConfig();
  getPort();

  if (nodeEnvironment !== "production") return;

  const origins = getCorsOrigins();
  if (!process.env.CORS_ORIGIN?.trim() || origins.length === 0) {
    throw new Error("CORS_ORIGIN is required in production");
  }
  if (origins.some((origin) => origin === "*" || /localhost|127\.0\.0\.1/i.test(origin))) {
    throw new Error("CORS_ORIGIN must contain only production origins");
  }
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin) throw new Error();
    } catch {
      throw new Error("Each production CORS_ORIGIN must be an HTTPS origin without a path");
    }
  }

  const trustProxy = required("TRUST_PROXY");
  if (trustProxy === "true") {
    throw new Error("TRUST_PROXY=true is unsafe; configure an exact hop count or trusted proxy address");
  }
  if (/replace-with/i.test(jwt.secret) || /replace-with/i.test(brevo.apiKey)) {
    throw new Error("Production secrets must not use example placeholder values");
  }
  if (!brevo.apiKey.startsWith("xkeysib-")) {
    throw new Error("BREVO_API_KEY must be an API v3 key");
  }
  try {
    const url = new URL(databaseUrl);
    if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.hostname) throw new Error();
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
}
