import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  adminAuditLogTable,
  type Database,
  usersTable,
} from "@workspace/db";

export interface AdminAuditEntry {
  id: string;
  adminId: string;
  adminEmail: string | null;
  adminName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAuditListFilters {
  page: number;
  pageSize: number;
  adminId?: string;
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
}

export interface AdminAuditRepository {
  list(filters: AdminAuditListFilters): Promise<{
    data: AdminAuditEntry[];
    total: number;
  }>;
}

export function buildAdminAuditRepository(db: Database): AdminAuditRepository {
  return {
    async list(filters) {
      const conditions: SQL[] = [];
      if (filters.adminId) conditions.push(eq(adminAuditLogTable.adminId, filters.adminId));
      if (filters.action) conditions.push(eq(adminAuditLogTable.action, filters.action));
      if (filters.targetType) conditions.push(eq(adminAuditLogTable.targetType, filters.targetType));
      if (filters.from) conditions.push(sql`${adminAuditLogTable.createdAt} >= ${filters.from}::timestamptz`);
      if (filters.to) conditions.push(sql`${adminAuditLogTable.createdAt} <= ${filters.to}::timestamptz`);

      const whereClause = conditions.length === 0
        ? undefined
        : conditions.length === 1 ? conditions[0] : and(...conditions);
      const offset = (filters.page - 1) * filters.pageSize;

      const rows = await db
        .select({
          entry: adminAuditLogTable,
          adminEmail: usersTable.email,
          adminName: usersTable.fullName,
        })
        .from(adminAuditLogTable)
        .leftJoin(usersTable, eq(usersTable.id, adminAuditLogTable.adminId))
        .where(whereClause)
        .orderBy(desc(adminAuditLogTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(adminAuditLogTable)
        .where(whereClause);

      return {
        data: rows.map(({ entry, adminEmail, adminName }) => ({
          id: entry.id,
          adminId: entry.adminId,
          adminEmail: adminEmail ?? null,
          adminName: adminName ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          payload: entry.payload,
          createdAt: entry.createdAt.toISOString(),
        })),
        total: Number(total ?? 0),
      };
    },
  };
}
