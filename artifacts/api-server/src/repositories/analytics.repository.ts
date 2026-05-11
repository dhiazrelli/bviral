import { and, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import {
  accountsTable,
  analyticsTable,
  type AnalyticsRecord,
  type Database,
  type NewAnalyticsRecord,
  postsTable,
  videosTable,
} from "@workspace/db";
import type { AccountPlatform } from "./accounts.repository";

export interface AnalyticsSnapshotDto {
  id: string;
  postId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  revenue: number;
  fetchedAt: string;
}

export interface AnalyticsTopPostDto {
  postId: string;
  platform: AccountPlatform;
  externalPostId: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  revenue: number;
  engagementRate: number;
  fetchedAt: string;
}

export interface AnalyticsPlatformTotalsDto {
  platform: AccountPlatform;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  revenue: number;
  posts: number;
}

export interface AnalyticsTimelinePointDto {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface AnalyticsOverviewDto {
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    revenue: number;
    posts: number;
    engagementRate: number;
  };
  byPlatform: AnalyticsPlatformTotalsDto[];
  timeline: AnalyticsTimelinePointDto[];
  topPosts: AnalyticsTopPostDto[];
}

export interface PostAnalyticsDto {
  postId: string;
  platform: AccountPlatform;
  externalPostId: string | null;
  latest: AnalyticsSnapshotDto | null;
  history: AnalyticsSnapshotDto[];
}

export interface PostedPostForAnalytics {
  postId: string;
  userId: string | null;
  accountId: string;
  platform: AccountPlatform;
  externalPostId: string;
  accountAccessToken: string;
  accountRefreshToken: string | null;
  accountTokenExpiry: string | null;
  accountMetadata: Record<string, unknown>;
}

export interface InsertAnalyticsSnapshotInput {
  postId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  revenue?: number;
}

export interface AnalyticsFilterParams {
  videoId?: string;
  creatorId?: string;
  platform?: AccountPlatform;
  from?: string;
  to?: string;
}

export interface AnalyticsRepository {
  getOverviewForUser(userId: string): Promise<AnalyticsOverviewDto>;
  getOverviewFiltered(filters: AnalyticsFilterParams): Promise<AnalyticsOverviewDto>;
  getPostAnalyticsForUser(postId: string, userId: string): Promise<PostAnalyticsDto | null>;
  listPostedPostsForRefresh(): Promise<PostedPostForAnalytics[]>;
  insertSnapshot(input: InsertAnalyticsSnapshotInput): Promise<AnalyticsSnapshotDto>;
}

interface JoinedAnalyticsRow {
  analytics: AnalyticsRecord;
  platform: AccountPlatform;
  externalPostId: string | null;
}

const analyticsPlatforms: AccountPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
];

function serializeSnapshot(record: AnalyticsRecord): AnalyticsSnapshotDto {
  return {
    id: record.id,
    postId: record.postId,
    views: record.views,
    likes: record.likes,
    comments: record.comments,
    shares: record.shares,
    revenue: record.revenue,
    fetchedAt: record.fetchedAt.toISOString(),
  };
}

function engagementRate(snapshot: Pick<AnalyticsSnapshotDto, "views" | "likes" | "comments" | "shares">) {
  if (snapshot.views <= 0) {
    return 0;
  }

  return Number((((snapshot.likes + snapshot.comments + snapshot.shares) / snapshot.views) * 100).toFixed(2));
}

function emptyPlatformTotals(platform: AccountPlatform): AnalyticsPlatformTotalsDto {
  return {
    platform,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    revenue: 0,
    posts: 0,
  };
}

function createOverview(rows: JoinedAnalyticsRow[]): AnalyticsOverviewDto {
  const latestByPost = new Map<string, JoinedAnalyticsRow>();

  for (const row of rows) {
    if (!latestByPost.has(row.analytics.postId)) {
      latestByPost.set(row.analytics.postId, row);
    }
  }

  const byPlatformMap = new Map<AccountPlatform, AnalyticsPlatformTotalsDto>();
  const timelineMap = new Map<string, AnalyticsTimelinePointDto>();

  for (const platform of analyticsPlatforms) {
    byPlatformMap.set(platform, emptyPlatformTotals(platform));
  }

  const topPosts: AnalyticsTopPostDto[] = [];
  const totals = {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    revenue: 0,
    posts: 0,
    engagementRate: 0,
  };

  for (const row of latestByPost.values()) {
    const snapshot = serializeSnapshot(row.analytics);
    const platformTotals = byPlatformMap.get(row.platform) ?? emptyPlatformTotals(row.platform);

    platformTotals.views += snapshot.views;
    platformTotals.likes += snapshot.likes;
    platformTotals.comments += snapshot.comments;
    platformTotals.shares += snapshot.shares;
    platformTotals.revenue += snapshot.revenue;
    platformTotals.posts += 1;
    byPlatformMap.set(row.platform, platformTotals);

    totals.views += snapshot.views;
    totals.likes += snapshot.likes;
    totals.comments += snapshot.comments;
    totals.shares += snapshot.shares;
    totals.revenue += snapshot.revenue;
    totals.posts += 1;

    topPosts.push({
      postId: snapshot.postId,
      platform: row.platform,
      externalPostId: row.externalPostId,
      views: snapshot.views,
      likes: snapshot.likes,
      comments: snapshot.comments,
      shares: snapshot.shares,
      revenue: snapshot.revenue,
      engagementRate: engagementRate(snapshot),
      fetchedAt: snapshot.fetchedAt,
    });

    const date = snapshot.fetchedAt.slice(0, 10);
    const timeline = timelineMap.get(date) ?? {
      date,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    };

    timeline.views += snapshot.views;
    timeline.likes += snapshot.likes;
    timeline.comments += snapshot.comments;
    timeline.shares += snapshot.shares;
    timelineMap.set(date, timeline);
  }

  totals.engagementRate = engagementRate(totals);

  return {
    totals,
    byPlatform: Array.from(byPlatformMap.values()),
    timeline: Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    topPosts: topPosts.sort((a, b) => b.views - a.views).slice(0, 10),
  };
}

