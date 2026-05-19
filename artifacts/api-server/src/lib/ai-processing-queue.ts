export const aiProcessingQueueName = "ai-processing";

export type AiJobKind = "captions" | "enhance" | "ltx";

export interface CaptionsJobData {
  kind: "captions";
  jobId: string;
  videoId: string;
  userId: string;
  style?: "stroke" | "yellow" | "pill";
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
