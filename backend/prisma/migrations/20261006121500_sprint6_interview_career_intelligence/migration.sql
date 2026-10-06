-- CreateEnum
CREATE TYPE "InterviewQuestionType" AS ENUM ('TECHNICAL', 'BEHAVIORAL', 'RESUME_BASED', 'ROLE_SPECIFIC', 'SKILL_GAP', 'GENERAL');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LearningItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SkillGapClassification" AS ENUM ('VERIFIED', 'PARTIAL', 'MISSING');

-- CreateTable
CREATE TABLE "interview_preparation_sessions" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "resume_version_id" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "title" TEXT NOT NULL DEFAULT 'Interview Preparation Session',
    "input_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_preparation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" "InterviewQuestionType" NOT NULL DEFAULT 'TECHNICAL',
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "question" TEXT NOT NULL,
    "context" TEXT,
    "suggested_answer_guide" TEXT,
    "source_skill" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_answers" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_evaluations" (
    "id" TEXT NOT NULL,
    "answer_id" TEXT NOT NULL,
    "clarity_score" INTEGER NOT NULL,
    "accuracy_score" INTEGER,
    "relevance_score" INTEGER NOT NULL,
    "structure_score" INTEGER NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missing_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feedback" TEXT NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_plans" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "job_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "target_role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_plan_items" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "classification" "SkillGapClassification" NOT NULL DEFAULT 'MISSING',
    "priority" TEXT NOT NULL DEFAULT 'HIGH',
    "rationale" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "status" "LearningItemStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "target_date" TIMESTAMP(3),
    "verified_resources" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_progress" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "status" "LearningItemStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "hours_spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_track_assessments" (
    "id" TEXT NOT NULL,
    "candidate_profile_id" TEXT NOT NULL,
    "current_track" TEXT NOT NULL,
    "target_track" TEXT NOT NULL,
    "readiness_score" INTEGER NOT NULL,
    "is_same_track" BOOLEAN NOT NULL DEFAULT true,
    "transition_gap_explanation" TEXT,
    "verified_strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transferable_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missing_priorities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence_basis" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_track_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_preparation_sessions_candidate_profile_id_idx" ON "interview_preparation_sessions"("candidate_profile_id");

-- CreateIndex
CREATE INDEX "interview_preparation_sessions_job_id_idx" ON "interview_preparation_sessions"("job_id");

-- CreateIndex
CREATE INDEX "interview_questions_session_id_idx" ON "interview_questions"("session_id");

-- CreateIndex
CREATE INDEX "interview_questions_type_idx" ON "interview_questions"("type");

-- CreateIndex
CREATE INDEX "interview_answers_question_id_idx" ON "interview_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_evaluations_answer_id_key" ON "interview_evaluations"("answer_id");

-- CreateIndex
CREATE INDEX "learning_plans_candidate_profile_id_idx" ON "learning_plans"("candidate_profile_id");

-- CreateIndex
CREATE INDEX "learning_plans_job_id_idx" ON "learning_plans"("job_id");

-- CreateIndex
CREATE INDEX "learning_plan_items_plan_id_idx" ON "learning_plan_items"("plan_id");

-- CreateIndex
CREATE INDEX "learning_plan_items_skill_name_idx" ON "learning_plan_items"("skill_name");

-- CreateIndex
CREATE INDEX "learning_progress_item_id_idx" ON "learning_progress"("item_id");

-- CreateIndex
CREATE INDEX "career_track_assessments_candidate_profile_id_idx" ON "career_track_assessments"("candidate_profile_id");

-- AddForeignKey
ALTER TABLE "interview_preparation_sessions" ADD CONSTRAINT "interview_preparation_sessions_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_preparation_sessions" ADD CONSTRAINT "interview_preparation_sessions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_preparation_sessions" ADD CONSTRAINT "interview_preparation_sessions_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_preparation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "interview_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_plan_items" ADD CONSTRAINT "learning_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "learning_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "learning_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_track_assessments" ADD CONSTRAINT "career_track_assessments_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
