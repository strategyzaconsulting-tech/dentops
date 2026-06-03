CREATE TABLE "practice_benefits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "practice_benefits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_benefits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "benefit_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "user_benefits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_benefits_user_id_benefit_id_key" UNIQUE ("user_id", "benefit_id")
);

ALTER TABLE "practice_benefits" ADD CONSTRAINT "practice_benefits_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_benefits" ADD CONSTRAINT "user_benefits_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_benefits" ADD CONSTRAINT "user_benefits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_benefits" ADD CONSTRAINT "user_benefits_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "practice_benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "practice_benefits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_benefits" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_benefits_isolation" ON "practice_benefits"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));

CREATE POLICY "user_benefits_isolation" ON "user_benefits"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));
