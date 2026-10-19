-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'LINKEDIN', 'EMAIL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "candidate_profiles" 
ADD COLUMN IF NOT EXISTS "avatar_url" TEXT,
ADD COLUMN IF NOT EXISTS "auth_provider" "AuthProvider";

-- CreateTable
CREATE TABLE IF NOT EXISTS "provider_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_subject_id" TEXT NOT NULL,
    "provider_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "provider_accounts_provider_provider_subject_id_key" ON "provider_accounts"("provider", "provider_subject_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "provider_accounts_user_id_idx" ON "provider_accounts"("user_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
