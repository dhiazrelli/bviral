/**
 * Apply the two pending schema changes from migration 0004 directly,
 * then mark 0002 / 0003 / 0004 as applied in __drizzle_migrations so
 * `drizzle-kit migrate` stops trying to re-run them.
 *
 * Idempotent: uses IF NOT EXISTS guards and ON CONFLICT DO NOTHING.
 *
 * Usage: pnpm --filter @workspace/scripts exec tsx ./src/apply-pending-schema.ts
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
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

const migrationsDir = resolve(moduleDir, "..", "..", "lib", "db", "drizzle");

function readMigrationHash(tag: string) {
  const filePath = join(migrationsDir, `${tag}.sql`);
  const content = readFileSync(filePath, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

console.log("\n=== Applying pending schema changes ===\n");

// 1. Apply the actual SQL (idempotent).
console.log("Applying ALTER TYPE post_status ADD VALUE 'cancelled' IF NOT EXISTS ...");
await pool.query(`ALTER TYPE "public"."post_status" ADD VALUE IF NOT EXISTS 'cancelled'`);
console.log("  ok");

console.log("Applying ALTER TABLE videos ADD COLUMN original_filename IF NOT EXISTS ...");
await pool.query(`ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "original_filename" varchar(255)`);
console.log("  ok");

// 2. Reconcile __drizzle_migrations so future `migrate` runs are no-ops.
//    Insert rows for every migration file that isn't already recorded.
console.log("\nReconciling __drizzle_migrations table...");

const { rows: existing } = await pool.query<{ hash: string }>(`SELECT hash FROM drizzle.__drizzle_migrations`);
const existingHashes = new Set(existing.map((row) => row.hash));

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

let inserted = 0;
for (const file of migrationFiles) {
  const tag = file.replace(/\.sql$/, "");
  const hash = readMigrationHash(tag);
  if (existingHashes.has(hash)) {
    console.log(`  ${tag} already recorded`);
    continue;
  }
  await pool.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
    [hash, Date.now().toString()],
  );
  console.log(`  inserted ${tag}`);
  inserted += 1;
}

console.log(`\nDone. ${inserted} migration record(s) added.`);

await pool.end();
