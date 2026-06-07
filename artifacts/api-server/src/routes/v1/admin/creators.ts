import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  accountsTable,
  alertsTable,
  usersTable,
} from "@workspace/db";
import { writeAudit } from "../../../lib/audit";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).optional(),
  sort: z.enum(["createdAt", "fullName", "email", "lastActiveAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(["all", "active", "suspended"]).default("all"),
});

const inviteBodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
});

const patchBodySchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "content_creator"]).optional(),
});

export default async function creatorsRoutes(fastify: FastifyInstance) {
  // List creators with stats, pagination, search, sort.
  fastify.get("/creators", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    const conditions: SQL[] = [eq(usersTable.role, "content_creator")];
    if (query.search) {
      const term = `%${query.search}%`;
      const searchCondition = or(
        ilike(usersTable.email, term),
        ilike(usersTable.fullName, term),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    if (query.status === "active") {
      conditions.push(isNull(usersTable.suspendedAt));
    } else if (query.status === "suspended") {
      conditions.push(sql`${usersTable.suspendedAt} is not null`);
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    const sortColumn = {
      createdAt: usersTable.createdAt,
      fullName: usersTable.fullName,
      email: usersTable.email,
      lastActiveAt: usersTable.updatedAt,
    }[query.sort];

    const rows = await fastify.db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        suspendedAt: usersTable.suspendedAt,
      })
      .from(usersTable)
      .where(whereClause)
      .orderBy(query.order === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(query.pageSize)
      .offset(offset);

    const [{ total }] = await fastify.db
      .select({ total: count() })
      .from(usersTable)
      .where(whereClause);

    const creatorsWithStats = await Promise.all(rows.map(async (user) => {
      const [accountCount] = await fastify.db
        .select({ total: count() })
        .from(accountsTable)
        .where(eq(accountsTable.userId, user.id));

      const [alertCount] = await fastify.db
        .select({ total: count() })
        .from(alertsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, alertsTable.accountId))
        .where(and(
          eq(accountsTable.userId, user.id),
          eq(alertsTable.status, "unresolved"),
        ));

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        connectedAccountsCount: Number(accountCount?.total ?? 0),
        unresolvedAlertsCount: Number(alertCount?.total ?? 0),
        lastActiveAt: user.updatedAt.toISOString(),
        createdAt: user.createdAt.toISOString(),
        suspendedAt: user.suspendedAt?.toISOString() ?? null,
      };
    }));

    const totalCount = Number(total ?? 0);
    return {
      data: creatorsWithStats,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
      },
    };
  });

  // Creator detail (kept for backward compatibility with existing UI)
  fastify.get<{ Params: { id: string } }>("/creators/:id", async (request, reply) => {
    const { id } = request.params;
    const [user] = await fastify.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user || user.role !== "content_creator") {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Creator not found." });
      return;
    }

    const accounts = await fastify.accountsRepository.listForCreator(id);
    const overview = await fastify.analyticsService.getOverviewFiltered({ creatorId: id });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt.toISOString(),
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      accounts,
      analytics: overview,
    };
  });

  // Creator schedule (list of their posts — admin view, can include deleted)
  fastify.get<{ Params: { id: string }; Querystring: { includeDeleted?: string } }>(
    "/creators/:id/schedule",
    async (request, reply) => {
      const { id } = request.params;
      const includeDeleted = request.query.includeDeleted === "true";

      const [user] = await fastify.db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);

      if (!user) {
        reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Creator not found." });
        return;
      }

      const posts = await fastify.adminPostsRepository.listForCreator(id, { includeDeleted });
      return { data: posts };
    },
  );

  // Invite a creator via Supabase magic link.
  fastify.post("/creators", async (request, reply) => {
    const body = inviteBodySchema.parse(request.body);
    const adminId = request.currentUser!.id;

    if (!fastify.supabaseAdmin) {
      reply.code(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Supabase admin client is not configured.",
      });
      return;
    }

    const { data, error } = await fastify.supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
      data: { full_name: body.fullName, app_role: "content_creator" },
    });

    if (error || !data?.user?.id) {
      reply.code(502).send({
        statusCode: 502,
        error: "Bad Gateway",
        message: error?.message ?? "Supabase invitation failed.",
      });
      return;
    }

    const [user] = await fastify.db
      .insert(usersTable)
      .values({
        id: data.user.id,
        email: body.email,
        fullName: body.fullName,
        role: "content_creator",
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { email: body.email, fullName: body.fullName, role: "content_creator" },
      })
      .returning();

    await writeAudit(fastify, {
      adminId,
      action: "creator.invite",
      targetType: "user",
      targetId: user.id,
      payload: { email: body.email },
    });

    reply.code(201);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt.toISOString(),
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
    };
  });

  // Update a creator (name / email / role).
  fastify.patch<{ Params: { id: string } }>("/creators/:id", async (request, reply) => {
    const { id } = request.params;
    const body = patchBodySchema.parse(request.body);
    const adminId = request.currentUser!.id;

    if (Object.keys(body).length === 0) {
      reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Provide at least one field to update.",
      });
      return;
    }

    if (body.role === "content_creator") {
      const [{ total: adminTotal }] = await fastify.db
        .select({ total: count() })
        .from(usersTable)
        .where(and(eq(usersTable.role, "admin"), ne(usersTable.id, id)));

      if (Number(adminTotal ?? 0) === 0) {
        reply.code(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Cannot demote the last remaining admin.",
        });
        return;
      }
    }

    const [user] = await fastify.db
      .update(usersTable)
      .set({
        ...(body.fullName ? { fullName: body.fullName } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.role ? { role: body.role } : {}),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "User not found." });
      return;
    }

    if (fastify.supabaseAdmin && body.email) {
      await fastify.supabaseAdmin.auth.admin.updateUserById(id, { email: body.email });
    }
    if (fastify.supabaseAdmin && body.role) {
      await fastify.supabaseAdmin.auth.admin.updateUserById(id, {
        app_metadata: { app_role: body.role },
      });
    }

    await writeAudit(fastify, {
      adminId,
      action: "creator.update",
      targetType: "user",
      targetId: id,
      payload: body,
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
    };
  });

  // Suspend a creator.
  fastify.post<{ Params: { id: string } }>("/creators/:id/suspend", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.currentUser!.id;

    const [target] = await fastify.db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!target) {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "User not found." });
      return;
    }
    if (target.role === "admin") {
      reply.code(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Admins cannot be suspended.",
      });
      return;
    }

    await fastify.db
      .update(usersTable)
      .set({ suspendedAt: new Date(), suspendedBy: adminId, updatedAt: new Date() })
      .where(eq(usersTable.id, id));

    await writeAudit(fastify, {
      adminId,
      action: "creator.suspend",
      targetType: "user",
      targetId: id,
    });

    return { id, suspended: true };
  });

  // Reactivate a creator.
  fastify.post<{ Params: { id: string } }>("/creators/:id/reactivate", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.currentUser!.id;

    const result = await fastify.db
      .update(usersTable)
      .set({ suspendedAt: null, suspendedBy: null, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });

    if (result.length === 0) {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "User not found." });
      return;
    }

    await writeAudit(fastify, {
      adminId,
      action: "creator.reactivate",
      targetType: "user",
      targetId: id,
    });

    return { id, suspended: false };
  });

  // Delete a creator (cascades through DB FKs; also remove from Supabase auth).
  fastify.delete<{ Params: { id: string } }>("/creators/:id", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.currentUser!.id;

    if (id === adminId) {
      reply.code(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "You cannot delete your own account.",
      });
      return;
    }

    if (fastify.supabaseAdmin) {
      const { error } = await fastify.supabaseAdmin.auth.admin.deleteUser(id);
      if (error && !error.message.toLowerCase().includes("not found")) {
        reply.code(502).send({
          statusCode: 502,
          error: "Bad Gateway",
          message: error.message,
        });
        return;
      }
    }

    const deleted = await fastify.db
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });

    if (deleted.length === 0) {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "User not found." });
      return;
    }

    await writeAudit(fastify, {
      adminId,
      action: "creator.delete",
      targetType: "user",
      targetId: id,
    });

    reply.code(204).send();
  });
}
