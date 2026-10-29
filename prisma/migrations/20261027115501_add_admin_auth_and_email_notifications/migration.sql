-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "treatment_inquiries" ADD COLUMN     "notification_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notification_last_error" VARCHAR(1000),
ADD COLUMN     "notification_message_id" VARCHAR(255),
ADD COLUMN     "notification_sent_at" TIMESTAMP(3),
ADD COLUMN     "notification_status" "NotificationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "treatment_inquiries_created_at_idx" ON "treatment_inquiries"("created_at");

-- CreateIndex
CREATE INDEX "treatment_inquiries_notification_status_idx" ON "treatment_inquiries"("notification_status");
