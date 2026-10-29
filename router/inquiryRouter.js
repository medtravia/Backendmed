import { Router } from "express";
import { createInquiry } from "../services/inquiryService.js";
import { inquiryRateLimit } from "../middleware/rateLimits.js";
import { validateInquiry } from "../validation/inquiryValidation.js";

const inquiryRouter = Router();

inquiryRouter.post("/", inquiryRateLimit, async (req, res, next) => {
  try {
    const { errors, cleaned } = validateInquiry(req.body ?? {});

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Please correct the invalid fields",
        errors,
      });
    }
       
    const idempotencyKey = req.get("idempotency-key")?.trim();
    if (process.env.NODE_ENV === "production" && !idempotencyKey) {
      return res.status(400).json({ message: "Idempotency-Key is required" });
    }
    if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ message: "Idempotency-Key must be 8-128 safe characters" });
    }

    const { inquiry, created } = await createInquiry(cleaned, idempotencyKey);
    if (!created) res.set("Idempotency-Replayed", "true");
    return res.status(created ? 201 : 200).json({
      message: created ? "Treatment inquiry submitted successfully" : "Treatment inquiry already submitted",
      data: {
        id: inquiry.id,
        createdAt: inquiry.createdAt,
        notificationStatus: inquiry.notificationStatus,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default inquiryRouter;
