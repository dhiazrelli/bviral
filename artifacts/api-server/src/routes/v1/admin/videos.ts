import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../../../lib/audit";

const statusValues = ["uploaded", "processing", "ready", "failed"] as const;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).optional(),
  creatorId: z.string().uuid().optional(),
  status: z.enum(statusValues).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(["createdAt", "duration"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export default async function adminVideosRoutes(fastify: FastifyInstance) {
  fastify.get("/videos", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { data, total } = await fastify.adminVideosRepository.list(query);

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

  fastify.get<{ Params: { id: string } }>("/videos/:id", async (request, reply) => {
    const video = await fastify.adminVideosRepository.findById(request.params.id);
    if (!video) {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Video not found." });
      return;
    }
    return video;
  });

  fastify.delete<{ Params: { id: string } }>("/videos/:id", async (request, reply) => {
    const { id } = request.params;
    const adminId = request.currentUser!.id;
    const video = await fastify.adminVideosRepository.findById(id);

    if (!video) {
      reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Video not found." });
      return;
    }

    const deleted = await fastify.adminVideosRepository.deleteById(id);
    if (!deleted) {
      reply.code(409).send({ statusCode: 409, error: "Conflict", message: "Video could not be deleted." });
      return;
    }

    await writeAudit(fastify, {
      adminId,
      action: "video.delete",
      targetType: "video",
      targetId: id,
      payload: {
        creatorId: video.userId,
        originalFilename: video.originalFilename,
        postsCount: video.postsCount,
      },
    });

    reply.code(204).send();
  });
}
