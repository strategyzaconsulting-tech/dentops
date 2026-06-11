ALTER TABLE "users" ADD COLUMN "hire_date" DATE;
ALTER TABLE "users" ADD COLUMN "manager_id" UUID;

ALTER TABLE "users"
  ADD CONSTRAINT "users_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
