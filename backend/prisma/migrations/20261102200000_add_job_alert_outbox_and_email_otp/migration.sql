-- CreateEnum
CREATE TYPE "JobAlertStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobAlertTier" AS ENUM ('HIGHLY_RELEVANT', 'RELEVANT', 'NOT_RELEVANT');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_CHANGE');

-- AlterTable
ALTER TABLE "candidate_preferences" ADD COLUMN IF NOT EXISTS "job_alerts_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_alert_outbox" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "JobAlertStatus" NOT NULL DEFAULT 'PENDING',
    "relevance_score" DOUBLE PRECISION NOT NULL,
    "relevance_tier" "JobAlertTier" NOT NULL DEFAULT 'RELEVANT',
    "reason_evidence" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "provider_message_id" TEXT,
    "failed_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_alert_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'SIGNUP',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "resend_after" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "job_alert_outbox_candidate_id_job_id_key" ON "job_alert_outbox"("candidate_id", "job_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_alert_outbox_status_created_at_idx" ON "job_alert_outbox"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_alert_outbox_email_idx" ON "job_alert_outbox"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_otps_email_purpose_idx" ON "email_otps"("email", "purpose");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_otps_expires_at_idx" ON "email_otps"("expires_at");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'job_alert_outbox_candidate_id_fkey'
    ) THEN
        ALTER TABLE "job_alert_outbox" ADD CONSTRAINT "job_alert_outbox_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'job_alert_outbox_job_id_fkey'
    ) THEN
        ALTER TABLE "job_alert_outbox" ADD CONSTRAINT "job_alert_outbox_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
