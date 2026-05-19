import { sql } from "drizzle-orm";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const platformValues = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
] as const;
export const platformEnum = pgEnum("platform", platformValues);

export const videoStatusValues = [
  "uploaded",
  "processing",
  "ready",
  "failed",
] as const;
export const videoStatusEnum = pgEnum("video_status", videoStatusValues);

export const postStatusValues = ["scheduled", "posted", "failed", "cancelled"] as const;
export const postStatusEnum = pgEnum("post_status", postStatusValues);

export const alertTypeValues = ["error", "copyright", "success"] as const;
export const alertTypeEnum = pgEnum("alert_type", alertTypeValues);

export const alertStatusValues = ["unresolved", "resolved"] as const;
export const alertStatusEnum = pgEnum("alert_status", alertStatusValues);

export const accountOwnerKindValues = ["user", "bviral_company"] as const;
export const accountOwnerKindEnum = pgEnum("account_owner_kind", accountOwnerKindValues);

export const accountsTable = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  platform: platformEnum("platform").notNull(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  ownerKind: accountOwnerKindEnum("owner_kind").default("bviral_company").notNull(),
  userId: uuid("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check(
    "accounts_owner_check",
    sql`(${table.ownerKind} = 'user' AND ${table.userId} IS NOT NULL) OR (${table.ownerKind} = 'bviral_company' AND ${table.userId} IS NULL)`,
  ),
  pgPolicy("admins_full_access_accounts", {
    for: "all",
    to: authenticatedRole,
    using: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
    withCheck: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
  }),
  pgPolicy("accounts_select_own", {
    for: "select",
    to: authenticatedRole,
    using: sql`${table.userId} = ${authUid}`,
  }),
  pgPolicy("accounts_insert_own", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${table.userId} = ${authUid}`,
  }),
  pgPolicy("accounts_update_own", {
    for: "update",
    to: authenticatedRole,
    using: sql`${table.userId} = ${authUid}`,
    withCheck: sql`${table.userId} = ${authUid}`,
  }),
  pgPolicy("accounts_delete_own", {
    for: "delete",
    to: authenticatedRole,
    using: sql`${table.userId} = ${authUid}`,
  }),
]).enableRLS();

export const videosTable = pgTable("videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  originalUrl: text("original_url").notNull(),
  originalFilename: varchar("original_filename", { length: 255 }),
  contentHash: varchar("content_hash", { length: 64 }),
  processedUrl: text("processed_url"),
  duration: integer("duration"),
  status: videoStatusEnum("status").default("uploaded").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("videos_user_content_hash_idx").on(table.userId, table.contentHash),
  pgPolicy("admins_full_access_videos", {
    for: "all",
    to: authenticatedRole,
    using: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
    withCheck: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
  }),
  pgPolicy("videos_select_own", {
    for: "select",
    to: authenticatedRole,
    using: sql`${table.userId} = ${authUid}`,
  }),
  pgPolicy("videos_insert_own", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${table.userId} = ${authUid}`,
  }),
  pgPolicy("videos_update_own", {
    for: "update",
    to: authenticatedRole,
    using: sql`${table.userId} = ${authUid}`,
    withCheck: sql`${table.userId} = ${authUid}`,
  }),
  pgPolicy("videos_delete_own", {
    for: "delete",
    to: authenticatedRole,
    using: sql`${table.userId} = ${authUid}`,
  }),
]).enableRLS();

export const postsTable = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: uuid("video_id").notNull().references(() => videosTable.id, {
    onDelete: "cascade",
  }),
  accountId: uuid("account_id").notNull().references(() => accountsTable.id, {
    onDelete: "cascade",
  }),
  platform: platformEnum("platform").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  status: postStatusEnum("status").default("scheduled").notNull(),
  externalPostId: varchar("external_post_id", { length: 255 }),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  const ownsAccount = sql`exists (
    select 1 from ${accountsTable}
    where ${accountsTable.id} = ${table.accountId}
      and ${accountsTable.userId} = ${authUid}
  )`;
  const ownsVideo = sql`exists (
    select 1 from ${videosTable}
    where ${videosTable.id} = ${table.videoId}
      and ${videosTable.userId} = ${authUid}
  )`;
  const ownsPost = sql`${ownsAccount} and ${ownsVideo}`;

  return [
    pgPolicy("admins_full_access_posts", {
      for: "all",
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
      withCheck: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
    }),
    pgPolicy("posts_select_own", {
      for: "select",
      to: authenticatedRole,
      using: ownsAccount,
    }),
    pgPolicy("posts_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: ownsPost,
    }),
    pgPolicy("posts_update_own", {
      for: "update",
      to: authenticatedRole,
      using: ownsAccount,
      withCheck: ownsPost,
    }),
    pgPolicy("posts_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: ownsAccount,
    }),
  ];
}).enableRLS();

