-- CreateEnum
CREATE TYPE "EmployerRole" AS ENUM ('OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER');

-- CreateEnum
CREATE TYPE "EmployerJobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EmployerApplicationStage" AS ENUM ('NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrgVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "organization_job_status" "EmployerJobStatus";

-- CreateTable
CREATE TABLE "employer_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "company_id" TEXT,
    "verification_status" "OrgVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "website" TEXT,
    "logo_url" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "headquarters" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employer_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "EmployerRole" NOT NULL DEFAULT 'RECRUITER',
    "title" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employer_application_reviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "stage" "EmployerApplicationStage" NOT NULL DEFAULT 'NEW',
    "rating" INTEGER,
    "notes" TEXT,
    "reviewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_application_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employer_organizations_slug_key" ON "employer_organizations"("slug");

-- CreateIndex
CREATE INDEX "employer_organizations_name_idx" ON "employer_organizations"("name");

-- CreateIndex
CREATE INDEX "employer_organizations_company_id_idx" ON "employer_organizations"("company_id");

-- CreateIndex
CREATE INDEX "employer_members_organization_id_idx" ON "employer_members"("organization_id");

-- CreateIndex
CREATE INDEX "employer_members_user_id_idx" ON "employer_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employer_members_organization_id_user_id_key" ON "employer_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "employer_application_reviews_application_id_idx" ON "employer_application_reviews"("application_id");

-- CreateIndex
CREATE INDEX "employer_application_reviews_stage_idx" ON "employer_application_reviews"("stage");

-- CreateIndex
CREATE INDEX "jobs_organization_id_idx" ON "jobs"("organization_id");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "employer_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_organizations" ADD CONSTRAINT "employer_organizations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_members" ADD CONSTRAINT "employer_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "employer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_members" ADD CONSTRAINT "employer_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_application_reviews" ADD CONSTRAINT "employer_application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
