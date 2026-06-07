import type { FastifyInstance } from "fastify";
import { adminAuditLogTable } from "@workspace/db";

export type AdminAuditAction =
  | "creator.invite"
  | "creator.update"
  | "creator.suspend"
  | "creator.reactivate"
  | "creator.delete"
  | "post.soft_delete"
  | "post.restore"
  | "post.bulk_delete"
  | "video.delete"
  | "system.retry_job";

export type AdminAuditTargetType = "user" | "post" | "video" | "account" | "system";

export async function writeAudit(
  fastify: FastifyInstance,
  input: {
    adminId: string;
    action: AdminAuditAction;
    targetType: AdminAuditTargetType;
    targetId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  await fastify.db.insert(adminAuditLogTable).values({
    adminId: input.adminId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    payload: input.payload ?? {},
  });
}
