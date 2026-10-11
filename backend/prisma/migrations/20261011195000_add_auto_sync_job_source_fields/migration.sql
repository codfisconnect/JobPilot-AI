-- AlterTable
ALTER TABLE "job_source_configurations" ADD COLUMN     "jobs_expired" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_sync_started_at" TIMESTAMP(3),
ADD COLUMN     "sync_in_progress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sync_lock_token" TEXT;
