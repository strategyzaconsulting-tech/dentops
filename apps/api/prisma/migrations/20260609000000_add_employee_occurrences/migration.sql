CREATE TABLE "employee_occurrences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "practice_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "type" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "employee_occurrences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_occurrences_user_id_date_type_key" UNIQUE ("user_id", "date", "type")
);

ALTER TABLE "employee_occurrences"
  ADD CONSTRAINT "employee_occurrences_practice_id_fkey"
  FOREIGN KEY ("practice_id") REFERENCES "practices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_occurrences"
  ADD CONSTRAINT "employee_occurrences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
