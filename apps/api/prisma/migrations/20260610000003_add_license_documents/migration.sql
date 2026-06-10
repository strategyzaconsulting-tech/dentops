CREATE TABLE "license_documents" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "license_id"  UUID        NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  "practice_id" UUID        NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  "user_id"     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "file_name"   TEXT        NOT NULL,
  "file_size"   INTEGER     NOT NULL,
  "mime_type"   TEXT        NOT NULL,
  "file_data"   BYTEA       NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "license_documents_license_id_idx" ON "license_documents"("license_id");
