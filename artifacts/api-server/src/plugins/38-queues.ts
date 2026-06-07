import { Queue } from "bullmq";
import fp from "fastify-plugin";
import { createRedisConnection } from "../lib/redis";
import {
  type AiJobData,
  type AiProcessingQueue,
  aiProcessingQueueName,
} from "../lib/ai-processing-queue";
import {
  analyticsRefreshCronPattern,
  type AnalyticsRefreshJob,
  analyticsRefreshJobId,
  analyticsRefreshJobName,
  type AnalyticsRefreshQueue,
  analyticsRefreshQueueName,
} from "../lib/analytics-refresh-queue";
import {
  type PostPublishingJob,
  type PostPublishingQueue,
  postPublishingQueueName,
} from "../lib/post-publishing-queue";
import {
  type VideoProcessingJob,
  type VideoProcessingQueue,
  videoProcessingQueueName,
} from "../lib/video-processing-queue";
import {
  type ViralityJobData,
  type ViralityQueue,
  viralityQueueName,
} from "../lib/virality-queue";

export default fp(async function queuesPlugin(fastify) {
  let analyticsQueue: Queue<AnalyticsRefreshJob> | null = null;
  let videoQueue: Queue<VideoProcessingJob> | null = null;
  let postQueue: Queue<PostPublishingJob> | null = null;
  let aiQueue: Queue<AiJobData> | null = null;
  let viralityQueue: Queue<ViralityJobData> | null = null;

  const getAnalyticsQueue = () => {
    analyticsQueue ??= new Queue(analyticsRefreshQueueName, {
      connection: createRedisConnection(fastify.config.redisUrl),
    });

    return analyticsQueue;
  };

  const getVideoQueue = () => {
    videoQueue ??= new Queue(videoProcessingQueueName, {
      connection: createRedisConnection(fastify.config.redisUrl),
    });

    return videoQueue;
  };

  const getPostQueue = () => {
    postQueue ??= new Queue(postPublishingQueueName, {
      connection: createRedisConnection(fastify.config.redisUrl),
    });

    return postQueue;
  };

  const getAiQueue = () => {
    aiQueue ??= new Queue<AiJobData>(aiProcessingQueueName, {
      connection: createRedisConnection(fastify.config.redisUrl),
    });

    return aiQueue;
  };

  const getViralityQueue = () => {
    viralityQueue ??= new Queue<ViralityJobData>(viralityQueueName, {
      connection: createRedisConnection(fastify.config.redisUrl),
    });

    return viralityQueue;
  };

  const analyticsRefreshQueue: AnalyticsRefreshQueue = {
    scheduleEverySixHours() {
      return getAnalyticsQueue().add(analyticsRefreshJobName, {}, {
        jobId: analyticsRefreshJobId,
        repeat: {
          pattern: analyticsRefreshCronPattern,
        },
      });
    },

    async close() {
      await analyticsQueue?.close();
    },
  };

  const videoProcessingQueue: VideoProcessingQueue = {
    add(name, data) {
      return getVideoQueue().add(name, data);
    },

    async close() {
      await videoQueue?.close();
    },
  };

  const postPublishingQueue: PostPublishingQueue = {
    add(name, data, options) {
      return getPostQueue().add(name, data, options);
    },

    async remove(jobId) {
      const removed = await getPostQueue().remove(jobId);
      return removed > 0;
    },

    async close() {
      await postQueue?.close();
    },
  };

  const aiProcessingQueue: AiProcessingQueue = {
    add(data) {
      return getAiQueue().add(data.kind, data, { jobId: data.jobId });
    },

    async close() {
      await aiQueue?.close();
    },
  };

  const viralityProcessingQueue: ViralityQueue = {
    add(data) {
      return getViralityQueue().add("virality", data, { jobId: data.jobId });
    },

    async close() {
      await viralityQueue?.close();
    },
  };

  const queueAccessors = {
    "post-publishing": getPostQueue,
    "video-processing": getVideoQueue,
    "analytics-refresh": getAnalyticsQueue,
    "ai-processing": getAiQueue,
    "virality-processing": getViralityQueue,
  } as const;

  fastify.decorate("queuesAdmin", {
    queueNames: Object.keys(queueAccessors) as Array<keyof typeof queueAccessors>,
    async getStats() {
      const entries = await Promise.all(
        Object.entries(queueAccessors).map(async ([name, getter]) => {
          const queue = getter();
          const counts = await queue.getJobCounts(
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
            "paused",
          );
          return { name, counts };
        }),
      );
      return entries;
    },
    async getFailedJobs(queueName: string, limit = 20) {
      const getter = queueAccessors[queueName as keyof typeof queueAccessors];
      if (!getter) return [];
      const queue = getter();
      const jobs = await queue.getFailed(0, Math.max(0, limit - 1));
      return jobs.map((job) => ({
        id: String(job.id),
        name: job.name,
        failedReason: job.failedReason ?? null,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn ?? null,
        finishedOn: job.finishedOn ?? null,
        data: job.data,
      }));
    },
    async retryJob(queueName: string, jobId: string) {
      const getter = queueAccessors[queueName as keyof typeof queueAccessors];
      if (!getter) return false;
      const queue = getter();
      const job = await queue.getJob(jobId);
      if (!job) return false;
      await job.retry();
      return true;
    },
  });

  fastify.decorate("analyticsRefreshQueue", analyticsRefreshQueue);
  fastify.decorate("videoProcessingQueue", videoProcessingQueue);
  fastify.decorate("postPublishingQueue", postPublishingQueue);
  fastify.decorate("aiProcessingQueue", aiProcessingQueue);
  fastify.decorate("viralityQueue", viralityProcessingQueue);

  fastify.addHook("onClose", async () => {
    await analyticsRefreshQueue.close();
    await videoProcessingQueue.close();
    await postPublishingQueue.close();
    await aiProcessingQueue.close();
    await viralityProcessingQueue.close();
  });
}, {
  name: "queues-plugin",
  dependencies: ["app-config"],
});
