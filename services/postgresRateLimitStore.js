import { prisma } from "./prisma.js";

export class PostgresRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60_000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const bucketKey = `${this.prefix}:${key}`;
    const nextResetAt = new Date(Date.now() + this.windowMs);
    const rows = await prisma.$queryRaw`
      INSERT INTO "rate_limit_buckets" ("key", "total_hits", "reset_at")
      VALUES (${bucketKey}, 1, ${nextResetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "total_hits" = CASE
          WHEN "rate_limit_buckets"."reset_at" <= CURRENT_TIMESTAMP THEN 1
          ELSE "rate_limit_buckets"."total_hits" + 1
        END,
        "reset_at" = CASE
          WHEN "rate_limit_buckets"."reset_at" <= CURRENT_TIMESTAMP THEN EXCLUDED."reset_at"
          ELSE "rate_limit_buckets"."reset_at"
        END
      RETURNING "total_hits" AS "totalHits", "reset_at" AS "resetAt"
    `;

    return {
      totalHits: Number(rows[0].totalHits),
      resetTime: new Date(rows[0].resetAt),
    };
  }

  async decrement(key) {
    const bucketKey = `${this.prefix}:${key}`;
    await prisma.$executeRaw`
      UPDATE "rate_limit_buckets"
      SET "total_hits" = GREATEST("total_hits" - 1, 0)
      WHERE "key" = ${bucketKey}
    `;
  }

  async resetKey(key) {
    const bucketKey = `${this.prefix}:${key}`;
    await prisma.$executeRaw`DELETE FROM "rate_limit_buckets" WHERE "key" = ${bucketKey}`;
  }
}
