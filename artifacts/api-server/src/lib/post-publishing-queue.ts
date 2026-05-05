export const postPublishingQueueName = "post-publishing";

export interface PostPublishingJob {
  postId: string;
  userId: string;
}

export interface PostPublishingQueue {
  add(
    name: string,
    data: PostPublishingJob,
    options?: { delay?: number; jobId?: string },
  ): Promise<unknown>;
  remove(jobId: string): Promise<boolean>;
  close(): Promise<void>;
}
