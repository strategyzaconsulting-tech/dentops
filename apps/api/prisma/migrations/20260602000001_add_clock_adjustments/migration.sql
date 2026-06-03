CREATE TABLE "clock_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "punch_id" UUID,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clock_adjustments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "clock_adjustments" ADD CONSTRAINT "clock_adjustments_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clock_adjustments" ADD CONSTRAINT "clock_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clock_adjustments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clock_adjustments_isolation" ON "clock_adjustments"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));
