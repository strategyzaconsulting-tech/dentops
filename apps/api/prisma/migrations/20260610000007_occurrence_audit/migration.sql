-- Audit trail for occurrence log overrides
CREATE TABLE "occurrence_audits" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "occurrence_id" UUID      NOT NULL REFERENCES employee_occurrences(id) ON DELETE CASCADE,
  "practice_id" UUID        NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  "editor_id"   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "field"       TEXT        NOT NULL,
  "old_value"   TEXT,
  "new_value"   TEXT,
  "reason"      TEXT        NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "occurrence_audits_occurrence_id_idx" ON "occurrence_audits"("occurrence_id");
