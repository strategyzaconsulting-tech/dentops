CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_isolation" ON "announcements"
    FOR ALL TO authenticated
    USING (practice_id = ((auth.jwt() ->> 'practice_id')::uuid));
