-- CreateTable
CREATE TABLE "treatment_inquiries" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "mobile_number" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "treatment" VARCHAR(150) NOT NULL,
    "preferred_destination" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_inquiries_email_idx" ON "treatment_inquiries"("email");
