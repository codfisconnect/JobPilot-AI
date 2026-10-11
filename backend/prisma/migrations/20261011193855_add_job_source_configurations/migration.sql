-- CreateTable
CREATE TABLE "job_source_configurations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "company_source_id" TEXT,
    "source_url" TEXT NOT NULL,
    "jobs_endpoint" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'GENERIC',
    "parser_type" TEXT NOT NULL DEFAULT 'AUTO',
    "http_method" TEXT NOT NULL DEFAULT 'GET',
    "headers_config" JSONB,
    "mapping_config" JSONB,
    "discovery_metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "health_status" "SourceHealth" NOT NULL DEFAULT 'HEALTHY',
    "last_discovery_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "jobs_found" INTEGER NOT NULL DEFAULT 0,
    "jobs_created" INTEGER NOT NULL DEFAULT 0,
    "jobs_updated" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_source_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_source_configurations_company_id_idx" ON "job_source_configurations"("company_id");

-- CreateIndex
CREATE INDEX "job_source_configurations_source_url_idx" ON "job_source_configurations"("source_url");

-- CreateIndex
CREATE INDEX "job_source_configurations_jobs_endpoint_idx" ON "job_source_configurations"("jobs_endpoint");

-- AddForeignKey
ALTER TABLE "job_source_configurations" ADD CONSTRAINT "job_source_configurations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_source_configurations" ADD CONSTRAINT "job_source_configurations_company_source_id_fkey" FOREIGN KEY ("company_source_id") REFERENCES "company_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
