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

export default fp(async function queuesPlugin(fastify) {
  let analyticsQueue: Queue<AnalyticsRefreshJob> | null = null;
  let videoQueue: Queue<VideoProcessingJob> | null = null;
  let postQueue: Queue<PostPublishingJob> | null = null;
  let aiQueue: Queue<AiJobData> | null = null;

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

  fastify.decorate("analyticsRefreshQueue", analyticsRefreshQueue);
  fastify.decorate("videoProcessingQueue", videoProcessingQueue);
  fastify.decorate("postPublishingQueue", postPublishingQueue);
  fastify.decorate("aiProcessingQueue", aiProcessingQueue);

  fastify.addHook("onClose", async () => {
    await analyticsRefreshQueue.close();
    await videoProcessingQueue.close();
    await postPublishingQueue.close();
    await aiProcessingQueue.close();
  });
}, {
  name: "queues-plugin",
  dependencies: ["app-config"],
});
