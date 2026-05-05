import { Worker } from "bullmq";
import { createDatabase, createPool } from "@workspace/db";
import { resolveConfig } from "../lib/config";
import { loadEnv } from "../lib/load-env";
import {
  type PostPublishingJob,
  postPublishingQueueName,
} from "../lib/post-publishing-queue";
import { createRedisConnection } from "../lib/redis";
import { buildPostsRepository } from "../repositories/posts.repository";
import { buildAccountsRepository } from "../repositories/accounts.repository";
import { buildVideosRepository } from "../repositories/videos.repository";
import { buildPlatformPublisher } from "../services/platform-publisher.service";
import { buildMetaService } from "../services/meta.service";
import { buildTikTokService } from "../services/tiktok.service";
import { buildYouTubeService } from "../services/youtube.service";

loadEnv();

const config = resolveConfig();
const pool = createPool(config.databaseUrl, {
  max: config.dbPoolMax,
});
const db = createDatabase(pool);
const postsRepository = buildPostsRepository(db);
const accountsRepository = buildAccountsRepository(db);
const videosRepository = buildVideosRepository(db);
const youtubeService = buildYouTubeService(
  config,
  accountsRepository,
  videosRepository,
);
const tiktokService = buildTikTokService(
  config,
  accountsRepository,
  videosRepository,
);
const metaService = buildMetaService(
  config,
  accountsRepository,
  videosRepository,
);
const platformPublisher = buildPlatformPublisher(
  youtubeService,
  tiktokService,
  metaService,
);
const redis = createRedisConnection(config.redisUrl);

const worker = new Worker<PostPublishingJob>(
  postPublishingQueueName,
  async (job) => {
    const post = await postsRepository.findForUser(job.data.postId, job.data.userId);

    if (!post || post.status !== "scheduled") {
      return;
    }

    try {
      const result = await platformPublisher.publish({
        postId: post.id,
        platform: post.platform,
        accountId: post.accountId,
        videoId: post.videoId,
        userId: job.data.userId,
        post,
      });

      await postsRepository.markPosted(post.id, result.externalPostId);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Platform publishing failed.";

      await postsRepository.markFailed(post.id, message);
      await postsRepository.createFailureAlert({
        message,
        platform: post.platform,
        accountId: post.accountId,
        postId: post.id,
      });
    }
  },
  { connection: redis },
);

worker.on("completed", (job) => {
  console.info({ jobId: job.id, postId: job.data.postId }, "Post publishing job completed");
});

worker.on("failed", async (job, error) => {
  console.error({ jobId: job?.id, err: error }, "Post publishing job failed");

  if (job) {
    const post = await postsRepository.markFailed(
      job.data.postId,
      error.message,
    );

    if (post) {
      await postsRepository.createFailureAlert({
        message: error.message,
        platform: post.platform,
        accountId: post.accountId,
        postId: post.id,
      });
    }
  }
});

async function shutdown() {
  await worker.close();
  redis.disconnect();
  await pool.end();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  });
}
