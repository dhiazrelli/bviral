import { z } from "zod";
import type { PostPublishingQueue } from "../lib/post-publishing-queue";
import type {
  PostPlatform,
  PostResponseDto,
  PostsRepository,
} from "../repositories/posts.repository";

export const postPlatformSchema = z.enum([
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
]);

export const postParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createPostBodySchema = z.object({
  video_id: z.string().uuid(),
  account_id: z.string().uuid(),
  scheduled_at: z.string().datetime({ offset: true }),
  platform: postPlatformSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreatePostBody = z.infer<typeof createPostBodySchema>;

export class PostNotFoundError extends Error {
  readonly name = "PostNotFoundError";

  constructor() {
    super("Post was not found.");
  }
}

export class PostValidationError extends Error {
  readonly name = "PostValidationError";

  constructor(message: string) {
    super(message);
  }
}

export class PostCancellationError extends Error {
  readonly name = "PostCancellationError";

  constructor() {
    super("Only scheduled posts can be cancelled.");
  }
}

export interface PostsService {
  listPosts(userId: string): Promise<PostResponseDto[]>;
  getPost(postId: string, userId: string): Promise<PostResponseDto>;
  createPost(input: CreatePostBody, userId: string): Promise<PostResponseDto>;
  cancelPost(postId: string, userId: string): Promise<void>;
}

export interface PostsServiceOptions {
  allowUnqueuedSchedules?: boolean;
  queueTimeoutMs?: number;
}

function getScheduleDelay(scheduledAt: Date) {
  return Math.max(0, scheduledAt.getTime() - Date.now());
}

function assertScheduledTime(scheduledAt: Date) {
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new PostValidationError("Scheduled time is invalid.");
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new PostValidationError("Scheduled time must be in the future.");
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timeout));
  });
}

export function buildPostsService(
  postsRepository: PostsRepository,
  postPublishingQueue: PostPublishingQueue,
  options: PostsServiceOptions = {},
): PostsService {
  const queueTimeoutMs = options.queueTimeoutMs ?? 3_000;

  return {
    listPosts(userId) {
      return postsRepository.listForUser(userId);
    },

    async getPost(postId, userId) {
      const post = await postsRepository.findForUser(postId, userId);

      if (!post) {
        throw new PostNotFoundError();
      }

      return post;
    },

    async createPost(input, userId) {
      const scheduledAt = new Date(input.scheduled_at);
      assertScheduledTime(scheduledAt);
      const accountPlatform = await postsRepository.findOwnedAccountPlatform(
        input.account_id,
        userId,
      );

      if (!accountPlatform) {
        throw new PostValidationError("Account was not found.");
      }

      if (accountPlatform !== input.platform) {
        throw new PostValidationError("Platform must match the selected account.");
      }

      const ownsVideo = await postsRepository.userOwnsVideo(input.video_id, userId);

      if (!ownsVideo) {
        throw new PostValidationError("Video was not found.");
      }

      const post = await postsRepository.createScheduled({
        videoId: input.video_id,
        accountId: input.account_id,
        platform: input.platform as PostPlatform,
        scheduledAt,
        metadata: input.metadata ?? {},
      });

      const enqueue = postPublishingQueue.add("publish-post", {
        postId: post.id,
        userId,
      }, {
        delay: getScheduleDelay(scheduledAt),
        jobId: post.id,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60_000,
        },
        removeOnComplete: 100,
      });

      try {
        await withTimeout(
          enqueue,
          queueTimeoutMs,
          "Publishing queue did not respond. Make sure Redis is running.",
        );
      } catch (error) {
        if (options.allowUnqueuedSchedules) {
          return post;
        }

        await postsRepository.deleteScheduledForUser(post.id, userId);
        throw error;
      }

      return post;
    },

    async cancelPost(postId, userId) {
      const post = await postsRepository.findForUser(postId, userId);

      if (!post) {
        throw new PostNotFoundError();
      }

      if (post.status !== "scheduled") {
        throw new PostCancellationError();
      }

      try {
        await withTimeout(
          postPublishingQueue.remove(post.id),
          queueTimeoutMs,
          "Publishing queue did not respond. Make sure Redis is running.",
        );
      } catch (error) {
        if (!options.allowUnqueuedSchedules) {
          throw error;
        }
      }

      const cancelled = await postsRepository.cancelScheduledForUser(post.id, userId);

      if (!cancelled) {
        throw new PostCancellationError();
      }
    },
  };
}
