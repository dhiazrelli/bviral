import { sql } from "drizzle-orm";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import {
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleValues = ["admin", "content_creator"] as const;
export const userRoleEnum = pgEnum("user_role", userRoleValues);

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  role: userRoleEnum("role").default("content_creator").notNull(),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedBy: uuid("suspended_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("admins_full_access_users", {
    for: "all",
    to: authenticatedRole,
    using: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
    withCheck: sql`(auth.jwt() ->> 'app_role') = 'admin'`,
  }),
  pgPolicy("users_select_own", {
    for: "select",
    to: authenticatedRole,
    using: sql`${table.id} = ${authUid}`,
  }),
  pgPolicy("users_insert_own", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${table.id} = ${authUid}`,
  }),
  pgPolicy("users_update_own", {
    for: "update",
    to: authenticatedRole,
    using: sql`${table.id} = ${authUid}`,
    withCheck: sql`${table.id} = ${authUid}`,
  }),
  pgPolicy("users_delete_own", {
    for: "delete",
    to: authenticatedRole,
    using: sql`${table.id} = ${authUid}`,
  }),
]).enableRLS();

export type UserRecord = typeof usersTable.$inferSelect;
export type NewUserRecord = typeof usersTable.$inferInsert;
