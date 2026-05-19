/**
 * Demo data seed — populates the database with a believable creator
 * dataset so the dashboard and analytics pages look alive on first launch.
 *
 * Idempotent: every row this script inserts is tagged metadata.seeded = "demo"
 * (or, for videos, a recognizable originalUrl prefix). Re-running the script
 * wipes only those rows before re-inserting.
 *
 * Requires `seed:roles` to have created the creator user first.
 *
 * Usage: pnpm --filter @workspace/scripts run seed:demo
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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const { createPool, createDatabase } = await import("@workspace/db");
const { and, eq, inArray, like, sql } = await import("drizzle-orm");
const {
  usersTable,
  accountsTable,
  videosTable,
  postsTable,
  analyticsTable,
  alertsTable,
} = await import("@workspace/db");

const pool = createPool(databaseUrl);
const db = createDatabase(pool);

const CREATOR_EMAIL = "creator@bviral.dev";
const DEMO_VIDEO_URL_PREFIX = "https://demo.bviral.dev/clips/";
const DEMO_METADATA = { seeded: "demo" as const };

type Platform = "facebook" | "instagram" | "tiktok" | "youtube" | "snapchat";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// ---------- 1. Locate creator user ----------

console.log("\n=== Demo seed ===\n");

const [creator] = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, CREATOR_EMAIL))
  .limit(1);

if (!creator) {
  console.error(`Creator user ${CREATOR_EMAIL} not found. Run \`pnpm --filter @workspace/scripts run seed:roles\` first.`);
  await pool.end();
  process.exit(1);
}

console.log(`Creator: ${creator.email} (${creator.id})`);

// ---------- 2. Wipe previous demo data ----------

console.log("\nWiping previous demo data...");

const demoMetadataFilter = sql`${accountsTable.metadata}->>'seeded' = 'demo'`;
const demoPostMetadataFilter = sql`${postsTable.metadata}->>'seeded' = 'demo'`;

const previousAccountRows = await db
  .select({ id: accountsTable.id })
  .from(accountsTable)
  .where(demoMetadataFilter);
const previousAccountIds = previousAccountRows.map((row) => row.id);

const previousPostRows = previousAccountIds.length > 0
  ? await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(inArray(postsTable.accountId, previousAccountIds))
  : [];
const previousPostIds = previousPostRows.map((row) => row.id);

if (previousPostIds.length > 0) {
  await db.delete(analyticsTable).where(inArray(analyticsTable.postId, previousPostIds));
  await db.delete(alertsTable).where(inArray(alertsTable.postId, previousPostIds));
}

if (previousAccountIds.length > 0) {
  await db.delete(alertsTable).where(inArray(alertsTable.accountId, previousAccountIds));
  await db.delete(postsTable).where(inArray(postsTable.accountId, previousAccountIds));
  await db.delete(accountsTable).where(inArray(accountsTable.id, previousAccountIds));
}

await db
  .delete(videosTable)
  .where(and(eq(videosTable.userId, creator.id), like(videosTable.originalUrl, `${DEMO_VIDEO_URL_PREFIX}%`)));

await db.delete(postsTable).where(demoPostMetadataFilter);

console.log(`  Removed ${previousAccountIds.length} accounts, ${previousPostIds.length} posts.`);

// ---------- 3. Insert creator accounts ----------

const now = new Date();
const future = (days: number) => new Date(now.getTime() + days * DAY_MS);
const past = (days: number) => new Date(now.getTime() - days * DAY_MS);

const creatorAccountSeed: Array<{
  platform: Platform;
  accountName: string;
  tokenExpiry: Date | null;
}> = [
  { platform: "tiktok",    accountName: "marcus.everett",     tokenExpiry: past(3) },         // expired -> warning
  { platform: "instagram", accountName: "marcus_everett.ig",  tokenExpiry: future(4) },       // expiring soon -> warning
  { platform: "youtube",   accountName: "Marcus Everett",     tokenExpiry: future(60) },
  { platform: "facebook",  accountName: "Marcus Everett",     tokenExpiry: future(60) },
  { platform: "snapchat",  accountName: "marcuse",            tokenExpiry: future(60) },
];

console.log("\nInserting creator accounts...");
const creatorAccounts = await db
  .insert(accountsTable)
  .values(
    creatorAccountSeed.map((row) => ({
      platform: row.platform,
      accountName: row.accountName,
      accessToken: "demo-placeholder-token",
      refreshToken: "demo-placeholder-refresh",
      tokenExpiry: row.tokenExpiry,
      ownerKind: "user" as const,
      userId: creator.id,
      metadata: DEMO_METADATA,
    })),
  )
  .returning();
const accountByPlatform = new Map<Platform, typeof creatorAccounts[number]>();
for (const account of creatorAccounts) {
  accountByPlatform.set(account.platform, account);
  console.log(`  ${account.platform.padEnd(9)} ${account.accountName} (expires ${account.tokenExpiry?.toISOString().slice(0, 10) ?? "never"})`);
}

// ---------- 4. Insert BViral company accounts ----------

console.log("\nInserting BViral company accounts...");
const bviralAccounts = await db
  .insert(accountsTable)
  .values([
    {
      platform: "tiktok",
      accountName: "BViral Official",
      accessToken: "demo-placeholder-token",
      tokenExpiry: future(120),
      ownerKind: "bviral_company" as const,
      userId: null,
      metadata: DEMO_METADATA,
    },
    {
      platform: "youtube",
      accountName: "BViral Shorts",
      accessToken: "demo-placeholder-token",
      tokenExpiry: future(120),
      ownerKind: "bviral_company" as const,
      userId: null,
      metadata: DEMO_METADATA,
    },
  ])
  .returning();
for (const account of bviralAccounts) {
  console.log(`  ${account.platform.padEnd(9)} ${account.accountName}`);
}

// ---------- 5. Insert videos ----------

console.log("\nInserting videos...");
const videoCount = 14;
const videoSeed = Array.from({ length: videoCount }).map((_, index) => {
  const padded = (index + 1).toString().padStart(2, "0");
  return {
    userId: creator.id,
    originalUrl: `${DEMO_VIDEO_URL_PREFIX}clip-${padded}.mp4`,
    originalFilename: `clip-${padded}.mp4`,
    processedUrl: index === 12 ? null : `${DEMO_VIDEO_URL_PREFIX}clip-${padded}-processed.mp4`,
    duration: 18 + ((index * 7) % 75),
    status: index === 12 ? ("processing" as const) : index === 13 ? ("failed" as const) : ("ready" as const),
  };
});
const videos = await db.insert(videosTable).values(videoSeed).returning();
console.log(`  ${videos.length} videos inserted.`);

// ---------- 6. Build the post catalogue ----------

// Bias toward weekday evenings (Mon–Thu 18:00–21:00) and Sunday mornings so
// the heatmap and best-times grid pick up an intentional pattern.
function weightedPostedAt(seed: number) {
  const peakWindows: Array<{ jsDay: number; startHour: number; endHour: number }> = [
    { jsDay: 1, startHour: 18, endHour: 22 }, // Monday evening
    { jsDay: 2, startHour: 18, endHour: 22 }, // Tuesday evening
    { jsDay: 3, startHour: 18, endHour: 22 }, // Wednesday evening
    { jsDay: 4, startHour: 18, endHour: 22 }, // Thursday evening
    { jsDay: 0, startHour: 9, endHour: 12 },  // Sunday morning
  ];
  const offDays: Array<{ jsDay: number; startHour: number; endHour: number }> = [
    { jsDay: 5, startHour: 12, endHour: 18 }, // Friday afternoon
    { jsDay: 6, startHour: 15, endHour: 21 }, // Saturday evening
  ];

  // 65% of posts in peak windows, 25% in off windows, 10% scattered.
  const bucket = seed % 100;
  let window: { jsDay: number; startHour: number; endHour: number };
  if (bucket < 65) {
    window = peakWindows[seed % peakWindows.length];
  } else if (bucket < 90) {
    window = offDays[seed % offDays.length];
  } else {
    window = { jsDay: (seed * 3) % 7, startHour: 7, endHour: 22 };
  }

  // Random day within the last 60 days that matches `window.jsDay`.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const candidates: Date[] = [];
  for (let back = 0; back < 60; back += 1) {
    const day = new Date(today.getTime() - back * DAY_MS);
    if (day.getDay() === window.jsDay) candidates.push(day);
  }
  const chosenDay = candidates[seed % candidates.length] ?? today;
  const hour = window.startHour + (seed % (window.endHour - window.startHour));
  const minute = (seed * 7) % 60;
  return new Date(chosenDay.getFullYear(), chosenDay.getMonth(), chosenDay.getDate(), hour, minute, 0);
}

interface PostSeed {
  videoIndex: number;
  platform: Platform;
  status: "posted" | "scheduled" | "failed";
  postedAt?: Date;
  scheduledAt: Date;
  externalPostId: string | null;
  errorMessage: string | null;
  // Final view count after all snapshots have accumulated; 0 for non-posted.
  finalViews: number;
  // If set, override estimated revenue for one snapshot (the latest).
  storedRevenue?: number;
  // If true, this is a viral / breakout post (more comments-per-like).
  outlier?: "comments" | null;
}

// 24 posted, 6 scheduled, 2 failed. Platform mix biases toward TikTok + YouTube.
const platformDistribution: Platform[] = [
  "tiktok", "tiktok", "tiktok", "tiktok", "tiktok", "tiktok", "tiktok", "tiktok", "tiktok", "tiktok",
  "youtube", "youtube", "youtube", "youtube", "youtube", "youtube",
  "instagram", "instagram", "instagram", "instagram", "instagram",
  "facebook", "facebook", "facebook",
];

const postSeeds: PostSeed[] = [];

// Build 24 posted entries.
platformDistribution.forEach((platform, index) => {
  const postedAt = weightedPostedAt(index * 13 + 5);
  // 19 average (500–8,000), 3 breakouts (50k–200k), 1 viral on YouTube (~1.2M)
  let finalViews: number;
  if (index === 10) {
    finalViews = 1_240_000;            // viral
  } else if (index === 4 || index === 12 || index === 17) {
    finalViews = 55_000 + ((index * 9999) % 145_000); // breakout
  } else {
    finalViews = 600 + ((index * 487) % 7_400);       // average
  }
  postSeeds.push({
    videoIndex: index % videoCount,
    platform,
    status: "posted",
    postedAt,
    scheduledAt: postedAt,
    externalPostId: `demo-${platform}-${index.toString().padStart(3, "0")}`,
    errorMessage: null,
    finalViews,
    // Stored revenue on 3 specific posts (the rest use the estimator path).
    storedRevenue:
      index === 10 ? 310.00 : index === 4 ? 128.00 : index === 12 ? 42.50 : undefined,
    outlier: index === 17 ? "comments" : null,
  });
});

// 6 scheduled in the next 7 days (4 in next 24h).
for (let s = 0; s < 6; s += 1) {
  const offsetHours = s < 4 ? 3 + s * 4 : 36 + s * 18;
  const scheduledAt = new Date(now.getTime() + offsetHours * HOUR_MS);
  const platform: Platform = (["tiktok", "instagram", "youtube", "tiktok", "facebook", "youtube"] as Platform[])[s];
  postSeeds.push({
    videoIndex: (24 + s) % videoCount,
    platform,
    status: "scheduled",
    scheduledAt,
    externalPostId: null,
    errorMessage: null,
    finalViews: 0,
  });
}

// 2 failed in the last 5 days.
postSeeds.push({
  videoIndex: 9,
  platform: "tiktok",
  status: "failed",
  scheduledAt: past(2),
  postedAt: past(2),
  externalPostId: null,
  errorMessage: "TikTok rate limit exceeded — please retry in 1 hour.",
  finalViews: 0,
});
postSeeds.push({
  videoIndex: 11,
  platform: "instagram",
  status: "failed",
  scheduledAt: past(4),
  postedAt: past(4),
  externalPostId: null,
  errorMessage: "Instagram rejected media: aspect ratio outside supported range.",
  finalViews: 0,
});

console.log(`\nInserting ${postSeeds.length} posts...`);

const insertedPosts = await db
  .insert(postsTable)
  .values(
    postSeeds.map((seed) => {
      const account = accountByPlatform.get(seed.platform);
      if (!account) throw new Error(`Missing account for ${seed.platform}`);
      return {
        videoId: videos[seed.videoIndex].id,
        accountId: account.id,
        platform: seed.platform,
        scheduledAt: seed.scheduledAt,
        postedAt: seed.postedAt ?? null,
        status: seed.status,
        externalPostId: seed.externalPostId,
        errorMessage: seed.errorMessage,
        metadata: DEMO_METADATA,
      };
    }),
  )
  .returning();

console.log(`  ${insertedPosts.length} posts inserted.`);

// ---------- 7. Insert analytics snapshots ----------

const analyticsRows: Array<{
  postId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  revenue: number;
  fetchedAt: Date;
}> = [];

postSeeds.forEach((seed, index) => {
  if (seed.status !== "posted" || !seed.postedAt) return;
  const post = insertedPosts[index];
  const final = seed.finalViews;
  if (final <= 0) return;

  // Snapshot growth curve: ~15% → ~55% → 100% of finalViews, spaced ~9 days apart.
  const growthSteps = final > 50_000 ? [0.15, 0.55, 1.0] : final > 5_000 ? [0.45, 1.0] : [1.0];
  const totalSnapshots = growthSteps.length;
  growthSteps.forEach((fraction, step) => {
    // step 0 = earliest (most days back), step K-1 = latest (just past `now`).
    const daysBack = (totalSnapshots - 1 - step) * 9 + 1;
    const fetchedAt = new Date(now.getTime() - daysBack * DAY_MS);
    if (fetchedAt.getTime() < seed.postedAt!.getTime()) return;
    const views = Math.round(final * fraction);
    const likeRate = 0.04 + ((index * 11) % 6) / 100;
    const commentBoost = seed.outlier === "comments" ? 3.2 : 1.0;
    const likes = Math.round(views * likeRate);
    const comments = Math.round(views * (0.005 + ((index * 13) % 15) / 1000) * commentBoost);
    const shares = Math.round(views * (0.003 + ((index * 7) % 12) / 1000));
    const isLatestSnapshot = step === totalSnapshots - 1;
    const revenue = isLatestSnapshot && seed.storedRevenue !== undefined ? seed.storedRevenue : 0;
    analyticsRows.push({
      postId: post.id,
      views,
      likes,
      comments,
      shares,
      revenue,
      fetchedAt,
    });
  });
});

if (analyticsRows.length > 0) {
  await db.insert(analyticsTable).values(analyticsRows);
}
console.log(`\nInserted ${analyticsRows.length} analytics snapshots.`);

// ---------- 8. Insert alerts ----------

const youtubeAccount = accountByPlatform.get("youtube")!;
const tiktokAccount = accountByPlatform.get("tiktok")!;
const instagramAccount = accountByPlatform.get("instagram")!;
const viralPost = insertedPosts[10];

await db.insert(alertsTable).values([
  {
    type: "copyright",
    status: "unresolved",
    message: "Audio match on \"Midnight Drive\" — claim filed by Sony Music.",
    platform: "youtube",
    accountId: youtubeAccount.id,
    postId: insertedPosts[12].id,
  },
  {
    type: "error",
    status: "unresolved",
    message: "TikTok rate limit hit while publishing the 6pm queue.",
    platform: "tiktok",
    accountId: tiktokAccount.id,
    postId: null,
  },
  {
    type: "error",
    status: "unresolved",
    message: "Meta access token revoked — reconnect Instagram to keep posting.",
    platform: "instagram",
    accountId: instagramAccount.id,
    postId: null,
  },
  {
    type: "success",
    status: "unresolved",
    message: "Your YouTube short just crossed 1M views.",
    platform: "youtube",
    accountId: youtubeAccount.id,
    postId: viralPost.id,
  },
  {
    type: "error",
    status: "resolved",
    message: "Earlier TikTok publish retry succeeded.",
    platform: "tiktok",
    accountId: tiktokAccount.id,
    postId: null,
  },
  {
    type: "copyright",
    status: "resolved",
    message: "Audio dispute on \"Skyline Cruise\" — resolved in your favor.",
    platform: "instagram",
    accountId: instagramAccount.id,
    postId: null,
  },
  {
    type: "success",
    status: "resolved",
    message: "Instagram Reel hit 100k views.",
    platform: "instagram",
    accountId: instagramAccount.id,
    postId: null,
  },
]);

console.log("Inserted 7 alerts (4 unresolved, 3 resolved).");

console.log("\n=== Demo seed complete ===");
console.log(`Sign in as ${CREATOR_EMAIL} to see the populated dashboard.`);

await pool.end();
