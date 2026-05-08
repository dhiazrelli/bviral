import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  accountsTable,
  alertsTable,
  type AlertRecord,
  type Database,
  type NewAlertRecord,
  type NewPostRecord,
  type PostRecord,
  postsTable,
  videosTable,
} from "@workspace/db";

export type PostPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "snapchat";

export type PostStatus = "scheduled" | "posted" | "failed";

export interface PostResponseDto {
  id: string;
  videoId: string;
  accountId: string;
  platform: PostPlatform;
  scheduledAt: string;
  postedAt: string | null;
  status: PostStatus;
  externalPostId: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateScheduledPostPayload {
  videoId: string;
  accountId: string;
  platform: PostPlatform;
  scheduledAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateFailureAlertPayload {
  message: string;
  platform: PostPlatform;
  accountId: string;
  postId: string;
}

export interface PostsRepository {
  listForUser(userId: string): Promise<PostResponseDto[]>;
  listScheduledForPublishing(): Promise<Array<{
    post: PostResponseDto;
    userId: string;
  }>>;
  findForUser(postId: string, userId: string): Promise<PostResponseDto | null>;
  findWithAccountForUser(postId: string, userId: string): Promise<PostResponseDto | null>;
  createScheduled(input: CreateScheduledPostPayload): Promise<PostResponseDto>;
  deleteScheduledForUser(postId: string, userId: string): Promise<boolean>;
  userOwnsVideo(videoId: string, userId: string): Promise<boolean>;
  findOwnedAccountPlatform(
    accountId: string,
    userId: string,
  ): Promise<PostPlatform | null>;
  markPosted(postId: string, externalPostId: string): Promise<PostResponseDto | null>;
  markFailed(postId: string, errorMessage: string): Promise<PostResponseDto | null>;
  createFailureAlert(input: CreateFailureAlertPayload): Promise<AlertRecord>;
}

function serializePost(post: PostRecord): PostResponseDto {
  return {
    id: post.id,
    videoId: post.videoId,
    accountId: post.accountId,
    platform: post.platform,
    scheduledAt: post.scheduledAt.toISOString(),
    postedAt: post.postedAt?.toISOString() ?? null,
    status: post.status,
    externalPostId: post.externalPostId ?? null,
    errorMessage: post.errorMessage ?? null,
    metadata: post.metadata,
    createdAt: post.createdAt.toISOString(),
  };
}

export function buildPostsRepository(db: Database): PostsRepository {
  return {
    async listForUser(userId) {
      const posts = await db
        .select({ post: postsTable })
        .from(postsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
        .where(eq(accountsTable.userId, userId))
        .orderBy(desc(postsTable.scheduledAt));

      return posts.map(({ post }) => serializePost(post));
    },

    async listScheduledForPublishing() {
      const rows = await db
        .select({
          post: postsTable,
          userId: accountsTable.userId,
        })
        .from(postsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
        .where(eq(postsTable.status, "scheduled"))
        .orderBy(asc(postsTable.scheduledAt));

      return rows.map(({ post, userId }) => ({
        post: serializePost(post),
        userId,
      }));
    },

    async findForUser(postId, userId) {
      const [row] = await db
        .select({ post: postsTable })
        .from(postsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
        .where(and(
          eq(postsTable.id, postId),
          eq(accountsTable.userId, userId),
        ))
        .limit(1);

      return row ? serializePost(row.post) : null;
    },

    async findWithAccountForUser(postId, userId) {
      return this.findForUser(postId, userId);
    },

    async createScheduled(input) {
      const payload: NewPostRecord = {
        videoId: input.videoId,
        accountId: input.accountId,
        platform: input.platform,
        scheduledAt: input.scheduledAt,
        status: "scheduled",
        metadata: input.metadata ?? {},
      };

      const [post] = await db.insert(postsTable).values(payload).returning();
      return serializePost(post);
    },

    async deleteScheduledForUser(postId, userId) {
      const deleted = await db
        .delete(postsTable)
        .where(and(
          eq(postsTable.id, postId),
          eq(postsTable.status, "scheduled"),
          sql`exists (
            select 1 from ${accountsTable}
            where ${accountsTable.id} = ${postsTable.accountId}
              and ${accountsTable.userId} = ${userId}
          )`,
        ))
        .returning({ id: postsTable.id });

      return deleted.length > 0;
    },

    async userOwnsVideo(videoId, userId) {
      const [video] = await db
        .select({ id: videosTable.id })
        .from(videosTable)
        .where(and(
          eq(videosTable.id, videoId),
          eq(videosTable.userId, userId),
        ))
        .limit(1);

      return Boolean(video);
    },

    async findOwnedAccountPlatform(accountId, userId) {
      const [account] = await db
        .select({ platform: accountsTable.platform })
        .from(accountsTable)
        .where(and(
          eq(accountsTable.id, accountId),
          eq(accountsTable.userId, userId),
        ))
        .limit(1);

      return account?.platform ?? null;
    },

    async markPosted(postId, externalPostId) {
      const [post] = await db
        .update(postsTable)
        .set({
          status: "posted",
          postedAt: new Date(),
          externalPostId,
          errorMessage: null,
        })
        .where(eq(postsTable.id, postId))
        .returning();

      return post ? serializePost(post) : null;
    },

    async markFailed(postId, errorMessage) {
      const [post] = await db
        .update(postsTable)
        .set({
          status: "failed",
          errorMessage,
        })
        .where(eq(postsTable.id, postId))
        .returning();

      return post ? serializePost(post) : null;
    },

    async createFailureAlert(input) {
      const payload: NewAlertRecord = {
        type: "error",
        message: input.message,
        platform: input.platform,
        accountId: input.accountId,
        postId: input.postId,
      };

      const [alert] = await db.insert(alertsTable).values(payload).returning();
      return alert;
    },
  };
}
