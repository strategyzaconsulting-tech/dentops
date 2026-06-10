ALTER TABLE "clock_adjustments" ADD COLUMN "corrected_punch_in"  TIMESTAMPTZ;
ALTER TABLE "clock_adjustments" ADD COLUMN "corrected_punch_out" TIMESTAMPTZ;
ALTER TABLE "clock_adjustments" ADD COLUMN "reviewed_at"         TIMESTAMPTZ;
ALTER TABLE "clock_adjustments" ADD COLUMN "review_notes"        TEXT;
