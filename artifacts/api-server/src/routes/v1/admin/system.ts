import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../../../lib/audit";

const failedQuerySchema = z.object({
  queue: z.enum(["post-publishing", "video-processing", "analytics-refresh", "ai-processing"]),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const retryParamsSchema = z.object({
  queue: z.enum(["post-publishing", "video-processing", "analytics-refresh", "ai-processing"]),
  jobId: z.string().min(1),
});

export default async function adminSystemRoutes(fastify: FastifyInstance) {
  fastify.get("/system/health", async () => {
    const queues = await fastify.queuesAdmin.getStats();
    return {
      queues,
      collectedAt: new Date().toISOString(),
    };
  });

  fastify.get("/system/failed-jobs", async (request) => {
    const query = failedQuerySchema.parse(request.query);
    const jobs = await fastify.queuesAdmin.getFailedJobs(query.queue, query.limit);
    return { queue: query.queue, jobs };
  });

  fastify.post<{ Params: { queue: string; jobId: string } }>(
    "/system/jobs/:queue/:jobId/retry",
    async (request, reply) => {
      const params = retryParamsSchema.parse(request.params);
      const adminId = request.currentUser!.id;
      const ok = await fastify.queuesAdmin.retryJob(params.queue, params.jobId);

      if (!ok) {
        reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Job not found." });
        return;
      }

      await writeAudit(fastify, {
        adminId,
        action: "system.retry_job",
        targetType: "system",
        targetId: null,
        payload: { queue: params.queue, jobId: params.jobId },
      });

      return { queue: params.queue, jobId: params.jobId, retried: true };
    },
  );
}
