import { sql } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";
import {
  index,
  jsonb,
  pgTable,
  pgPolicy,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").notNull().references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 32 }).notNull(),
  targetId: uuid("target_id"),
  payload: jsonb("payload")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("admin_audit_log_admin_created_idx").on(table.adminId, table.createdAt),
  index("admin_audit_log_target_idx").on(table.targetType, table.targetId),
  pgPolicy("admins_full_access_audit_log", {
    for: "all",
    to: authenticatedRole,
    using: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
    withCheck: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
  }),
]).enableRLS();

export type AdminAuditLogRecord = typeof adminAuditLogTable.$inferSelect;
export type NewAdminAuditLogRecord = typeof adminAuditLogTable.$inferInsert;
