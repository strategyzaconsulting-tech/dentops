CREATE TABLE "licenses" (
  "id"              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "practice_id"     UUID        NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  "user_id"         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "type"            TEXT        NOT NULL,
  "label"           TEXT,
  "license_number"  TEXT,
  "state"           TEXT,
  "issued_date"     DATE,
  "expiration_date" DATE,
  "notes"           TEXT,
  "alert_days"      INTEGER     NOT NULL DEFAULT 30,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "licenses_practice_id_idx" ON "licenses"("practice_id");
CREATE INDEX "licenses_user_id_idx" ON "licenses"("user_id");
