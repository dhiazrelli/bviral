import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Worker } from "bullmq";
import { createDatabase, createPool } from "@workspace/db";
import { buildAiJobStore } from "../lib/ai-job-store";
import {
  type AiJobData,
  aiProcessingQueueName,
} from "../lib/ai-processing-queue";
import { resolveConfig } from "../lib/config";
import { loadEnv } from "../lib/load-env";
import { createRedisConnection } from "../lib/redis";
import { buildVideosRepository } from "../repositories/videos.repository";
import { buildLtxService, estimateLtxCostUsd } from "../services/ltx.service";

loadEnv();

const config = resolveConfig();
const pool = createPool(config.databaseUrl, { max: config.dbPoolMax });
const db = createDatabase(pool);
const videosRepository = buildVideosRepository(db);
const redis = createRedisConnection(config.redisUrl);
const aiJobStore = buildAiJobStore(redis);
const ltxService = buildLtxService({
  apiKey: config.ltxApiKey,
  apiBaseUrl: config.ltxApiBaseUrl,
});
const supabaseAdmin = config.supabaseServiceRoleKey
  ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

async function ensureBucket(bucket: string) {
  if (!supabaseAdmin) return;
  const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
  if (!error && data) {
    if (!data.public) {
      await supabaseAdmin.storage.updateBucket(bucket, { public: true });
    }
    return;
  }
  const { error: createError } = await supabaseAdmin.storage.createBucket(bucket, {
    public: true,
  });
  if (createError && createError.message !== "Bucket already exists") {
    throw createError;
  }
}

async function handleCaptionsStub(data: Extract<AiJobData, { kind: "captions" }>) {
  await aiJobStore.update(data.jobId, { status: "running", progress: 10 });

  const video = await videosRepository.findForUser(data.videoId, data.userId);
  if (!video) {
    throw new Error("Source video not found");
  }

  // Real Whisper inference will land here later (see ai_module/speechtotext.py).
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await aiJobStore.update(data.jobId, {
    status: "done",
    progress: 100,
    resultUrl: video.originalUrl,
    videoId: video.id,
  });
}

async function handleEnhanceStub(data: Extract<AiJobData, { kind: "enhance" }>) {
  await aiJobStore.update(data.jobId, { status: "running", progress: 10 });

  const video = await videosRepository.findForUser(data.videoId, data.userId);
  if (!video) {
    throw new Error("Source video not found");
  }

  // Real Real-ESRGAN / GFPGAN inference will land here later
  // (see ai_module/ai_video_enhancement_ultimate.py).
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await aiJobStore.update(data.jobId, {
    status: "done",
    progress: 100,
    resultUrl: video.originalUrl,
    videoId: video.id,
  });
}

async function handleLtxGeneration(data: Extract<AiJobData, { kind: "ltx" }>) {
  if (!supabaseAdmin) {
    throw new Error("Supabase service role key is required to store generated videos.");
  }

  await aiJobStore.update(data.jobId, { status: "running", progress: 5 });

  const { mp4 } = await ltxService.generateVideo({
    prompt: data.prompt,
    style: data.style,
    durationSec: data.durationSec,
    resolution: data.resolution,
    model: data.model,
  });

  await aiJobStore.update(data.jobId, { progress: 70 });

  const storagePath = `${data.userId}/generated/${randomUUID()}.mp4`;
  await ensureBucket(config.supabaseVideoBucket);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(config.supabaseVideoBucket)
    .upload(storagePath, mp4, { contentType: "video/mp4", upsert: false });

  if (uploadError) throw uploadError;

  const publicUrl = supabaseAdmin.storage
    .from(config.supabaseVideoBucket)
    .getPublicUrl(storagePath).data.publicUrl;

  const promptPreview = data.prompt.slice(0, 40).trim().replace(/\s+/g, "-") || "ltx";
  const filename = `ltx-${promptPreview}-${data.durationSec}s.mp4`;

  const video = await videosRepository.createUploaded({
    userId: data.userId,
    originalUrl: publicUrl,
    originalFilename: filename,
    duration: data.durationSec,
  });
  await videosRepository.updateStatus(video.id, "ready");

  const estCost = estimateLtxCostUsd({
    model: data.model,
    resolution: data.resolution,
    durationSec: data.durationSec,
  });
  console.info(
    { provider: "ltx", jobId: data.jobId, userId: data.userId, durationSec: data.durationSec, estCostUsd: estCost },
    "LTX generation completed",
  );

  await aiJobStore.update(data.jobId, {
    status: "done",
    progress: 100,
    resultUrl: publicUrl,
    videoId: video.id,
  });
}

const worker = new Worker<AiJobData>(
  aiProcessingQueueName,
  async (job) => {
    const data = job.data;
    try {
      switch (data.kind) {
        case "captions":
          return await handleCaptionsStub(data);
        case "enhance":
          return await handleEnhanceStub(data);
        case "ltx":
          return await handleLtxGeneration(data);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown worker error";
      await aiJobStore.update(data.jobId, { status: "failed", error: message });
      throw error;
    }
  },
  { connection: redis, concurrency: 2 },
);

worker.on("completed", (job) => {
  console.info({ jobId: job.id, kind: job.data.kind }, "AI job completed");
});

worker.on("failed", (job, error) => {
  console.error({ jobId: job?.id, kind: job?.data.kind, err: error }, "AI job failed");
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
