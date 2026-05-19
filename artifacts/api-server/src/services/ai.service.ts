import { createHash, randomUUID } from "node:crypto";
import type { AiJobRecord, AiJobStore } from "../lib/ai-job-store";
import type { AiProcessingQueue } from "../lib/ai-processing-queue";
import type { VideosRepository } from "../repositories/videos.repository";
import { estimateLtxCostUsd } from "./ltx.service";

const VIRAL_TIERS = [
  { min: 0, label: "🌱 Niche reach (under 10K predicted views)" },
  { min: 10_000, label: "👀 Steady growth (10K+ predicted views)" },
  { min: 100_000, label: "📈 High potential (100K+ predicted views)" },
  { min: 1_000_000, label: "🚀 Viral candidate (1M+ predicted views)" },
];

const HOOK_TYPES = ["curiosity", "shock", "list", "story", "question", "promise"];
const TONES = ["entertaining", "informative", "inspirational", "dramatic", "playful"];
const EMOTIONS = ["desperation", "joy", "surprise", "frustration", "wonder", "calm"];
const CATEGORIES = ["comedy", "education", "lifestyle", "tech", "sports", "music"];
const ENGAGEMENT_TRIGGERS = ["emotional appeal", "relatability", "humor", "controversy", "novelty"];
const HOOK_TRANSCRIPTS = [
  "Why, God, why?",
  "You won't believe what happens next.",
  "Here's the one trick nobody tells you.",
  "I tried this for 30 days — the results were unreal.",
  "Stop scrolling. This will change your day.",
];
const SHAP_PUSHING_LABELS = [
  "Overall Visual Pattern",
  "Hook Visual Pattern",
  "Transcript Pacing",
  "Color Palette Energy",
  "Cut Rhythm",
];
const SHAP_DRAGGING_LABELS = [
  "Transcript Semantics",
  "Audio Loudness Variance",
  "Lighting Consistency",
  "Hook Duration",
  "End-of-clip Drop-off",
];

export interface ViralityPrediction {
  video: string;
  predicted_views_estimate: number;
  viral_tier: string;
  shap_pushing_up: Array<{ msg: string; impact: number }>;
  shap_dragging_down: Array<{ msg: string; impact: number }>;
  llm_analysis: {
    video_summary: string;
    hook_score: number;
    clarity_score: number;
    quality_score: number;
    hook_type: string;
    tone: string;
    emotion: string;
    content_category: string;
    engagement_triggers: string[];
    strengths: string[];
    weaknesses: string[];
    improvement_suggestion: string;
  };
  hook_transcript: string;
}

function hashToBytes(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

function pickStable<T>(seed: Buffer, byteIndex: number, choices: readonly T[]): T {
  return choices[seed[byteIndex] % choices.length];
}

function numberInRange(seed: Buffer, byteIndex: number, min: number, max: number): number {
  const span = max - min + 1;
  return min + (seed[byteIndex] % span);
}

function deterministicMockPrediction(videoId: string, displayName: string): ViralityPrediction {
  const seed = hashToBytes(videoId);

  const baseEstimate = 5_000 + (seed.readUInt32BE(0) % 1_500_000);
  const tier = [...VIRAL_TIERS].reverse().find((entry) => baseEstimate >= entry.min) ?? VIRAL_TIERS[0];

  const pushing = SHAP_PUSHING_LABELS.slice(0, 3).map((label, index) => ({
    msg: `${label} #${numberInRange(seed, 4 + index, 1, 99)}`,
    impact: Number(((seed[10 + index] / 255) * 0.9 + 0.05).toFixed(4)),
  })).sort((a, b) => b.impact - a.impact);

  const dragging = SHAP_DRAGGING_LABELS.slice(0, 3).map((label, index) => ({
    msg: `${label} #${numberInRange(seed, 14 + index, 0, 30)}`,
    impact: Number((-1 * ((seed[20 + index] / 255) * 0.2 + 0.04)).toFixed(4)),
  })).sort((a, b) => a.impact - b.impact);

  const engagementTriggerCount = numberInRange(seed, 24, 1, Math.min(3, ENGAGEMENT_TRIGGERS.length));
  const engagementTriggers = ENGAGEMENT_TRIGGERS.slice(0, engagementTriggerCount);

  return {
    video: displayName,
    predicted_views_estimate: baseEstimate,
    viral_tier: tier.label,
    shap_pushing_up: pushing,
    shap_dragging_down: dragging,
    llm_analysis: {
      video_summary:
        "Preliminary analysis from the placeholder predictor. Drop in the real model checkpoint to get production-grade summaries.",
      hook_score: numberInRange(seed, 25, 5, 10),
      clarity_score: numberInRange(seed, 26, 5, 10),
      quality_score: numberInRange(seed, 27, 4, 9),
      hook_type: pickStable(seed, 28, HOOK_TYPES),
      tone: pickStable(seed, 29, TONES),
      emotion: pickStable(seed, 30, EMOTIONS),
      content_category: pickStable(seed, 31, CATEGORIES),
      engagement_triggers: engagementTriggers,
      strengths: ["catchy hook", "clear message"],
      weaknesses: ["short duration", "lacks context"],
      improvement_suggestion:
        "Add more context or visuals to enhance the comedic effect and provide a clearer resolution.",
    },
    hook_transcript: pickStable(seed, 32, HOOK_TRANSCRIPTS),
  };
}

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

export interface AiService {
  predictVirality(videoId: string, userId: string): Promise<ViralityPrediction>;
  enqueueCaptions(input: { videoId: string; userId: string; style?: "stroke" | "yellow" | "pill" }): Promise<AiJobRecord>;
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
  aiJobStore: AiJobStore;
  aiQueue: AiProcessingQueue;
  ltxConfigured: boolean;
  ltxDefaultModel: string;
  ltxDefaultResolution: string;
  ltxMaxDurationSec: number;
  ltxDailyCap: number;
}): AiService {
  return {
    async predictVirality(videoId, userId) {
      const video = await options.videosRepository.findForUser(videoId, userId);
      if (!video) {
        throw new AiVideoNotFoundError();
      }
      return deterministicMockPrediction(videoId, video.originalFilename ?? `${video.id}.mp4`);
    },

    async enqueueCaptions({ videoId, userId, style }) {
      const video = await options.videosRepository.findForUser(videoId, userId);
      if (!video) {
        throw new AiVideoNotFoundError();
      }
      const jobId = randomUUID();
      const job = await options.aiJobStore.create({ jobId, kind: "captions" });
      await options.aiQueue.add({ kind: "captions", jobId, videoId, userId, style });
      return job;
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
