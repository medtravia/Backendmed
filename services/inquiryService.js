import { createHash, randomUUID } from "node:crypto";
import { getNotificationWorkerConfig } from "../config/env.js";
import { prisma } from "./prisma.js";
import { sendAdminInquiryEmail } from "./emailService.js";

function fingerprint(data) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function idempotencyConflict() {
  const error = new Error("Idempotency key was already used for a different inquiry");
  error.status = 409;
  return error;
}

export async function createInquiry(data, idempotencyKey) {
  const requestFingerprint = idempotencyKey ? fingerprint(data) : null;

  if (idempotencyKey) {
    const existing = await prisma.treatmentInquiry.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) throw idempotencyConflict();
      return { inquiry: existing, created: false };
    }
  }

  try {
    const inquiry = await prisma.treatmentInquiry.create({
      data: {
        ...data,
        idempotencyKey: idempotencyKey || null,
        requestFingerprint,
      },
    });
    return { inquiry, created: true };
  } catch (error) {
    if (idempotencyKey && error.code === "P2002") {
      const existing = await prisma.treatmentInquiry.findUnique({ where: { idempotencyKey } });
      if (existing?.requestFingerprint === requestFingerprint) {
        return { inquiry: existing, created: false };
      }
      throw idempotencyConflict();
    }
    throw error;
  }
}

function eligibleNotificationWhere(now, staleBefore, maxAttempts) {
  return {
    notificationAttempts: { lt: maxAttempts },
    OR: [
      {
        notificationStatus: { in: ["PENDING", "FAILED"] },
        nextNotificationAttemptAt: { lte: now },
      },
      {
        notificationStatus: "SENDING",
        OR: [
          { notificationClaimedAt: { lte: staleBefore } },
          { notificationClaimedAt: null },
        ],
      },
    ],
  };
}

export function notificationRetryDelayMs(attempt) {
  return Math.min(60 * 60_000, 30_000 * (2 ** Math.max(0, attempt - 1)));
}

export async function processNextInquiryNotification() {
  const { leaseMs, maxAttempts } = getNotificationWorkerConfig();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - leaseMs);
  const eligibility = eligibleNotificationWhere(now, staleBefore, maxAttempts);
  const candidate = await prisma.treatmentInquiry.findFirst({
    where: eligibility,
    orderBy: [
      { nextNotificationAttemptAt: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
    select: { id: true },
  });

  if (!candidate) return null;

  const claimToken = randomUUID();
  const claimed = await prisma.treatmentInquiry.updateMany({
    where: { id: candidate.id, ...eligibility },
    data: {
      notificationStatus: "SENDING",
      notificationClaimedAt: now,
      notificationClaimToken: claimToken,
      notificationAttempts: { increment: 1 },
      notificationLastError: null,
    },
  });
  if (claimed.count === 0) return { claimed: false };

  const inquiry = await prisma.treatmentInquiry.findUniqueOrThrow({ where: { id: candidate.id } });

  try {
    const messageId = await sendAdminInquiryEmail(inquiry);
    await prisma.treatmentInquiry.updateMany({
      where: { id: inquiry.id, notificationClaimToken: claimToken },
      data: {
        notificationStatus: "SENT",
        notificationMessageId: messageId,
        notificationSentAt: new Date(),
        notificationLastError: null,
        notificationClaimedAt: null,
        notificationClaimToken: null,
        nextNotificationAttemptAt: null,
      },
    });
    return { claimed: true, sent: true, id: inquiry.id };
  } catch (error) {
    const errorMessage = String(error.message || "Unknown email delivery error").slice(0, 1000);
    const canRetry = inquiry.notificationAttempts < maxAttempts;
    const nextAttemptAt = canRetry
      ? new Date(Date.now() + notificationRetryDelayMs(inquiry.notificationAttempts))
      : null;

    console.error("Admin notification failed", {
      inquiryId: inquiry.id,
      attempt: inquiry.notificationAttempts,
      retryScheduled: canRetry,
      error: errorMessage,
    });

    await prisma.treatmentInquiry.updateMany({
      where: { id: inquiry.id, notificationClaimToken: claimToken },
      data: {
        notificationStatus: "FAILED",
        notificationLastError: errorMessage,
        notificationClaimedAt: null,
        notificationClaimToken: null,
        nextNotificationAttemptAt: nextAttemptAt,
      },
    });
    return { claimed: true, sent: false, id: inquiry.id, retryScheduled: canRetry };
  }
}

export async function queueInquiryNotificationRetry(id) {
  const { leaseMs } = getNotificationWorkerConfig();
  const activeAfter = new Date(Date.now() - leaseMs);
  const inquiry = await prisma.treatmentInquiry.findUnique({ where: { id } });
  if (!inquiry) return { state: "not_found" };
  if (inquiry.notificationStatus === "SENT") return { state: "sent", inquiry };

  const queued = await prisma.treatmentInquiry.updateMany({
    where: {
      id,
      OR: [
        { notificationStatus: { in: ["PENDING", "FAILED"] } },
        {
          notificationStatus: "SENDING",
          OR: [
            { notificationClaimedAt: { lte: activeAfter } },
            { notificationClaimedAt: null },
          ],
        },
      ],
    },
    data: {
      notificationStatus: "PENDING",
      notificationAttempts: 0,
      notificationLastError: null,
      notificationClaimedAt: null,
      notificationClaimToken: null,
      nextNotificationAttemptAt: new Date(),
    },
  });
  if (queued.count === 0) {
    const current = await prisma.treatmentInquiry.findUnique({ where: { id } });
    return { state: current?.notificationStatus === "SENT" ? "sent" : "active", inquiry: current };
  }

  const updated = await prisma.treatmentInquiry.findUniqueOrThrow({ where: { id } });
  return { state: "queued", inquiry: updated };
}
