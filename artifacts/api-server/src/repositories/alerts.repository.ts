import { and, desc, eq, sql } from "drizzle-orm";
import {
  accountsTable,
  alertsTable,
  type AlertRecord,
  type Database,
  postsTable,
} from "@workspace/db";
import type { AccountPlatform } from "./accounts.repository";

export type AlertType = "error" | "copyright" | "success";
export type AlertStatus = "unresolved" | "resolved";

export interface AlertResponseDto {
  id: string;
  type: AlertType;
  status: AlertStatus;
  message: string;
  platform: AccountPlatform;
  accountId: string | null;
  postId: string | null;
  createdAt: string;
}

export interface AlertsRepository {
  listForUser(userId: string): Promise<AlertResponseDto[]>;
  resolveForUser(alertId: string, userId: string): Promise<boolean>;
}

function serializeAlert(alert: AlertRecord): AlertResponseDto {
  return {
    id: alert.id,
    type: alert.type,
    status: alert.status,
    message: alert.message,
    platform: alert.platform,
    accountId: alert.accountId ?? null,
    postId: alert.postId ?? null,
    createdAt: alert.createdAt.toISOString(),
  };
}

function ownedAlertWhere(alertId: string, userId: string) {
  return and(
    eq(alertsTable.id, alertId),
    sql`(
      (
        ${alertsTable.accountId} is not null
        and exists (
          select 1 from ${accountsTable}
          where ${accountsTable.id} = ${alertsTable.accountId}
            and ${accountsTable.userId} = ${userId}
        )
      )
      or (
        ${alertsTable.postId} is not null
        and exists (
          select 1
          from ${postsTable}
          inner join ${accountsTable}
            on ${accountsTable.id} = ${postsTable.accountId}
          where ${postsTable.id} = ${alertsTable.postId}
            and ${accountsTable.userId} = ${userId}
        )
      )
    )`,
  );
}

export function buildAlertsRepository(db: Database): AlertsRepository {
  return {
    async listForUser(userId) {
      const alerts = await db
        .select({ alert: alertsTable })
        .from(alertsTable)
        .leftJoin(accountsTable, eq(accountsTable.id, alertsTable.accountId))
        .leftJoin(postsTable, eq(postsTable.id, alertsTable.postId))
        .where(sql`(
          ${accountsTable.userId} = ${userId}
          or exists (
            select 1
            from ${postsTable} owned_posts
            inner join ${accountsTable} owned_accounts
              on owned_accounts.id = owned_posts.account_id
            where owned_posts.id = ${alertsTable.postId}
              and owned_accounts.user_id = ${userId}
          )
        )`)
        .orderBy(desc(alertsTable.createdAt));

      return alerts.map(({ alert }) => serializeAlert(alert));
    },

    async resolveForUser(alertId, userId) {
      const updated = await db
        .update(alertsTable)
        .set({ status: "resolved" })
        .where(ownedAlertWhere(alertId, userId))
        .returning({ id: alertsTable.id });

      return updated.length > 0;
    },
  };
}
