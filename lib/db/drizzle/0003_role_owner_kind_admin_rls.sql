-- Phase 1: Rename user_role enum value member → content_creator
ALTER TYPE "public"."user_role" RENAME VALUE 'member' TO 'content_creator';

-- Update default on users.role column (enum rename is in-place, default text changes)
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DEFAULT 'content_creator';

--> statement-breakpoint

-- Phase 2: Add account_owner_kind enum
CREATE TYPE "public"."account_owner_kind" AS ENUM('user', 'bviral_company');

--> statement-breakpoint

-- Phase 3: Add owner_kind column with default bviral_company (non-breaking, nullable first)
ALTER TABLE "public"."accounts" ADD COLUMN "owner_kind" "public"."account_owner_kind" NOT NULL DEFAULT 'bviral_company';

--> statement-breakpoint

-- Phase 4: Make user_id nullable (existing rows keep their values; the CHECK enforces consistency)
ALTER TABLE "public"."accounts" ALTER COLUMN "user_id" DROP NOT NULL;

--> statement-breakpoint

-- Phase 5: Backfill existing rows – they are all user-owned, so set owner_kind = 'user'
UPDATE "public"."accounts" SET "owner_kind" = 'user' WHERE "user_id" IS NOT NULL;

--> statement-breakpoint

-- Phase 6: Add CHECK constraint for owner/user_id consistency
ALTER TABLE "public"."accounts"
  ADD CONSTRAINT "accounts_owner_check"
  CHECK (
    ("owner_kind" = 'user' AND "user_id" IS NOT NULL)
    OR
    ("owner_kind" = 'bviral_company' AND "user_id" IS NULL)
  );

--> statement-breakpoint

-- Phase 7: Admin-bypass RLS policies

-- users table
CREATE POLICY "admins_full_access_users" ON "public"."users"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

--> statement-breakpoint

-- accounts table
CREATE POLICY "admins_full_access_accounts" ON "public"."accounts"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

--> statement-breakpoint

-- videos table
CREATE POLICY "admins_full_access_videos" ON "public"."videos"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

--> statement-breakpoint

-- posts table
CREATE POLICY "admins_full_access_posts" ON "public"."posts"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

--> statement-breakpoint

-- analytics table
CREATE POLICY "admins_full_access_analytics" ON "public"."analytics"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');

--> statement-breakpoint

-- alerts table
CREATE POLICY "admins_full_access_alerts" ON "public"."alerts"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');
