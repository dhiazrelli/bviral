import { Worker } from "bullmq";
import { createDatabase, createPool } from "@workspace/db";
import { resolveConfig } from "../lib/config";
import { loadEnv } from "../lib/load-env";
import { createRedisConnection } from "../lib/redis";
import { buildViralityJobStore } from "../lib/virality-job-store";
import { type ViralityJobData, viralityQueueName } from "../lib/virality-queue";
import { buildVideosRepository } from "../repositories/videos.repository";
import { buildViralityRepository } from "../repositories/virality.repository";
import { analyzeViaPython } from "../services/virality.service";

loadEnv();

const config = resolveConfig();
const pool = createPool(config.databaseUrl, { max: config.dbPoolMax });
const db = createDatabase(pool);
const videosRepository = buildVideosRepository(db);
const viralityRepository = buildViralityRepository(db);
const redis = createRedisConnection(config.redisUrl);
const viralityJobStore = buildViralityJobStore(redis);

async function handleVirality(data: ViralityJobData) {
  await viralityJobStore.update(data.jobId, { status: "running" });

  const video = await videosRepository.findForUser(data.videoId, data.userId);
  if (!video) {
    throw new Error("Source video not found");
  }

  const prediction = await analyzeViaPython({
    serviceUrl: config.viralityServiceUrl,
    timeoutMs: config.viralityServiceTimeoutMs,
    video,
    title: data.title,
    platform: data.platform,
  });

  await viralityRepository.upsert({
    videoId: data.videoId,
    userId: data.userId,
    prediction,
  });

  await viralityJobStore.update(data.jobId, { status: "done" });
}

// Concurrency 1: the model loads CLIP + Whisper + MiniLM and runs on a single
// (4 GB) GPU; serialising avoids VRAM exhaustion.
const worker = new Worker<ViralityJobData>(
  viralityQueueName,
  async (job) => {
    try {
      await handleVirality(job.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown worker error";
      await viralityJobStore.update(job.data.jobId, { status: "failed", error: message });
      throw error;
    }
  },
  { connection: redis, concurrency: 1 },
);

worker.on("completed", (job) => {
  console.info({ jobId: job.id, videoId: job.data.videoId }, "Virality job completed");
});

worker.on("failed", (job, error) => {
  console.error({ jobId: job?.id, videoId: job?.data.videoId, err: error }, "Virality job failed");
});

async function shutdown() {
  await worker.close();
  redis.disconnect();
  await pool.end();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  });
}