export function buildAnalyticsRepository(db: Database): AnalyticsRepository {
  return {
    async getOverviewForUser(userId) {
      const rows = await db
        .select({
          analytics: analyticsTable,
          platform: postsTable.platform,
          externalPostId: postsTable.externalPostId,
        })
        .from(analyticsTable)
        .innerJoin(postsTable, eq(postsTable.id, analyticsTable.postId))
        .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
        .where(eq(accountsTable.userId, userId))
        .orderBy(desc(analyticsTable.fetchedAt));

      return createOverview(rows);
    },

    async getOverviewFiltered(filters) {
      const conditions: SQL[] = [];

      if (filters.videoId) {
        conditions.push(eq(postsTable.videoId, filters.videoId));
      }

      if (filters.creatorId) {
        conditions.push(eq(accountsTable.userId, filters.creatorId));
      }

      if (filters.platform) {
        conditions.push(eq(postsTable.platform, filters.platform));
      }

      if (filters.from) {
        conditions.push(sql`${analyticsTable.fetchedAt} >= ${filters.from}::timestamptz`);
      }

      if (filters.to) {
        conditions.push(sql`${analyticsTable.fetchedAt} <= ${filters.to}::timestamptz`);
      }

      const rows = await db
        .select({
          analytics: analyticsTable,
          platform: postsTable.platform,
          externalPostId: postsTable.externalPostId,
        })
        .from(analyticsTable)
        .innerJoin(postsTable, eq(postsTable.id, analyticsTable.postId))
        .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(analyticsTable.fetchedAt));

      return createOverview(rows);
    },

    async getPostAnalyticsForUser(postId, userId) {
      const [post] = await db
        .select({
          platform: postsTable.platform,
          externalPostId: postsTable.externalPostId,
        })
        .from(postsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
        .where(and(
          eq(postsTable.id, postId),
          eq(accountsTable.userId, userId),
        ))
        .limit(1);

      if (!post) {
        return null;
      }

      const history = await db
        .select()
        .from(analyticsTable)
        .where(eq(analyticsTable.postId, postId))
        .orderBy(desc(analyticsTable.fetchedAt));
      const serialized = history.map(serializeSnapshot);

      return {
        postId,
        platform: post.platform,
        externalPostId: post.externalPostId,
        latest: serialized[0] ?? null,
        history: serialized,
      };
    },

    async listPostedPostsForRefresh() {
      const rows = await db
        .select({
          postId: postsTable.id,
          userId: accountsTable.userId,
          accountId: accountsTable.id,
          platform: postsTable.platform,
          externalPostId: postsTable.externalPostId,
          accountAccessToken: accountsTable.accessToken,
          accountRefreshToken: accountsTable.refreshToken,
          accountTokenExpiry: accountsTable.tokenExpiry,
          accountMetadata: accountsTable.metadata,
        })
        .from(postsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
        .where(and(
          eq(postsTable.status, "posted"),
          isNotNull(postsTable.externalPostId),
          inArray(postsTable.platform, analyticsPlatforms),
        ));

      return rows
        .filter((row): row is typeof row & { externalPostId: string } => Boolean(row.externalPostId))
        .map((row) => ({
          ...row,
          accountTokenExpiry: row.accountTokenExpiry?.toISOString() ?? null,
        }));
    },

    async insertSnapshot(input) {
      const payload: NewAnalyticsRecord = {
        postId: input.postId,
        views: input.views,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
        revenue: input.revenue ?? 0,
      };
      const [record] = await db.insert(analyticsTable).values(payload).returning();

      return serializeSnapshot(record);
    },
  };
}
