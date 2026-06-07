import fp from "fastify-plugin";
import { createRedisConnection } from "../lib/redis";
import { buildViralityJobStore } from "../lib/virality-job-store";
import { buildViralityRepository } from "../repositories/virality.repository";
import { buildViralityService } from "../services/virality.service";

export default fp(async function viralityPlugin(fastify) {
  const redis = createRedisConnection(fastify.config.redisUrl);
  const viralityJobStore = buildViralityJobStore(redis);
  const viralityRepository = buildViralityRepository(fastify.db);

  fastify.decorate("viralityService", buildViralityService({
    videosRepository: fastify.videosRepository,
    viralityRepository,
    viralityJobStore,
    viralityQueue: fastify.viralityQueue,
  }));

  fastify.addHook("onClose", async () => {
    redis.disconnect();
  });
}, {
  name: "virality-plugin",
  dependencies: ["repositories-plugin", "queues-plugin", "storage-plugin"],
});
