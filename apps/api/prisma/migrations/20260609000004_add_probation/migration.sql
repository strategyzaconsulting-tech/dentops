ALTER TABLE "users" ADD COLUMN "probation_days"          INTEGER;
ALTER TABLE "users" ADD COLUMN "probation_end_date"      DATE;
ALTER TABLE "users" ADD COLUMN "probation_status"        TEXT;
ALTER TABLE "users" ADD COLUMN "probation_notes"         TEXT;
ALTER TABLE "users" ADD COLUMN "probation_completed_at"  DATE;
ALTER TABLE "users" ADD COLUMN "probation_alert_days"    INTEGER;
ALTER TABLE "users" ADD COLUMN "benefits_eligible_at"    DATE;
