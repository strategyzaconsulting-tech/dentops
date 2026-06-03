CREATE TABLE "onboarding_checklists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "i9_completed_at" TIMESTAMPTZ,
    "w4_completed_at" TIMESTAMPTZ,
    "personal_info_completed_at" TIMESTAMPTZ,
    "emergency_contact_completed_at" TIMESTAMPTZ,
    "direct_deposit_completed_at" TIMESTAMPTZ,
    "i9_data" JSONB,
    "w4_data" JSONB,
    "personal_info_data" JSONB,
    "emergency_contact_data" JSONB,
    "direct_deposit_data" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "onboarding_checklists_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "onboarding_checklists_practice_id_user_id_key" UNIQUE ("practice_id", "user_id")
);

CREATE TABLE "equipment_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "onboarding_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "serial_number" TEXT,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "returned_at" TIMESTAMPTZ,
    "notes" TEXT,
    CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "office_manuals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "office_manuals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "office_manuals_practice_id_key" UNIQUE ("practice_id")
);

CREATE TABLE "manual_signatures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "manual_id" UUID NOT NULL,
    "practice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "signed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "manual_signatures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "manual_signatures_manual_id_user_id_key" UNIQUE ("manual_id", "user_id")
);

CREATE TABLE "training_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trainer_id" UUID,
    "topic" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "onboarding_checklists" ADD CONSTRAINT "onboarding_checklists_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_checklists" ADD CONSTRAINT "onboarding_checklists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "onboarding_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "office_manuals" ADD CONSTRAINT "office_manuals_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "manual_signatures" ADD CONSTRAINT "manual_signatures_manual_id_fkey" FOREIGN KEY ("manual_id") REFERENCES "office_manuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manual_signatures" ADD CONSTRAINT "manual_signatures_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manual_signatures" ADD CONSTRAINT "manual_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "onboarding_checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "office_manuals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manual_signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_checklists_isolation" ON "onboarding_checklists"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));

CREATE POLICY "equipment_items_isolation" ON "equipment_items"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));

CREATE POLICY "office_manuals_isolation" ON "office_manuals"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));

CREATE POLICY "manual_signatures_isolation" ON "manual_signatures"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));

CREATE POLICY "training_sessions_isolation" ON "training_sessions"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));
