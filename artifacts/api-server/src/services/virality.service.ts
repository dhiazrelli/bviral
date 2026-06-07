import { randomUUID } from "node:crypto";
import type { ViralityJobStatus, ViralityJobStore } from "../lib/virality-job-store";
import type { ViralityQueue } from "../lib/virality-queue";
import type {
  ViralityPredictionPayload,
  ViralityRepository,
} from "../repositories/virality.repository";
import type { VideoResponseDto, VideosRepository } from "../repositories/videos.repository";
import { AiJobNotFoundError, AiVideoNotFoundError } from "./ai.service";

export type { ViralityPredictionPayload };

/**
 * Unified shape returned by both POST /virality/predict and
 * GET /virality/jobs/{jobId}. A cache hit returns status "done" with the
 * prediction inline and jobId null; a miss returns "queued" with a jobId to poll.
 */
export interface ViralityJob {
  jobId: string | null;
  status: ViralityJobStatus;
  prediction: ViralityPredictionPayload | null;
  error: string | null;
}

export interface ViralityService {
  requestPrediction(videoId: string, userId: string, force?: boolean): Promise<ViralityJob>;
  getJob(jobId: string): Promise<ViralityJob>;
}

export interface AnalyzeViaPythonInput {
  serviceUrl: string;
  timeoutMs: number;
  video: VideoResponseDto;
  title: string;
  platform: string;
}

/**
 * Download the video bytes from Supabase and forward them to the Python
 * ViralAgent `/analyze` endpoint as multipart/form-data. Keeps the Python
 * service stateless and unaware of Supabase. Used by the worker.
 */
export async function analyzeViaPython(
  input: AnalyzeViaPythonInput,
): Promise<ViralityPredictionPayload> {
  const { serviceUrl, timeoutMs, video, title, platform } = input;

  const downloadRes = await fetch(video.originalUrl);
  if (!downloadRes.ok) {
    throw new Error(
      `Failed to download video from storage (HTTP ${downloadRes.status}).`,
    );
  }
  const bytes = await downloadRes.arrayBuffer();
  const filename = video.originalFilename ?? `${video.id}.mp4`;
  const blob = new Blob([bytes], { type: "video/mp4" });

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("title", title);
  form.append("platform", platform);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${serviceUrl}/analyze`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Virality service /analyze failed (HTTP ${res.status}): ${detail.slice(0, 300)}`,
      );
    }
    return (await res.json()) as ViralityPredictionPayload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Virality service timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function buildViralityService(options: {
  videosRepository: VideosRepository;
  viralityRepository: ViralityRepository;
  viralityJobStore: ViralityJobStore;
  viralityQueue: ViralityQueue;
}): ViralityService {
  const { videosRepository, viralityRepository, viralityJobStore, viralityQueue } = options;

  return {
    async requestPrediction(videoId, userId, force = false) {
      // Ownership / existence check (also the "checks for existence" the user asked for).
      const video = await videosRepository.findForUser(videoId, userId);
      if (!video) {
        throw new AiVideoNotFoundError();
      }

      if (!force) {
        const cached = await viralityRepository.findByVideo(videoId);
        if (cached) {
          return { jobId: null, status: "done", prediction: cached, error: null };
        }
      }

      const jobId = randomUUID();
      await viralityJobStore.create({ jobId, videoId });
      await viralityQueue.add({
        jobId,
        videoId,
        userId,
        title: video.originalFilename ?? "",
        platform: "unknown",
      });

      return { jobId, status: "queued", prediction: null, error: null };
    },

    async getJob(jobId) {
      const record = await viralityJobStore.get(jobId);
      if (!record) {
        throw new AiJobNotFoundError();
      }

      let prediction: ViralityPredictionPayload | null = null;
      if (record.status === "done" && record.videoId) {
        prediction = await viralityRepository.findByVideo(record.videoId);
      }

      return {
        jobId: record.jobId,
        status: record.status,
        prediction,
        error: record.error,
      };
    },
  };
}
