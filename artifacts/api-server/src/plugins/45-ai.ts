import fp from "fastify-plugin";
import { buildAiJobStore } from "../lib/ai-job-store";
import { createRedisConnection } from "../lib/redis";
import { buildAiService } from "../services/ai.service";
import { buildLtxService } from "../services/ltx.service";

export default fp(async function aiPlugin(fastify) {
  const redis = createRedisConnection(fastify.config.redisUrl);
  const aiJobStore = buildAiJobStore(redis);
  const ltxService = buildLtxService({
    apiKey: fastify.config.ltxApiKey,
    apiBaseUrl: fastify.config.ltxApiBaseUrl,
  });

  fastify.decorate("aiJobStore", aiJobStore);
  fastify.decorate("aiService", buildAiService({
    videosRepository: fastify.videosRepository,
    aiJobStore,
    aiQueue: fastify.aiProcessingQueue,
    ltxConfigured: ltxService.isConfigured(),
    ltxDefaultModel: fastify.config.ltxDefaultModel,
    ltxDefaultResolution: fastify.config.ltxDefaultResolution,
    ltxMaxDurationSec: fastify.config.ltxMaxDurationSec,
    ltxDailyCap: fastify.config.ltxDailyGenerationCap,
  }));

  fastify.addHook("onClose", async () => {
    redis.disconnect();
  });
}, {
  name: "ai-plugin",
  dependencies: ["repositories-plugin", "queues-plugin"],
});
