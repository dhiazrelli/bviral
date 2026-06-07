import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  accountsTable,
  type Database,
  postsTable,
  usersTable,
  videosTable,
} from "@workspace/db";
import type { AccountPlatform } from "./accounts.repository";
import type { PostStatus } from "./posts.repository";

export interface AdminPostRow {
  id: string;
  videoId: string;
  accountId: string;
  platform: AccountPlatform;
  status: PostStatus;
  scheduledAt: string;
  postedAt: string | null;
  externalPostId: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  creator: {
    id: string;
    email: string;
    fullName: string;
  };
  account: {
    id: string;
    accountName: string;
    platform: AccountPlatform;
  };
  video: {
    id: string;
    originalFilename: string | null;
  };
}

export interface AdminPostListFilters {
  page: number;
  pageSize: number;
  search?: string;
  creatorId?: string;
  platform?: AccountPlatform;
  status?: PostStatus;
  accountId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  sort?: "scheduledAt" | "createdAt";
  order?: "asc" | "desc";
}

export interface AdminPostsRepository {
  list(filters: AdminPostListFilters): Promise<{
    data: AdminPostRow[];
    total: number;
  }>;
  listForCreator(creatorId: string, opts: { includeDeleted?: boolean }): Promise<AdminPostRow[]>;
  softDelete(postId: string, adminId: string): Promise<AdminPostRow | null>;
  restore(postId: string): Promise<AdminPostRow | null>;
  bulkSoftDelete(postIds: string[], adminId: string): Promise<string[]>;
  findById(postId: string): Promise<AdminPostRow | null>;
}

function rowToAdminPost(row: {
  post: typeof postsTable.$inferSelect;
  user: { id: string; email: string; fullName: string };
  account: { id: string; accountName: string; platform: AccountPlatform };
  video: { id: string; originalFilename: string | null };
}): AdminPostRow {
  const { post, user, account, video } = row;
  return {
    id: post.id,
    videoId: post.videoId,
    accountId: post.accountId,
    platform: post.platform,
    status: post.status,
    scheduledAt: post.scheduledAt.toISOString(),
    postedAt: post.postedAt?.toISOString() ?? null,
    externalPostId: post.externalPostId ?? null,
    errorMessage: post.errorMessage ?? null,
    metadata: post.metadata,
    deletedAt: post.deletedAt?.toISOString() ?? null,
    deletedBy: post.deletedBy ?? null,
    createdAt: post.createdAt.toISOString(),
    creator: user,
    account,
    video,
  };
}

const selectionShape = {
  post: postsTable,
  user: {
    id: usersTable.id,
    email: usersTable.email,
    fullName: usersTable.fullName,
  },
  account: {
    id: accountsTable.id,
    accountName: accountsTable.accountName,
    platform: accountsTable.platform,
  },
  video: {
    id: videosTable.id,
    originalFilename: videosTable.originalFilename,
  },
} as const;

export function buildAdminPostsRepository(db: Database): AdminPostsRepository {
  function buildBaseQuery() {
    return db
      .select(selectionShape)
      .from(postsTable)
      .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
      .innerJoin(usersTable, eq(usersTable.id, accountsTable.userId))
      .innerJoin(videosTable, eq(videosTable.id, postsTable.videoId));
  }

  function deletionFilter(opts: { includeDeleted?: boolean; onlyDeleted?: boolean }) {
    if (opts.onlyDeleted) {
      return isNotNull(postsTable.deletedAt);
    }
    if (opts.includeDeleted) {
      return undefined;
    }
    return isNull(postsTable.deletedAt);
  }

  return {
    async list(filters) {
      const conditions: SQL[] = [];
      const deletion = deletionFilter(filters);
      if (deletion) conditions.push(deletion);

      if (filters.creatorId) conditions.push(eq(accountsTable.userId, filters.creatorId));
      if (filters.platform) conditions.push(eq(postsTable.platform, filters.platform));
      if (filters.status) conditions.push(eq(postsTable.status, filters.status));
      if (filters.accountId) conditions.push(eq(postsTable.accountId, filters.accountId));
      if (filters.from) conditions.push(sql`${postsTable.scheduledAt} >= ${filters.from}::timestamptz`);
      if (filters.to) conditions.push(sql`${postsTable.scheduledAt} <= ${filters.to}::timestamptz`);

      if (filters.search) {
        const term = `%${filters.search}%`;
        const searchCondition = or(
          ilike(accountsTable.accountName, term),
          ilike(usersTable.email, term),
          ilike(usersTable.fullName, term),
          ilike(videosTable.originalFilename, term),
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      const whereClause = conditions.length === 0
        ? undefined
        : conditions.length === 1 ? conditions[0] : and(...conditions);

      const sortColumn = filters.sort === "createdAt"
        ? postsTable.createdAt
        : postsTable.scheduledAt;
      const orderFn = filters.order === "asc" ? asc : desc;
      const offset = (filters.page - 1) * filters.pageSize;

      const rows = await buildBaseQuery()
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(filters.pageSize)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(postsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, postsTable.accountId))
        .innerJoin(usersTable, eq(usersTable.id, accountsTable.userId))
        .innerJoin(videosTable, eq(videosTable.id, postsTable.videoId))
        .where(whereClause);

      return {
        data: rows.map(rowToAdminPost),
        total: Number(total ?? 0),
      };
    },

    async listForCreator(creatorId, opts) {
      const conditions: SQL[] = [eq(accountsTable.userId, creatorId)];
      const deletion = deletionFilter(opts);
      if (deletion) conditions.push(deletion);

      const rows = await buildBaseQuery()
        .where(and(...conditions))
        .orderBy(desc(postsTable.scheduledAt));

      return rows.map(rowToAdminPost);
    },

    async softDelete(postId, adminId) {
      const [updated] = await db
        .update(postsTable)
        .set({ deletedAt: new Date(), deletedBy: adminId })
        .where(and(eq(postsTable.id, postId), isNull(postsTable.deletedAt)))
        .returning({ id: postsTable.id });

      return updated ? this.findById(postId) : null;
    },

    async restore(postId) {
      const [updated] = await db
        .update(postsTable)
        .set({ deletedAt: null, deletedBy: null })
        .where(and(eq(postsTable.id, postId), isNotNull(postsTable.deletedAt)))
        .returning({ id: postsTable.id });

      return updated ? this.findById(postId) : null;
    },

    async bulkSoftDelete(postIds, adminId) {
      if (postIds.length === 0) return [];

      const updated = await db
        .update(postsTable)
        .set({ deletedAt: new Date(), deletedBy: adminId })
        .where(and(
          inArray(postsTable.id, postIds),
          isNull(postsTable.deletedAt),
        ))
        .returning({ id: postsTable.id });

      return updated.map((u) => u.id);
    },

    async findById(postId) {
      const [row] = await buildBaseQuery()
        .where(eq(postsTable.id, postId))
        .limit(1);

      return row ? rowToAdminPost(row) : null;
    },
  };
}
