CREATE TABLE "open_shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "specialty" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "open_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "open_shift_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "open_shift_id" UUID NOT NULL,
    "practice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "open_shift_claims_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "open_shifts" ADD CONSTRAINT "open_shifts_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "open_shifts" ADD CONSTRAINT "open_shifts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "open_shift_claims" ADD CONSTRAINT "open_shift_claims_open_shift_id_fkey" FOREIGN KEY ("open_shift_id") REFERENCES "open_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "open_shift_claims" ADD CONSTRAINT "open_shift_claims_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "open_shift_claims" ADD CONSTRAINT "open_shift_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "open_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "open_shift_claims" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_shifts_isolation" ON "open_shifts"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));

CREATE POLICY "open_shift_claims_isolation" ON "open_shift_claims"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));
