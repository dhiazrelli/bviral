export const aiProcessingQueueName = "ai-processing";

export type AiJobKind = "captions" | "enhance" | "ltx";

export type CaptionStyle = "stroke" | "yellow" | "pill";
export type WhisperModelSize = "tiny" | "base" | "small" | "medium" | "large";

export interface CaptionsJobData {
  kind: "captions";
  jobId: string;
  videoId: string;
  userId: string;
  style?: CaptionStyle;
  wordsPerFlash?: number;
  modelSize?: WhisperModelSize;
}

export interface EnhanceJobData {
  kind: "enhance";
  jobId: string;
  videoId: string;
  userId: string;
  upscale: boolean;
  faceRestore: boolean;
}

export interface LtxJobData {
  kind: "ltx";
  jobId: string;
  userId: string;
  prompt: string;
  style?: string;
  durationSec: number;
  resolution: string;
  model: string;
}

export type AiJobData = CaptionsJobData | EnhanceJobData | LtxJobData;

export interface AiProcessingQueue {
  add(data: AiJobData): Promise<unknown>;
  close(): Promise<void>;
}
