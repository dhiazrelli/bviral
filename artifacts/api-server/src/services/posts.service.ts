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

function getScheduleDelay(scheduledAt: Date) {
  return Math.max(0, scheduledAt.getTime() - Date.now());
}

export function buildPostsService(
  postsRepository: PostsRepository,
  postPublishingQueue: PostPublishingQueue,
): PostsService {
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

      await postPublishingQueue.add("publish-post", {
        postId: post.id,
        userId,
      }, {
        delay: getScheduleDelay(scheduledAt),
        jobId: post.id,
      });

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

      await postPublishingQueue.remove(post.id);
      const deleted = await postsRepository.deleteScheduledForUser(post.id, userId);

      if (!deleted) {
        throw new PostCancellationError();
      }
    },
  };
}
