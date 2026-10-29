import { Router } from "express";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { loginRateLimit } from "../middleware/rateLimits.js";
import { loginAdmin } from "../services/authService.js";
import { decodeInquiryCursor, getInquiryById, listInquiries } from "../services/adminInquiryService.js";
import { queueInquiryNotificationRetry } from "../services/inquiryService.js";
import { isUuid } from "../validation/uuid.js";

const adminRouter = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parsePositiveInteger(value, fallback, max) {
  if (value === undefined) return fallback;

  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
}

function parseDate(value, endOfDay = false) {
  if (!value) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

adminRouter.post("/auth/login", loginRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!emailPattern.test(email) || password.length === 0 || password.length > 200) {
      return res.status(400).json({ message: "A valid email and password are required" });
    }

    const result = await loginAdmin(email, password);

    if (!result) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.use(authenticateAdmin);

adminRouter.get("/me", (req, res) => {
  res.status(200).json({ data: req.admin });
});

adminRouter.get("/inquiries", async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1, 1_000);
    const limit = parsePositiveInteger(req.query.limit, 20, 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 150) : "";
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to, true);
    const cursor = req.query.cursor === undefined ? undefined : decodeInquiryCursor(req.query.cursor);

    if (page === null || limit === null || from === null || to === null || cursor === null || (from && to && from > to)) {
      return res.status(400).json({ message: "Invalid pagination or date filter" });
    }

    const result = await listInquiries({ page, limit, search, from, to, cursor });
    return res.status(200).json({ data: result.items, pagination: result.pagination });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/inquiries/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: "Invalid inquiry id" });

    const inquiry = await getInquiryById(id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

    return res.status(200).json({ data: inquiry });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/inquiries/:id/resend-notification", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: "Invalid inquiry id" });

    const result = await queueInquiryNotificationRetry(id);
    if (result.state === "not_found") return res.status(404).json({ message: "Inquiry not found" });
    if (result.state === "sent") {
      return res.status(409).json({ message: "Notification has already been sent" });
    }
    if (result.state === "active") {
      return res.status(409).json({ message: "Notification delivery is already in progress" });
    }

    return res.status(202).json({
      message: "Notification retry queued",
      data: {
        id: result.inquiry.id,
        notificationStatus: result.inquiry.notificationStatus,
        notificationAttempts: result.inquiry.notificationAttempts,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default adminRouter;
