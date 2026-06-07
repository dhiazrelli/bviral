import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../../../lib/audit";

const platformValues = ["facebook", "instagram", "tiktok", "youtube", "snapchat"] as const;
const statusValues = ["scheduled", "posted", "failed", "cancelled"] as const;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).optional(),
  creatorId: z.string().uuid().optional(),
  platform: z.enum(platformValues).optional(),
  status: z.enum(statusValues).optional(),
  accountId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  includeDeleted: z.coerce.boolean().optional(),
  onlyDeleted: z.coerce.boolean().optional(),
  sort: z.enum(["scheduledAt", "createdAt"]).default("scheduledAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const bulkDeleteBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export default async function adminPostsRoutes(fastify: FastifyInstance) {
  fastify.get("/posts", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { data, total } = await fastify.adminPostsRepository.list(query);

    return {
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  });

  fastify.get<{ Params: { id: string } }>("/posts/:id", async (request, reply) => {
    const post = await fastify.adminPostsRepository.findById(request.params.id);
    if (!post) {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Post not found." });
      return;
    }
    return post;
  });

  fastify.delete<{ Params: { id: string } }>("/posts/:id", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.currentUser!.id;
    const post = await fastify.adminPostsRepository.softDelete(id, adminId);

    if (!post) {
      reply.code(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Post not found or already deleted.",
      });
      return;
    }

    await writeAudit(fastify, {
      adminId,
      action: "post.soft_delete",
      targetType: "post",
      targetId: id,
      payload: { platform: post.platform, accountName: post.account.accountName },
    });

    return post;
  });

  fastify.post<{ Params: { id: string } }>("/posts/:id/restore", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.currentUser!.id;
    const post = await fastify.adminPostsRepository.restore(id);

    if (!post) {
      reply.code(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Post not found or not in trash.",
      });
      return;
    }

    await writeAudit(fastify, {
      adminId,
      action: "post.restore",
      targetType: "post",
      targetId: id,
    });

    return post;
  });

  fastify.post("/posts/bulk-delete", async (request, reply) => {
    const body = bulkDeleteBodySchema.parse(request.body);
    const adminId = request.currentUser!.id;
    const deletedIds = await fastify.adminPostsRepository.bulkSoftDelete(body.ids, adminId);

    await writeAudit(fastify, {
      adminId,
      action: "post.bulk_delete",
      targetType: "post",
      targetId: null,
      payload: { requested: body.ids, deleted: deletedIds },
    });

    reply.code(200);
    return { deletedIds, count: deletedIds.length };
  });
}