export const analyticsTable = pgTable("analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => postsTable.id, {
    onDelete: "cascade",
  }),
  views: integer("views").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  comments: integer("comments").default(0).notNull(),
  shares: integer("shares").default(0).notNull(),
  revenue: numeric("revenue", {
    precision: 12,
    scale: 2,
    mode: "number",
  }).default(sql`0`).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  const ownsAnalyticsPost = sql`exists (
    select 1
    from ${postsTable}
    inner join ${accountsTable}
      on ${accountsTable.id} = ${postsTable.accountId}
    where ${postsTable.id} = ${table.postId}
      and ${accountsTable.userId} = ${authUid}
  )`;

  return [
    pgPolicy("admins_full_access_analytics", {
      for: "all",
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
      withCheck: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
    }),
    pgPolicy("analytics_select_own", {
      for: "select",
      to: authenticatedRole,
      using: ownsAnalyticsPost,
    }),
    pgPolicy("analytics_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: ownsAnalyticsPost,
    }),
    pgPolicy("analytics_update_own", {
      for: "update",
      to: authenticatedRole,
      using: ownsAnalyticsPost,
      withCheck: ownsAnalyticsPost,
    }),
    pgPolicy("analytics_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: ownsAnalyticsPost,
    }),
  ];
}).enableRLS();

export const alertsTable = pgTable("alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: alertTypeEnum("type").notNull(),
  status: alertStatusEnum("status").default("unresolved").notNull(),
  message: text("message").notNull(),
  platform: platformEnum("platform").notNull(),
  accountId: uuid("account_id").references(() => accountsTable.id, {
    onDelete: "set null",
  }),
  postId: uuid("post_id").references(() => postsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  const ownsAlert = sql`(
    (
      ${table.accountId} is not null
      and exists (
        select 1 from ${accountsTable}
        where ${accountsTable.id} = ${table.accountId}
          and ${accountsTable.userId} = ${authUid}
      )
    )
    or (
      ${table.postId} is not null
      and exists (
        select 1
        from ${postsTable}
        inner join ${accountsTable}
          on ${accountsTable.id} = ${postsTable.accountId}
        where ${postsTable.id} = ${table.postId}
          and ${accountsTable.userId} = ${authUid}
      )
    )
  )`;

  return [
    pgPolicy("admins_full_access_alerts", {
      for: "all",
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
      withCheck: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
    }),
    pgPolicy("alerts_select_own", {
      for: "select",
      to: authenticatedRole,
      using: ownsAlert,
    }),
    pgPolicy("alerts_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: ownsAlert,
    }),
    pgPolicy("alerts_update_own", {
      for: "update",
      to: authenticatedRole,
      using: ownsAlert,
      withCheck: ownsAlert,
    }),
    pgPolicy("alerts_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: ownsAlert,
    }),
  ];
}).enableRLS();

export type AccountOwnerKind = (typeof accountOwnerKindValues)[number];
export type AccountRecord = typeof accountsTable.$inferSelect;
export type NewAccountRecord = typeof accountsTable.$inferInsert;
export type VideoRecord = typeof videosTable.$inferSelect;
export type NewVideoRecord = typeof videosTable.$inferInsert;
export type PostRecord = typeof postsTable.$inferSelect;
export type NewPostRecord = typeof postsTable.$inferInsert;
export type AnalyticsRecord = typeof analyticsTable.$inferSelect;
export type NewAnalyticsRecord = typeof analyticsTable.$inferInsert;
export type AlertRecord = typeof alertsTable.$inferSelect;
export type NewAlertRecord = typeof alertsTable.$inferInsert;
