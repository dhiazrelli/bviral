// Dedicated queue for virality predictions. Intentionally separate from the
// shared `ai-processing` queue (captions/enhance/ltx) and the video-generation
// queue so a slow ML analysis never blocks other AI work, and vice versa.
export const viralityQueueName = "virality-processing";

export interface ViralityJobData {
  jobId: string;
  videoId: string;
  userId: string;
  title: string;
  platform: string;
}

export interface ViralityQueue {
  add(data: ViralityJobData): Promise<unknown>;
  close(): Promise<void>;
}
