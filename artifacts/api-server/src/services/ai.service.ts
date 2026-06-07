import { randomUUID } from "node:crypto";
import type { AiJobRecord, AiJobStore } from "../lib/ai-job-store";
import type {
  AiProcessingQueue,
  CaptionStyle,
  WhisperModelSize,
} from "../lib/ai-processing-queue";
import type { CaptionResultsRepository } from "../repositories/caption-results.repository";
import type { VideoResponseDto, VideosRepository } from "../repositories/videos.repository";
import { estimateLtxCostUsd } from "./ltx.service";

const DEFAULT_CAPTION_STYLE: CaptionStyle = "pill";
const DEFAULT_WORDS_PER_FLASH = 2;
const DEFAULT_MODEL_SIZE: WhisperModelSize = "small";

export class AiVideoNotFoundError extends Error {
  readonly name = "AiVideoNotFoundError";
  readonly statusCode = 404;
}

export class AiJobNotFoundError extends Error {
  readonly name = "AiJobNotFoundError";
  readonly statusCode = 404;
}

export class LtxGenerationCapReachedError extends Error {
  readonly name = "LtxGenerationCapReachedError";
  readonly statusCode = 429;

  constructor(readonly cap: number) {
    super(`Daily LTX generation cap of ${cap} reached. Try again tomorrow.`);
  }
}

export class LtxNotConfiguredError extends Error {
  readonly name = "LtxNotConfiguredError";
  readonly statusCode = 503;

  constructor() {
    super("LTX Studio is not configured on the server.");
  }
}

export class CaptionsNotReadyError extends Error {
  readonly name = "CaptionsNotReadyError";
  readonly statusCode = 409;

  constructor() {
    super("Caption job is not a completed captions job with a preview to approve.");
  }
}

export interface AiService {
  enqueueCaptions(input: {
    videoId: string;
    userId: string;
    style?: CaptionStyle;
    wordsPerFlash?: number;
    modelSize?: WhisperModelSize;
    /** Bypass the cache and re-run the caption pipeline. */
    force?: boolean;
  }): Promise<AiJobRecord>;
  approveCaptions(input: { jobId: string; userId: string }): Promise<VideoResponseDto>;
  enqueueEnhance(input: { videoId: string; userId: string; upscale: boolean; faceRestore: boolean }): Promise<AiJobRecord>;
  enqueueLtxGeneration(input: {
    userId: string;
    prompt: string;
    style?: string;
    durationSec: number;
    resolution?: string;
  }): Promise<{ job: AiJobRecord; estimatedCostUsd: number }>;
  getJob(jobId: string): Promise<AiJobRecord>;
}

export function buildAiService(options: {
  videosRepository: VideosRepository;
  captionResultsRepository: CaptionResultsRepository;
  aiJobStore: AiJobStore;
  aiQueue: AiProcessingQueue;
  ltxConfigured: boolean;
  ltxDefaultModel: string;
  ltxDefaultResolution: string;
  ltxMaxDurationSec: number;
  ltxDailyCap: number;
}): AiService {
  return {
    async enqueueCaptions({ videoId, userId, style, wordsPerFlash, modelSize, force = false }) {
      const video = await options.videosRepository.findForUser(videoId, userId);
      if (!video) {
        throw new AiVideoNotFoundError();
      }

      // Resolve defaults up front so the cache key matches what the worker uses.
      const resolvedStyle = style ?? DEFAULT_CAPTION_STYLE;
      const resolvedWords = wordsPerFlash ?? DEFAULT_WORDS_PER_FLASH;
      const resolvedModel = modelSize ?? DEFAULT_MODEL_SIZE;

      // Cache hit: a preview for this exact video + settings already exists.
      // Return an already-"done" job carrying the cached preview URL so the
      // frontend shows it instantly without re-running Whisper/ffmpeg.
      if (!force) {
        const cached = await options.captionResultsRepository.findByParams({
          videoId,
          style: resolvedStyle,
          wordsPerFlash: resolvedWords,
          modelSize: resolvedModel,
        });
        if (cached) {
          const jobId = randomUUID();
          await options.aiJobStore.create({ jobId, kind: "captions" });
          await options.aiJobStore.update(jobId, {
            status: "done",
            progress: 100,
            resultUrl: cached.previewUrl,
            videoId,
          });
          const done = await options.aiJobStore.get(jobId);
          if (done) return done;
        }
      }

      const jobId = randomUUID();
      const job = await options.aiJobStore.create({ jobId, kind: "captions" });
      await options.aiQueue.add({
        kind: "captions",
        jobId,
        videoId,
        userId,
        style: resolvedStyle,
        wordsPerFlash: resolvedWords,
        modelSize: resolvedModel,
      });
      return job;
    },

    async approveCaptions({ jobId, userId }) {
      const job = await options.aiJobStore.get(jobId);
      if (!job) {
        throw new AiJobNotFoundError();
      }
      // Only a finished captions job carrying a preview URL + its source video
      // can be approved.
      if (job.kind !== "captions" || job.status !== "done" || !job.resultUrl || !job.videoId) {
        throw new CaptionsNotReadyError();
      }

      // Ownership check, then save the captioned preview as the video's
      // processedUrl. The raw originalUrl is kept so it stays recoverable.
      const video = await options.videosRepository.findForUser(job.videoId, userId);
      if (!video) {
        throw new AiVideoNotFoundError();
      }

      const updated = await options.videosRepository.setCaptionedUrl(
        job.videoId,
        userId,
        job.resultUrl,
      );
      if (!updated) {
        throw new AiVideoNotFoundError();
      }
      return updated;
    },

    async enqueueEnhance({ videoId, userId, upscale, faceRestore }) {
      const video = await options.videosRepository.findForUser(videoId, userId);
      if (!video) {
        throw new AiVideoNotFoundError();
      }
      const jobId = randomUUID();
      const job = await options.aiJobStore.create({ jobId, kind: "enhance" });
      await options.aiQueue.add({
        kind: "enhance",
        jobId,
        videoId,
        userId,
        upscale,
        faceRestore,
      });
      return job;
    },

    async enqueueLtxGeneration({ userId, prompt, style, durationSec, resolution }) {
      if (!options.ltxConfigured) {
        throw new LtxNotConfiguredError();
      }

      const effectiveDuration = Math.min(durationSec, options.ltxMaxDurationSec);
      const effectiveResolution = resolution ?? options.ltxDefaultResolution;
      const model = options.ltxDefaultModel;

      const todayCount = await options.aiJobStore.getDailyLtxUsage(userId);
      if (todayCount >= options.ltxDailyCap) {
        throw new LtxGenerationCapReachedError(options.ltxDailyCap);
      }
      await options.aiJobStore.incrementDailyLtxUsage(userId);

      const estimatedCostUsd = estimateLtxCostUsd({
        model,
        resolution: effectiveResolution,
        durationSec: effectiveDuration,
      });

      const jobId = randomUUID();
      const job = await options.aiJobStore.create({ jobId, kind: "ltx" });
      await options.aiQueue.add({
        kind: "ltx",
        jobId,
        userId,
        prompt,
        style,
        durationSec: effectiveDuration,
        resolution: effectiveResolution,
        model,
      });

      return { job, estimatedCostUsd };
    },

    async getJob(jobId) {
      const job = await options.aiJobStore.get(jobId);
      if (!job) {
        throw new AiJobNotFoundError();
      }
      return job;
    },
  };
}
