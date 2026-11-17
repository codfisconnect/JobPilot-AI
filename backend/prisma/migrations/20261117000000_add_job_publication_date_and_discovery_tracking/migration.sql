-- AlterTable
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "source_published_at" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "first_discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "source_date_field" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "source_date_precision" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "source_timezone" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "date_source_type" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "raw_posting_date" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_source_published_at_idx" ON "jobs"("source_published_at");
CREATE INDEX IF NOT EXISTS "jobs_first_discovered_at_idx" ON "jobs"("first_discovered_at");

