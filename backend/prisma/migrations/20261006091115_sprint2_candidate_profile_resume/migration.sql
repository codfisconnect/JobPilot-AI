-- CreateEnum
CREATE TYPE "ResumeStatus" AS ENUM ('UPLOADED', 'PARSING', 'PARSED', 'PARSE_REVIEW_REQUIRED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResumeSource" AS ENUM ('UPLOADED', 'GENERATED');

-- CreateEnum
CREATE TYPE "SkillSource" AS ENUM ('MANUAL', 'RESUME', 'IMPORTED');

-- AlterTable
ALTER TABLE "candidate_preferences" ADD COLUMN     "employment_type" TEXT,
ADD COLUMN     "max_salary" INTEGER,
ADD COLUMN     "notice_period" TEXT,
ADD COLUMN     "preferred_countries" TEXT[],
ADD COLUMN     "preferred_work_arrangement" TEXT,
ADD COLUMN     "remote_preference" TEXT,
ADD COLUMN     "salary_expectations" TEXT,
ADD COLUMN     "willing_to_relocate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "candidate_profiles" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "state_province" TEXT,
ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "resume_versions" ADD COLUMN     "content_snapshot" JSONB,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'Resume Version',
ADD COLUMN     "version_number" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "original_file_name" TEXT,
ADD COLUMN     "parsed_at" TIMESTAMP(3),
ADD COLUMN     "source" "ResumeSource" NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN     "status" "ResumeStatus" NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN     "storage_key" TEXT,
ADD COLUMN     "storage_provider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "title" SET DEFAULT 'Master Resume';

-- CreateTable
CREATE TABLE "experiences" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "location" TEXT,
    "employment_type" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educations" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field_of_study" TEXT,
    "location" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "grade_gpa" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuing_organization" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "credential_id" TEXT,
    "credential_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL DEFAULT 'TECHNICAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_skills" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "proficiency" TEXT,
    "years_of_experience" DOUBLE PRECISION,
    "source" "SkillSource" NOT NULL DEFAULT 'MANUAL',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role" TEXT,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "url" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "experiences_candidate_profile_id_idx" ON "experiences"("candidate_profile_id");

-- CreateIndex
CREATE INDEX "educations_candidate_profile_id_idx" ON "educations"("candidate_profile_id");

-- CreateIndex
CREATE INDEX "certifications_candidate_profile_id_idx" ON "certifications"("candidate_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "candidate_skills_candidate_profile_id_idx" ON "candidate_skills"("candidate_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_skills_candidate_profile_id_skill_id_key" ON "candidate_skills"("candidate_profile_id", "skill_id");

-- CreateIndex
CREATE INDEX "projects_candidate_profile_id_idx" ON "projects"("candidate_profile_id");

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educations" ADD CONSTRAINT "educations_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
