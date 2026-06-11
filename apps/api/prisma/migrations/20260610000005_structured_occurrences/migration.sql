ALTER TABLE "employee_occurrences" ADD COLUMN IF NOT EXISTS "title"                  TEXT;
ALTER TABLE "employee_occurrences" ADD COLUMN IF NOT EXISTS "body"                   TEXT;
ALTER TABLE "employee_occurrences" ADD COLUMN IF NOT EXISTS "manager_id"             UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE "employee_occurrences" ADD COLUMN IF NOT EXISTS "manager_signed_at"      TIMESTAMPTZ;
ALTER TABLE "employee_occurrences" ADD COLUMN IF NOT EXISTS "manager_signature_name" TEXT;
ALTER TABLE "employee_occurrences" ADD COLUMN IF NOT EXISTS "staff_acknowledged_at"  TIMESTAMPTZ;
ALTER TABLE "employee_occurrences" ADD COLUMN IF NOT EXISTS "staff_signature_name"   TEXT;
