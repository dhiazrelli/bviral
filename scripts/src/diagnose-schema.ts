/**
 * Diagnostic: reports the actual state of the DB so we can see what
 * `drizzle-kit migrate` is choking on.
 *
 * Usage: pnpm --filter @workspace/scripts tsx ./src/diagnose-schema.ts
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

async function run(label: string, query: string) {
  console.log(`\n── ${label} ─────────────────────`);
  try {
    const { rows } = await pool.query(query);
    if (rows.length === 0) {
      console.log("  (no rows)");
    } else {
      for (const row of rows) {
        console.log("  " + JSON.stringify(row));
      }
    }
  } catch (error) {
    console.log("  ERROR:", error instanceof Error ? error.message : error);
  }
}

await run(
  "post_status enum values",
  `SELECT enumlabel FROM pg_enum
   WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'post_status')
   ORDER BY enumsortorder`,
);

await run(
  "videos columns",
  `SELECT column_name, data_type, character_maximum_length, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'videos'
   ORDER BY ordinal_position`,
);

await run(
  "__drizzle_migrations applied",
  `SELECT id, hash, created_at
   FROM drizzle.__drizzle_migrations
   ORDER BY created_at`,
);

await pool.end();
