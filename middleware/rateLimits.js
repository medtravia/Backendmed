import { rateLimit } from "express-rate-limit";
import { PostgresRateLimitStore } from "../services/postgresRateLimitStore.js";

function jsonHandler(req, res) {
  res.status(429).json({ message: "Too many requests. Please try again later." });
}

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new PostgresRateLimitStore("global"),
  handler: jsonHandler,
});

export const inquiryRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new PostgresRateLimitStore("inquiry"),
  handler: jsonHandler,
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new PostgresRateLimitStore("login"),
  skipSuccessfulRequests: true,
  handler: jsonHandler,
});
