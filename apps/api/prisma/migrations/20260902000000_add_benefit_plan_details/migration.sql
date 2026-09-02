ALTER TABLE "practice_benefits"
  ADD COLUMN IF NOT EXISTS "provider_name" TEXT,
  ADD COLUMN IF NOT EXISTS "phone"         TEXT,
  ADD COLUMN IF NOT EXISTS "email"         TEXT,
  ADD COLUMN IF NOT EXISTS "website"       TEXT,
  ADD COLUMN IF NOT EXISTS "notes"         TEXT;
