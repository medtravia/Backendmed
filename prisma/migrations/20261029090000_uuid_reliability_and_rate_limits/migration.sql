-- UUID primary keys replace externally predictable integer identifiers. There are
-- currently no foreign keys referencing either table, so both keys can be migrated
-- in place while preserving every row.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

ALTER TABLE "treatment_inquiries" ADD COLUMN "uuid_id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "admins" ADD COLUMN "uuid_id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "treatment_inquiries" DROP CONSTRAINT "treatment_inquiries_pkey";
ALTER TABLE "admins" DROP CONSTRAINT "admins_pkey";
ALTER TABLE "treatment_inquiries" RENAME COLUMN "id" TO "legacy_id";
ALTER TABLE "admins" RENAME COLUMN "id" TO "legacy_id";
ALTER TABLE "treatment_inquiries" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "admins" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "treatment_inquiries" ALTER COLUMN "legacy_id" DROP DEFAULT, ALTER COLUMN "legacy_id" DROP NOT NULL;
ALTER TABLE "admins" ALTER COLUMN "legacy_id" DROP DEFAULT, ALTER COLUMN "legacy_id" DROP NOT NULL;
ALTER TABLE "treatment_inquiries" ADD CONSTRAINT "treatment_inquiries_pkey" PRIMARY KEY ("id");
ALTER TABLE "admins" ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");
DROP SEQUENCE IF EXISTS "treatment_inquiries_id_seq";
DROP SEQUENCE IF EXISTS "admins_id_seq";
CREATE UNIQUE INDEX "treatment_inquiries_legacy_id_key" ON "treatment_inquiries"("legacy_id");
CREATE UNIQUE INDEX "admins_legacy_id_key" ON "admins"("legacy_id");

ALTER TABLE "treatment_inquiries"
  ADD COLUMN "notification_claimed_at" TIMESTAMP(3),
  ADD COLUMN "notification_claim_token" UUID,
  ADD COLUMN "next_notification_attempt_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "idempotency_key" VARCHAR(128),
  ADD COLUMN "request_fingerprint" CHAR(64);

UPDATE "treatment_inquiries"
SET "next_notification_attempt_at" = CASE
  WHEN "notification_status" IN ('PENDING', 'FAILED', 'SENDING') THEN CURRENT_TIMESTAMP
  ELSE NULL
END;

-- A deployment can safely recover rows left in SENDING by an older process.
UPDATE "treatment_inquiries"
SET "notification_status" = 'FAILED',
    "notification_last_error" = 'Recovered during reliable notification migration'
WHERE "notification_status" = 'SENDING';

CREATE UNIQUE INDEX "treatment_inquiries_idempotency_key_key"
  ON "treatment_inquiries"("idempotency_key");
DROP INDEX IF EXISTS "treatment_inquiries_notification_status_idx";
CREATE INDEX "treatment_inquiries_notification_status_next_notification_attempt_at_idx"
  ON "treatment_inquiries"("notification_status", "next_notification_attempt_at");

-- Trigram indexes support the contains/ILIKE searches used by the admin API.
CREATE INDEX "treatment_inquiries_full_name_trgm_idx" ON "treatment_inquiries" USING GIN ("full_name" gin_trgm_ops);
CREATE INDEX "treatment_inquiries_country_trgm_idx" ON "treatment_inquiries" USING GIN ("country" gin_trgm_ops);
CREATE INDEX "treatment_inquiries_mobile_number_trgm_idx" ON "treatment_inquiries" USING GIN ("mobile_number" gin_trgm_ops);
CREATE INDEX "treatment_inquiries_email_trgm_idx" ON "treatment_inquiries" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "treatment_inquiries_treatment_trgm_idx" ON "treatment_inquiries" USING GIN ("treatment" gin_trgm_ops);
CREATE INDEX "treatment_inquiries_preferred_destination_trgm_idx" ON "treatment_inquiries" USING GIN ("preferred_destination" gin_trgm_ops);

CREATE TABLE "rate_limit_buckets" (
  "key" VARCHAR(255) NOT NULL,
  "total_hits" INTEGER NOT NULL,
  "reset_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");
