-- Admin overhaul migration:
--   * Remove BViral company-account feature (owner_kind enum, check constraint, column).
--   * Add soft-delete (deleted_at, deleted_by) to posts with RLS updates.
--   * Add suspended_at / suspended_by to users.
--   * Add admin_audit_log table (admin-only RLS).

-- 1. Drop the company-account rows then the constraint, column, and enum type.
DELETE FROM "public"."accounts" WHERE "owner_kind" = 'bviral_company';
--> statement-breakpoint
ALTER TABLE "public"."accounts" DROP CONSTRAINT "accounts_owner_check";
--> statement-breakpoint
ALTER TABLE "public"."accounts" DROP COLUMN "owner_kind";
--> statement-breakpoint
ALTER TABLE "public"."accounts" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
DROP TYPE "public"."account_owner_kind";
--> statement-breakpoint

-- 2. Soft-delete on posts.
ALTER TABLE "public"."posts" ADD COLUMN "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "public"."posts" ADD COLUMN "deleted_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "posts_deleted_at_idx" ON "public"."posts" ("deleted_at");
--> statement-breakpoint

-- Refresh creator-scoped policies to hide soft-deleted rows. Admin policy stays as-is.
DROP POLICY IF EXISTS "posts_select_own" ON "public"."posts";
--> statement-breakpoint
DROP POLICY IF EXISTS "posts_update_own" ON "public"."posts";
--> statement-breakpoint
DROP POLICY IF EXISTS "posts_delete_own" ON "public"."posts";
--> statement-breakpoint

CREATE POLICY "posts_select_own" ON "public"."posts"
  AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."accounts"
      WHERE "accounts"."id" = "posts"."account_id"
        AND "accounts"."user_id" = (SELECT auth.uid())
    )
    AND "posts"."deleted_at" IS NULL
  );
--> statement-breakpoint

CREATE POLICY "posts_update_own" ON "public"."posts"
  AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."accounts"
      WHERE "accounts"."id" = "posts"."account_id"
        AND "accounts"."user_id" = (SELECT auth.uid())
    )
    AND "posts"."deleted_at" IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."accounts"
      WHERE "accounts"."id" = "posts"."account_id"
        AND "accounts"."user_id" = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM "public"."videos"
      WHERE "videos"."id" = "posts"."video_id"
        AND "videos"."user_id" = (SELECT auth.uid())
    )
  );
--> statement-breakpoint

CREATE POLICY "posts_delete_own" ON "public"."posts"
  AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."accounts"
      WHERE "accounts"."id" = "posts"."account_id"
        AND "accounts"."user_id" = (SELECT auth.uid())
    )
    AND "posts"."deleted_at" IS NULL
  );
--> statement-breakpoint

-- 3. Suspend creators.
ALTER TABLE "public"."users" ADD COLUMN "suspended_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "public"."users" ADD COLUMN "suspended_by" uuid;
--> statement-breakpoint

-- 4. Admin audit log.
CREATE TABLE "public"."admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "admin_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "action" varchar(64) NOT NULL,
  "target_type" varchar(32) NOT NULL,
  "target_id" uuid,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "admin_audit_log_admin_created_idx" ON "public"."admin_audit_log" ("admin_id", "created_at");
--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_idx" ON "public"."admin_audit_log" ("target_type", "target_id");
--> statement-breakpoint
ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "admins_full_access_audit_log" ON "public"."admin_audit_log"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');
