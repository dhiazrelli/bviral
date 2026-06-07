import type { CaptionStyle, WhisperModelSize } from "../lib/ai-processing-queue";
import type { VideoResponseDto } from "../repositories/videos.repository";

export interface CaptionViaPythonInput {
  serviceUrl: string;
  timeoutMs: number;
  video: VideoResponseDto;
  style: CaptionStyle;
  wordsPerFlash: number;
  modelSize: WhisperModelSize;
}

export interface CaptionResult {
  /** Burned-in (captioned) MP4 bytes, ready to upload to storage. */
  mp4: Uint8Array;
  /** Full transcript text, for surfacing/debugging. May be empty. */
  transcript: string;
  language: string | null;
}

/**
 * Shape of the JSON returned by the caption service POST /transcribe.
 * Only the fields the worker actually consumes are typed.
 */
interface TranscribeResponse {
  status: string;
  language?: string | null;
  transcript?: string;
  downloads?: {
    video?: string | null;
  };
}

/**
 * Download the source video from Supabase, forward it to the Python caption
 * service `/transcribe` (which burns ASS subtitles into the video), then pull
 * the captioned MP4 back. Keeps the Python service stateless and unaware of
 * Supabase — mirrors analyzeViaPython in virality.service.ts.
 */
export async function captionViaPython(input: CaptionViaPythonInput): Promise<CaptionResult> {
  const { serviceUrl, timeoutMs, video, style, wordsPerFlash, modelSize } = input;

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
  form.append("model_size", modelSize);
  form.append("words_per_flash", String(wordsPerFlash));
  form.append("subtitle_style", style);
  form.append("burn_subtitles", "true");
  form.append("save_pickle", "false");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let folder: string | null = null;
  try {
    const res = await fetch(`${serviceUrl}/transcribe`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Caption service /transcribe failed (HTTP ${res.status}): ${detail.slice(0, 300)}`,
      );
    }

    const payload = (await res.json()) as TranscribeResponse;
    const videoPath = payload.downloads?.video;
    if (!videoPath) {
      throw new Error("Caption service did not return a burned video (downloads.video was empty).");
    }

    // downloads.video is a service-relative path like
    // /download/{folder}/output_captioned.mp4 — capture the folder so we can
    // ask the service to clean it up afterwards.
    folder = videoPath.split("/").filter(Boolean)[1] ?? null;

    const fileRes = await fetch(`${serviceUrl}${videoPath}`, {
      signal: controller.signal,
    });
    if (!fileRes.ok) {
      throw new Error(
        `Failed to download captioned video from caption service (HTTP ${fileRes.status}).`,
      );
    }
    const captioned = new Uint8Array(await fileRes.arrayBuffer());

    return {
      mp4: captioned,
      transcript: payload.transcript ?? "",
      language: payload.language ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Caption service timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    // Best-effort cleanup of the service's temp output folder. Never fail the
    // job because cleanup failed.
    if (folder) {
      await fetch(`${serviceUrl}/cleanup/${folder}`, { method: "DELETE" }).catch(() => {});
    }
  }
}
