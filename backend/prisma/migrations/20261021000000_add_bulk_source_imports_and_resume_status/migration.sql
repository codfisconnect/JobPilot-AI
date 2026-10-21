-- AlterEnum
DO $$ BEGIN
    ALTER TYPE "ResumeStatus" ADD VALUE 'FILE_MISSING';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "ResumeStatus" ADD VALUE 'STORAGE_FAILED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "checksum" TEXT;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "BulkImportStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "BulkSourceItemStatus" AS ENUM ('QUEUED', 'VALIDATING', 'DISCOVERING', 'PAGINATING', 'NORMALIZING', 'PERSISTING', 'COMPLETED', 'PARTIAL', 'FAILED', 'ALREADY_CONNECTED', 'SKIPPED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "bulk_source_imports" (
    "id" TEXT NOT NULL,
    "created_by" TEXT,
    "status" "BulkImportStatus" NOT NULL DEFAULT 'QUEUED',
    "total_sources" INTEGER NOT NULL DEFAULT 0,
    "queued_sources" INTEGER NOT NULL DEFAULT 0,
    "running_sources" INTEGER NOT NULL DEFAULT 0,
    "completed_sources" INTEGER NOT NULL DEFAULT 0,
    "partial_sources" INTEGER NOT NULL DEFAULT 0,
    "failed_sources" INTEGER NOT NULL DEFAULT 0,
    "already_connected_sources" INTEGER NOT NULL DEFAULT 0,
    "skipped_sources" INTEGER NOT NULL DEFAULT 0,
    "total_jobs_discovered" INTEGER NOT NULL DEFAULT 0,
    "total_jobs_created" INTEGER NOT NULL DEFAULT 0,
    "total_jobs_updated" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "bulk_source_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bulk_source_items" (
    "id" TEXT NOT NULL,
    "bulk_job_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "normalized_url" TEXT,
    "company_name" TEXT,
    "company_hint" TEXT,
    "status" "BulkSourceItemStatus" NOT NULL DEFAULT 'QUEUED',
    "source_configuration_id" TEXT,
    "discovery_strategy" TEXT,
    "source_type" TEXT,
    "jobs_discovered" INTEGER NOT NULL DEFAULT 0,
    "jobs_created" INTEGER NOT NULL DEFAULT 0,
    "jobs_updated" INTEGER NOT NULL DEFAULT 0,
    "jobs_expired" INTEGER NOT NULL DEFAULT 0,
    "source_total" INTEGER,
    "pages_fetched" INTEGER NOT NULL DEFAULT 0,
    "pages_failed" INTEGER NOT NULL DEFAULT 0,
    "completeness" TEXT,
    "health_status" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_source_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bulk_source_items_bulk_job_id_idx" ON "bulk_source_items"("bulk_job_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bulk_source_items_source_url_idx" ON "bulk_source_items"("source_url");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bulk_source_items_status_idx" ON "bulk_source_items"("status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "bulk_source_items" ADD CONSTRAINT "bulk_source_items_bulk_job_id_fkey" FOREIGN KEY ("bulk_job_id") REFERENCES "bulk_source_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
