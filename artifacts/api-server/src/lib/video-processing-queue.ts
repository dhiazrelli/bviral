export const videoProcessingQueueName = "video-processing";

export interface VideoProcessingJob {
  videoId: string;
  userId: string;
}

export interface VideoProcessingQueue {
  add(name: string, data: VideoProcessingJob): Promise<unknown>;
  close(): Promise<void>;
}
