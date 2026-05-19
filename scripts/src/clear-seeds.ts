/**
 * Removes every row inserted by `seed:roles` + `seed:demo`:
 *   - all alerts tied to seed accounts/posts
 *   - all analytics snapshots tied to those posts
 *   - all posts in those accounts
 *   - all videos owned by the seed creator
 *   - all creator accounts (user-owned) for the seed creator
 *   - all bviral_company accounts
 *
 * Idempotent: safe to re-run. Leaves the Supabase auth users + their
 * `users` table rows in place — delete those from the Supabase dashboard
 * if you want a truly clean slate.
 *
 * Usage: pnpm --filter @workspace/scripts exec tsx ./src/clear-seeds.ts
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

const CREATOR_EMAIL = "creator@bviral.dev";

async function pickCreatorId(): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [CREATOR_EMAIL],
  );
  return rows[0]?.id ?? null;
}

async function runStep(label: string, query: string, params: unknown[] = []) {
  const { rowCount } = await pool.query(query, params);
  console.log(`  ${label}: removed ${rowCount ?? 0}`);
}

console.log("\n=== Clearing seed data ===\n");

const creatorId = await pickCreatorId();

if (creatorId) {
  console.log(`Creator: ${CREATOR_EMAIL} (${creatorId})`);

  // 1. Alerts tied to creator accounts OR creator-owned posts.
  await runStep(
    "alerts (creator-owned)",
    `DELETE FROM alerts WHERE
       account_id IN (SELECT id FROM accounts WHERE user_id = $1)
       OR post_id IN (
         SELECT p.id FROM posts p
         INNER JOIN accounts a ON a.id = p.account_id
         WHERE a.user_id = $1
       )`,
    [creatorId],
  );

  // 2. Analytics snapshots for posts in creator accounts.
  await runStep(
    "analytics (creator posts)",
    `DELETE FROM analytics WHERE post_id IN (
       SELECT p.id FROM posts p
       INNER JOIN accounts a ON a.id = p.account_id
       WHERE a.user_id = $1
     )`,
    [creatorId],
  );

  // 3. Posts in creator accounts.
  await runStep(
    "posts (creator accounts)",
    `DELETE FROM posts WHERE account_id IN (
       SELECT id FROM accounts WHERE user_id = $1
     )`,
    [creatorId],
  );

  // 4. Videos owned by creator.
  await runStep(
    "videos (creator)",
    `DELETE FROM videos WHERE user_id = $1`,
    [creatorId],
  );

  // 5. Creator-owned accounts.
  await runStep(
    "accounts (creator)",
    `DELETE FROM accounts WHERE user_id = $1`,
    [creatorId],
  );
} else {
  console.log(`Creator ${CREATOR_EMAIL} not found — skipping creator-scoped cleanup.`);
}

// 6. Any BViral company accounts left over (from either seed).
//    Cascade-deletes posts/analytics referencing them. Alerts get
//    account_id nulled by FK ON DELETE SET NULL — clean those up next.
await runStep(
  "accounts (bviral_company)",
  `DELETE FROM accounts WHERE owner_kind = 'bviral_company'`,
);

// 7. Orphan alerts (account_id and post_id both NULL after cascades).
await runStep(
  "alerts (orphans)",
  `DELETE FROM alerts WHERE account_id IS NULL AND post_id IS NULL`,
);

console.log("\n=== Clear complete ===");
console.log("Auth users (admin@bviral.dev, creator@bviral.dev) and their `users` rows were left in place.");
console.log("To delete them too, remove them from the Supabase dashboard's Authentication > Users panel.\n");

await pool.end();
