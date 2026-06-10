ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "insurance_carrier" TEXT;
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "coverage_amount"   TEXT;
