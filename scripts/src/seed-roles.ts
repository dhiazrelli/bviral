/**
 * Seed script for role-aware dev environment.
 *
 * Creates:
 * - 1 admin user  (app_metadata.app_role = "admin")
 * - 1 content_creator user
 * - 1 creator-owned account, video, post, and analytics snapshot
 *
 * Usage: pnpm --filter @workspace/scripts tsx ./src/seed-roles.ts
 * Requires: DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
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
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }

    break;
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

// Dynamically import to avoid top-level issues
const { createClient } = await import("@supabase/supabase-js");
const { createPool, createDatabase } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const {
  usersTable,
  accountsTable,
  videosTable,
  postsTable,
  analyticsTable,
} = await import("@workspace/db");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pool = createPool(databaseUrl);
const db = createDatabase(pool);

async function ensureSupabaseUser(email: string, password: string, appRole: "admin" | "content_creator") {
  const listRes = await supabase.auth.admin.listUsers();
  const existing = listRes.data?.users.find((u) => u.email === email);

  if (existing) {
    console.log(`  Auth user exists: ${email} (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { app_role: appRole },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create auth user ${email}: ${error?.message}`);
  }

  console.log(`  Created auth user: ${email} (${data.user.id})`);
  return data.user.id;
}

async function ensureDbUser(
  id: string,
  email: string,
  fullName: string,
  role: "admin" | "content_creator",
) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (existing) {
    console.log(`  DB user exists: ${email}`);
    return existing;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ id, email, fullName, role })
    .onConflictDoNothing()
    .returning();

  console.log(`  Created DB user: ${email}`);
  return user;
}

console.log("\n=== Seeding roles ===\n");

// Admin
console.log("1. Admin user");
const adminId = await ensureSupabaseUser("admin@bviral.dev", "bviral-admin-2024!", "admin");
await ensureDbUser(adminId, "admin@bviral.dev", "BViral Admin", "admin");

// Content creator
console.log("\n2. Content creator");
const creatorId = await ensureSupabaseUser("creator@bviral.dev", "bviral-creator-2024!", "content_creator");
await ensureDbUser(creatorId, "creator@bviral.dev", "Demo Creator", "content_creator");

// Creator account
console.log("\n3. Creator account");
const [existingCreatorAccount] = await db
  .select()
  .from(accountsTable)
  .where(eq(accountsTable.userId, creatorId))
  .limit(1);

let creatorAccountId: string;
if (existingCreatorAccount) {
  console.log(`  Creator account exists: ${existingCreatorAccount.id}`);
  creatorAccountId = existingCreatorAccount.id;
} else {
  const [creatorAccount] = await db
    .insert(accountsTable)
    .values({
      platform: "tiktok",
      accountName: "demo_creator",
      accessToken: "seed-placeholder-token",
      userId: creatorId,
      metadata: { seeded: true },
    })
    .returning();

  console.log(`  Created creator account: ${creatorAccount.id}`);
  creatorAccountId = creatorAccount.id;
}

// Video for creator
console.log("\n4. Creator video");
const [existingVideo] = await db
  .select()
  .from(videosTable)
  .where(eq(videosTable.userId, creatorId))
  .limit(1);

let videoId: string;
if (existingVideo) {
  console.log(`  Video exists: ${existingVideo.id}`);
  videoId = existingVideo.id;
} else {
  const [video] = await db
    .insert(videosTable)
    .values({
      userId: creatorId,
      originalUrl: "https://example.com/seed-video.mp4",
      status: "ready",
    })
    .returning();

  console.log(`  Created video: ${video.id}`);
  videoId = video.id;
}

// Posts + analytics
console.log("\n5. Posts and analytics");
const [existingPost] = await db
  .select()
  .from(postsTable)
  .where(eq(postsTable.accountId, creatorAccountId))
  .limit(1);

if (existingPost) {
  console.log(`  Post exists: ${existingPost.id}`);
} else {
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() - 3);

  const [post] = await db
    .insert(postsTable)
    .values({
      videoId,
      accountId: creatorAccountId,
      platform: "tiktok",
      scheduledAt,
      postedAt: scheduledAt,
      status: "posted",
      externalPostId: "seed-external-post-id",
    })
    .returning();

  console.log(`  Created post: ${post.id}`);

  await db.insert(analyticsTable).values({
    postId: post.id,
    views: 12_500,
    likes: 840,
    comments: 120,
    shares: 67,
    revenue: 0,
  });

  console.log(`  Created analytics snapshot`);
}

console.log("\n=== Seed complete ===\n");
console.log("Accounts:");
console.log(`  Admin:   admin@bviral.dev  / bviral-admin-2024!`);
console.log(`  Creator: creator@bviral.dev / bviral-creator-2024!\n`);

await pool.end();
