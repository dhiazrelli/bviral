import type { FastifyInstance } from "fastify";

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/healthz", {
    schema: {
      response: {
        200: { $ref: "healthStatus#" },
      },
    },
  }, async () => {
    return { status: "ok" as const };
  });
}
