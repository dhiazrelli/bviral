import type { FastifyInstance } from "fastify";
import { z } from "zod";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  adminId: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(64).optional(),
  targetType: z.enum(["user", "post", "video", "account", "system"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export default async function adminAuditRoutes(fastify: FastifyInstance) {
  fastify.get("/audit-log", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { data, total } = await fastify.adminAuditRepository.list(query);

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
}
