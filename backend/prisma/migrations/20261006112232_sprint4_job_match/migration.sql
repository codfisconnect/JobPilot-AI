-- CreateEnum
CREATE TYPE "MatchCategory" AS ENUM ('STRONG_MATCH', 'GOOD_MATCH', 'PARTIAL_MATCH', 'LOW_MATCH');

-- CreateTable
CREATE TABLE "job_matches" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "resume_version_id" TEXT,
    "overall_score" INTEGER NOT NULL,
    "category" "MatchCategory" NOT NULL DEFAULT 'PARTIAL_MATCH',
    "breakdown" JSONB NOT NULL,
    "truthCheck" JSONB NOT NULL,
    "careerTrack" JSONB NOT NULL,
    "ats_analysis" JSONB,
    "input_hash" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL DEFAULT '1.0.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_matches_candidate_profile_id_idx" ON "job_matches"("candidate_profile_id");

-- CreateIndex
CREATE INDEX "job_matches_job_id_idx" ON "job_matches"("job_id");

-- CreateIndex
CREATE INDEX "job_matches_overall_score_idx" ON "job_matches"("overall_score");

-- CreateIndex
CREATE UNIQUE INDEX "job_matches_candidate_profile_id_job_id_input_hash_key" ON "job_matches"("candidate_profile_id", "job_id", "input_hash");

-- AddForeignKey
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
