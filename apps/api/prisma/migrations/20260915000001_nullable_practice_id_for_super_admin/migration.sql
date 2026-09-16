-- Allow super_admin users to have no practice association
ALTER TABLE "users" ALTER COLUMN "practice_id" DROP NOT NULL;
