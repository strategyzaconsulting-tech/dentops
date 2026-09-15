ALTER TABLE "practices" ADD COLUMN "lunch_break_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "practices" ADD COLUMN "lunch_break_minutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "practices" ADD COLUMN "lunch_break_window_start" TEXT NOT NULL DEFAULT '13:00';
ALTER TABLE "practices" ADD COLUMN "lunch_break_window_end" TEXT NOT NULL DEFAULT '14:00';
