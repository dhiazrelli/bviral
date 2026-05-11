import { count, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  accountsTable,
  alertsTable,
  usersTable,
} from "@workspace/db";

const createBviralAccountBodySchema = z.object({
  platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "snapchat"]),
  accountName: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("admin"));

  // List content creators with aggregated stats
  fastify.get("/creators", async () => {
    const rows = await fastify.db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "content_creator"))
      .orderBy(usersTable.createdAt);

    const creatorsWithStats = await Promise.all(rows.map(async (user) => {
      const [accountCount] = await fastify.db
        .select({ total: count() })
        .from(accountsTable)
        .where(eq(accountsTable.userId, user.id));

      const [alertCount] = await fastify.db
        .select({ total: count() })
        .from(alertsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, alertsTable.accountId))
        .where(eq(accountsTable.userId, user.id));

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        connectedAccountsCount: Number(accountCount?.total ?? 0),
        unresolvedAlertsCount: Number(alertCount?.total ?? 0),
        lastActiveAt: user.updatedAt.toISOString(),
      };
    }));

    return { data: creatorsWithStats };
  });

  // Creator detail — profile, accounts metadata, aggregated stats
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
      accounts,
      analytics: overview,
    };
  });

  // Creator schedule
  fastify.get<{ Params: { id: string } }>("/creators/:id/schedule", async (request, reply) => {
    const { id } = request.params;

    const [user] = await fastify.db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user) {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Creator not found." });
      return;
    }

    const posts = await fastify.postsRepository.listForUser(id);
    return { data: posts };
  });

  // BViral company accounts — list
  fastify.get("/bviral-accounts", async () => {
    const accounts = await fastify.accountsRepository.listBviralAccounts();
    return { data: accounts };
  });

  // BViral company accounts — connect new
  fastify.post("/bviral-accounts", async (request, reply) => {
    const body = createBviralAccountBodySchema.parse(request.body);

    const account = await fastify.accountsRepository.create({
      platform: body.platform,
      accountName: body.accountName,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken ?? null,
      ownerKind: "bviral_company",
      userId: null,
      metadata: body.metadata ?? {},
    });

    reply.code(201);
    return account;
  });
}
