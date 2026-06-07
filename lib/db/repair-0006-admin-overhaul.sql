-- Idempotent repair for a partially-applied 0006_admin_overhaul migration.
--
-- Symptom this fixes: every authenticated API route (/auth/me, /v1/videos,
-- /v1/accounts, /v1/alerts, ...) returns HTTP 500. Root cause: the api-server's
-- auth pre-handler runs usersRepository.findById, which SELECTs users.suspended_at
-- / suspended_by. Those columns are declared in the Drizzle schema but were never
-- added to the live DB because 0006 only partially applied. Postgres then throws
-- "column users.suspended_at does not exist" on every request.
--
-- Safe to run repeatedly: every statement is guarded (IF NOT EXISTS / exception
-- swallow), so it no-ops on anything 0006 already created.
--
-- The destructive accounts cleanup from 0006 (DROP COLUMN owner_kind / DROP TYPE
-- account_owner_kind) is intentionally omitted: an extra DB column does not break
-- Drizzle's explicit-column SELECTs, so it is not required to fix the 500s.

-- 1. users: suspend columns (the ones the auth path SELECTs).
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "suspended_by" uuid;

-- 2. posts: soft-delete columns + FK + index.
ALTER TABLE "public"."posts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "public"."posts" ADD COLUMN IF NOT EXISTS "deleted_by" uuid;
DO $$ BEGIN
  ALTER TABLE "public"."posts"
    ADD CONSTRAINT "posts_deleted_by_users_id_fk"
    FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "posts_deleted_at_idx" ON "public"."posts" ("deleted_at");

-- 3. admin_audit_log table (read by the admin dashboard).
CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "admin_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "action" varchar(64) NOT NULL,
  "target_type" varchar(32) NOT NULL,
  "target_id" uuid,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "admin_audit_log_admin_created_idx" ON "public"."admin_audit_log" ("admin_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_audit_log_target_idx" ON "public"."admin_audit_log" ("target_type", "target_id");
ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins_full_access_audit_log" ON "public"."admin_audit_log";
CREATE POLICY "admins_full_access_audit_log" ON "public"."admin_audit_log"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');
