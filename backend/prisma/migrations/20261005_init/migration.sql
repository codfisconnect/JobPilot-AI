-- Pilot Mama Production Schema Migration
-- Migration: 20261005_init
-- Target: PostgreSQL 16+

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CANDIDATE', 'EMPLOYER', 'INSTITUTE', 'ADMIN');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "ResumeStrategy" AS ENUM ('FULL', 'FOCUSED', 'TARGETED');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('TECHNICAL', 'SOFT', 'TOOL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CANDIDATE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "headline" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "bio" TEXT,
    "linkedin_url" TEXT,
    "github_url" TEXT,
    "portfolio_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_preferences" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "target_roles" TEXT[],
    "work_modes" "WorkMode"[],
    "preferred_locations" TEXT[],
    "min_salary" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_master" BOOLEAN NOT NULL DEFAULT false,
    "file_path" TEXT,
    "raw_text" TEXT,
    "parsed_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_versions" (
    "id" TEXT NOT NULL,
    "resume_id" TEXT NOT NULL,
    "job_id" TEXT,
    "version_name" TEXT NOT NULL,
    "strategy" "ResumeStrategy" NOT NULL DEFAULT 'TARGETED',
    "structured_content" JSONB NOT NULL,
    "pdf_path" TEXT,
    "docx_path" TEXT,
    "ats_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "company_domain" TEXT,
    "logo_url" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "headquarters" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institute_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "logo_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institute_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profiles_user_id_key" ON "candidate_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_preferences_candidate_profile_id_key" ON "candidate_preferences"("candidate_profile_id");

-- CreateIndex
CREATE INDEX "resumes_candidate_profile_id_idx" ON "resumes"("candidate_profile_id");

-- CreateIndex
CREATE INDEX "resume_versions_resume_id_idx" ON "resume_versions"("resume_id");

-- CreateIndex
CREATE UNIQUE INDEX "employer_profiles_user_id_key" ON "employer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "institute_profiles_user_id_key" ON "institute_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_preferences" ADD CONSTRAINT "candidate_preferences_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_profiles" ADD CONSTRAINT "employer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institute_profiles" ADD CONSTRAINT "institute_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
