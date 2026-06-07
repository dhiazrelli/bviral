import { and, asc, count, desc, eq, ilike, isNull, sql, sum, type SQL } from "drizzle-orm";
import {
  accountsTable,
  analyticsTable,
  type Database,
  postsTable,
  usersTable,
  videosTable,
} from "@workspace/db";
import type { VideoStatus } from "./videos.repository";

export interface AdminVideoRow {
  id: string;
  userId: string;
  originalUrl: string;
  originalFilename: string | null;
  processedUrl: string | null;
  duration: number | null;
  status: VideoStatus;
  createdAt: string;
  creator: {
    id: string;
    email: string;
    fullName: string;
  };
  postsCount: number;
  totalViews: number;
}

export interface AdminVideoListFilters {
  page: number;
  pageSize: number;
  search?: string;
  creatorId?: string;
  status?: VideoStatus;
  from?: string;
  to?: string;
  sort?: "createdAt" | "duration";
  order?: "asc" | "desc";
}

export interface AdminVideosRepository {
  list(filters: AdminVideoListFilters): Promise<{
    data: AdminVideoRow[];
    total: number;
  }>;
  findById(videoId: string): Promise<AdminVideoRow | null>;
  deleteById(videoId: string): Promise<boolean>;
}

export function buildAdminVideosRepository(db: Database): AdminVideosRepository {
  function baseQuery() {
    const postsCount = sql<number>`(
      select count(*)::int from ${postsTable}
      where ${postsTable.videoId} = ${videosTable.id}
        and ${postsTable.deletedAt} is null
    )`;
    const totalViews = sql<number>`(
      select coalesce(sum(${analyticsTable.views})::int, 0) from ${analyticsTable}
      inner join ${postsTable} on ${postsTable.id} = ${analyticsTable.postId}
      where ${postsTable.videoId} = ${videosTable.id}
    )`;

    return db
      .select({
        video: videosTable,
        user: {
          id: usersTable.id,
          email: usersTable.email,
          fullName: usersTable.fullName,
        },
        postsCount,
        totalViews,
      })
      .from(videosTable)
      .innerJoin(usersTable, eq(usersTable.id, videosTable.userId));
  }

  function buildConditions(filters: AdminVideoListFilters | { creatorId?: string; status?: VideoStatus; from?: string; to?: string; search?: string }) {
    const conditions: SQL[] = [];
    if ("creatorId" in filters && filters.creatorId) {
      conditions.push(eq(videosTable.userId, filters.creatorId));
    }
    if ("status" in filters && filters.status) {
      conditions.push(eq(videosTable.status, filters.status));
    }
    if ("from" in filters && filters.from) {
      conditions.push(sql`${videosTable.createdAt} >= ${filters.from}::timestamptz`);
    }
    if ("to" in filters && filters.to) {
      conditions.push(sql`${videosTable.createdAt} <= ${filters.to}::timestamptz`);
    }
    if ("search" in filters && filters.search) {
      const term = `%${filters.search}%`;
      const c = ilike(videosTable.originalFilename, term);
      if (c) conditions.push(c);
    }
    return conditions;
  }

  function serialize(row: {
    video: typeof videosTable.$inferSelect;
    user: { id: string; email: string; fullName: string };
    postsCount: number;
    totalViews: number;
  }): AdminVideoRow {
    return {
      id: row.video.id,
      userId: row.video.userId,
      originalUrl: row.video.originalUrl,
      originalFilename: row.video.originalFilename ?? null,
      processedUrl: row.video.processedUrl ?? null,
      duration: row.video.duration ?? null,
      status: row.video.status,
      createdAt: row.video.createdAt.toISOString(),
      creator: row.user,
      postsCount: Number(row.postsCount ?? 0),
      totalViews: Number(row.totalViews ?? 0),
    };
  }

  return {
    async list(filters) {
      const conditions = buildConditions(filters);
      const whereClause = conditions.length === 0
        ? undefined
        : conditions.length === 1 ? conditions[0] : and(...conditions);

      const sortColumn = filters.sort === "duration" ? videosTable.duration : videosTable.createdAt;
      const orderFn = filters.order === "asc" ? asc : desc;
      const offset = (filters.page - 1) * filters.pageSize;

      const rows = await baseQuery()
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(filters.pageSize)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(videosTable)
        .innerJoin(usersTable, eq(usersTable.id, videosTable.userId))
        .where(whereClause);

      return {
        data: rows.map(serialize),
        total: Number(total ?? 0),
      };
    },

    async findById(videoId) {
      const [row] = await baseQuery()
        .where(eq(videosTable.id, videoId))
        .limit(1);

      return row ? serialize(row) : null;
    },

    async deleteById(videoId) {
      const deleted = await db
        .delete(videosTable)
        .where(eq(videosTable.id, videoId))
        .returning({ id: videosTable.id });
      return deleted.length > 0;
    },
  };
}
