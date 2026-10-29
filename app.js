import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getCorsOrigins, getTrustProxy } from "./config/env.js";
import { globalRateLimit } from "./middleware/rateLimits.js";
import adminRouter from "./router/adminRouter.js";
import inquiryRouter from "./router/inquiryRouter.js";
import { prisma } from "./services/prisma.js";

const app = express();
const allowedOrigins = new Set(getCorsOrigins());

app.disable("x-powered-by");
app.set("trust proxy", getTrustProxy());
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);

    const error = new Error("Origin is not allowed by CORS");
    error.status = 403;
    return callback(error);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  exposedHeaders: ["Idempotency-Replayed", "RateLimit", "RateLimit-Policy"],
  maxAge: 86400,
}));
app.use(express.json({ limit: "50kb" }));

// Probes must remain available even when user traffic is rate limited. Readiness
// still checks the database and therefore fails closed when a dependency is down.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "good" });
});

app.get("/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});

app.use(globalRateLimit);

app.use("/api/inquiries", inquiryRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  const isInvalidJson = error instanceof SyntaxError && error.status === 400 && "body" in error;
  const status = isInvalidJson ? 400 : error.status || 500;

  if (status >= 500) {
    console.error("Unhandled request error", {
      method: req.method,
      path: req.path,
      error: error.message,
    });
  }

  res.status(status).json({
    message: status === 400 && isInvalidJson ? "Invalid JSON body" : status >= 500 ? "Internal server error" : error.message,
  });
});

export default app;
