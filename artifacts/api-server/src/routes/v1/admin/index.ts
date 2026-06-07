import type { FastifyInstance } from "fastify";
import creatorsRoutes from "./creators";
import postsRoutes from "./posts";
import videosRoutes from "./videos";
import analyticsRoutes from "./analytics";
import auditRoutes from "./audit";
import systemRoutes from "./system";

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("admin"));

  await fastify.register(creatorsRoutes);
  await fastify.register(postsRoutes);
  await fastify.register(videosRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(auditRoutes);
  await fastify.register(systemRoutes);
}
