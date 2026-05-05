import { Worker } from "bullmq";
import { createDatabase, createPool } from "@workspace/db";
import { resolveConfig } from "../lib/config";
import { loadEnv } from "../lib/load-env";
import { createRedisConnection } from "../lib/redis";
import {
  type VideoProcessingJob,
  videoProcessingQueueName,
} from "../lib/video-processing-queue";
import { buildVideosRepository } from "../repositories/videos.repository";

loadEnv();

const config = resolveConfig();
const pool = createPool(config.databaseUrl, {
  max: config.dbPoolMax,
});
const db = createDatabase(pool);
const videosRepository = buildVideosRepository(db);
const redis = createRedisConnection(config.redisUrl);

const worker = new Worker<VideoProcessingJob>(
  videoProcessingQueueName,
  async (job) => {
    await videosRepository.updateStatus(job.data.videoId, "processing");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await videosRepository.updateStatus(job.data.videoId, "ready");
  },
  { connection: redis },
);

worker.on("completed", (job) => {
  console.info({ jobId: job.id, videoId: job.data.videoId }, "Video processing job completed");
});

worker.on("failed", async (job, error) => {
  console.error({ jobId: job?.id, err: error }, "Video processing job failed");

  if (job) {
    await videosRepository.updateStatus(job.data.videoId, "failed");
  }
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
