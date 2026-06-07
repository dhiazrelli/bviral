/**
 * Applies lib/db/drizzle/0006_admin_overhaul.sql against DATABASE_URL.
 *
 * Workaround for `drizzle-kit migrate` failing without a fresh snapshot,
 * and `drizzle-kit push` not knowing to sequence DELETE before SET NOT NULL.
 *
 * Idempotent-ish: each statement uses IF EXISTS / IF NOT EXISTS where possible
 * so re-runs after partial application won't crash the whole script.
 *
 * Usage: pnpm --filter @workspace/scripts exec tsx ./src/apply-admin-migration.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(moduleDir, "..", "..", ".env"),
  ];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const sep = line.indexOf("=");
      if (sep <= 0) continue;
      const key = line.slice(0, sep).trim();
      if (!key || process.env[key] !== undefined) continue;
      let value = line.slice(sep + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    break;
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const { createPool } = await import("@workspace/db");
const pool = createPool(databaseUrl);

type Step = { label: string; sql: string; tolerate?: (code: string) => boolean };

const steps: Step[] = [
  {
    label: "Delete bviral_company accounts (and cascade posts/analytics/alerts)",
    sql: `DELETE FROM "public"."accounts" WHERE "owner_kind" = 'bviral_company'`,
    tolerate: (code) => code === "42703", // column does not exist (already migrated)
  },
  {
    label: "Drop accounts_owner_check constraint",
    sql: `ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "accounts_owner_check"`,
  },
  {
    label: "Drop accounts.owner_kind column",
    sql: `ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "owner_kind"`,
  },
  {
    label: "Set accounts.user_id NOT NULL",
    sql: `ALTER TABLE "public"."accounts" ALTER COLUMN "user_id" SET NOT NULL`,
  },
  {
    label: "Drop account_owner_kind enum",
    sql: `DROP TYPE IF EXISTS "public"."account_owner_kind"`,
  },
  {
    label: "Add posts.deleted_at",
    sql: `ALTER TABLE "public"."posts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone`,
  },
  {
    label: "Add posts.deleted_by",
    sql: `ALTER TABLE "public"."posts" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL`,
  },
  {
    label: "Create posts_deleted_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "posts_deleted_at_idx" ON "public"."posts" ("deleted_at")`,
  },
  {
    label: "Drop old posts_select_own policy",
    sql: `DROP POLICY IF EXISTS "posts_select_own" ON "public"."posts"`,
  },
  {
    label: "Drop old posts_update_own policy",
    sql: `DROP POLICY IF EXISTS "posts_update_own" ON "public"."posts"`,
  },
  {
    label: "Drop old posts_delete_own policy",
    sql: `DROP POLICY IF EXISTS "posts_delete_own" ON "public"."posts"`,
  },
  {
    label: "Create posts_select_own (excluding soft-deleted)",
    sql: `CREATE POLICY "posts_select_own" ON "public"."posts"
            AS PERMISSIVE FOR SELECT TO "authenticated"
            USING (
              EXISTS (
                SELECT 1 FROM "public"."accounts"
                WHERE "accounts"."id" = "posts"."account_id"
                  AND "accounts"."user_id" = (SELECT auth.uid())
              )
              AND "posts"."deleted_at" IS NULL
            )`,
  },
  {
    label: "Create posts_update_own (excluding soft-deleted)",
    sql: `CREATE POLICY "posts_update_own" ON "public"."posts"
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
            )`,
  },
  {
    label: "Create posts_delete_own (excluding soft-deleted)",
    sql: `CREATE POLICY "posts_delete_own" ON "public"."posts"
            AS PERMISSIVE FOR DELETE TO "authenticated"
            USING (
              EXISTS (
                SELECT 1 FROM "public"."accounts"
                WHERE "accounts"."id" = "posts"."account_id"
                  AND "accounts"."user_id" = (SELECT auth.uid())
              )
              AND "posts"."deleted_at" IS NULL
            )`,
  },
  {
    label: "Add users.suspended_at",
    sql: `ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone`,
  },
  {
    label: "Add users.suspended_by",
    sql: `ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "suspended_by" uuid`,
  },
  {
    label: "Create admin_audit_log table",
    sql: `CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "admin_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
            "action" varchar(64) NOT NULL,
            "target_type" varchar(32) NOT NULL,
            "target_id" uuid,
            "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "created_at" timestamp with time zone NOT NULL DEFAULT now()
          )`,
  },
  {
    label: "Create admin_audit_log_admin_created_idx",
    sql: `CREATE INDEX IF NOT EXISTS "admin_audit_log_admin_created_idx" ON "public"."admin_audit_log" ("admin_id", "created_at")`,
  },
  {
    label: "Create admin_audit_log_target_idx",
    sql: `CREATE INDEX IF NOT EXISTS "admin_audit_log_target_idx" ON "public"."admin_audit_log" ("target_type", "target_id")`,
  },
  {
    label: "Enable RLS on admin_audit_log",
    sql: `ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY`,
  },
  {
    label: "Drop existing admins_full_access_audit_log policy",
    sql: `DROP POLICY IF EXISTS "admins_full_access_audit_log" ON "public"."admin_audit_log"`,
  },
  {
    label: "Create admins_full_access_audit_log policy",
    sql: `CREATE POLICY "admins_full_access_audit_log" ON "public"."admin_audit_log"
            AS PERMISSIVE FOR ALL TO "authenticated"
            USING ((auth.jwt() ->> 'app_role') = 'admin')
            WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin')`,
  },
];

console.log("\n=== Applying admin overhaul migration ===\n");

let failures = 0;
for (const step of steps) {
  try {
    await pool.query(step.sql);
    console.log(`  ✓ ${step.label}`);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (step.tolerate && e.code && step.tolerate(e.code)) {
      console.log(`  ↷ ${step.label} (already applied)`);
      continue;
    }
    console.error(`  ✗ ${step.label}`);
    console.error(`    ${e.code ?? ""} ${e.message ?? err}`);
    failures += 1;
  }
}

console.log(failures === 0 ? "\n=== Migration complete ===\n" : `\n=== Migration finished with ${failures} failure(s) ===\n`);
await pool.end();
process.exit(failures === 0 ? 0 : 1);
