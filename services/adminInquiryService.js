import { prisma } from "./prisma.js";
import { isUuid } from "../validation/uuid.js";

export function encodeInquiryCursor(inquiry) {
  return Buffer.from(JSON.stringify({
    createdAt: inquiry.createdAt.toISOString(),
    id: inquiry.id,
  })).toString("base64url");
}

export function decodeInquiryCursor(value) {
  if (!value || typeof value !== "string" || value.length > 500) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const createdAt = new Date(parsed.createdAt);
    if (!isUuid(parsed.id) || Number.isNaN(createdAt.getTime())) return null;
    return { id: parsed.id, createdAt };
  } catch {
    return null;
  }
}

export async function listInquiries({ page, limit, search, from, to, cursor }) {
  const where = {};

  if (search) {
    where.OR = [
      "fullName",
      "country",
      "mobileNumber",
      "email",
      "treatment",
      "preferredDestination",
    ].map((field) => ({
      [field]: { contains: search, mode: "insensitive" },
    }));
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const countWhere = { ...where };

  if (cursor) {
    where.AND = [{
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    }];
  }

  const [items, total] = await prisma.$transaction([
    prisma.treatmentInquiry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: cursor ? 0 : (page - 1) * limit,
      take: limit + 1,
    }),
    prisma.treatmentInquiry.count({ where: countWhere }),
  ]);

  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;

  return {
    items: pageItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      nextCursor: hasMore ? encodeInquiryCursor(pageItems.at(-1)) : null,
    },
  };
}

export function getInquiryById(id) {
  return prisma.treatmentInquiry.findUnique({ where: { id } });
}
