import type { PostPlatform, PostResponseDto } from "../repositories/posts.repository";
import type { MetaService } from "./meta.service";
import type { TikTokService } from "./tiktok.service";
import type { YouTubeService } from "./youtube.service";

export interface PublishPostInput {
  postId: string;
  platform: PostPlatform;
  accountId: string;
  videoId: string;
  userId: string;
  post: PostResponseDto;
}

export interface PublishPostResult {
  externalPostId: string;
}

export interface PlatformPublisher {
  publish(input: PublishPostInput): Promise<PublishPostResult>;
}

export function buildPlatformPublisher(
  youtubeService?: YouTubeService,
  tiktokService?: TikTokService,
  metaService?: MetaService,
): PlatformPublisher {
  return {
    async publish(input) {
      if (input.platform === "youtube") {
        if (!youtubeService) {
          throw new Error("YouTube service is not configured.");
        }

        return youtubeService.publishPost(input.post, input.userId);
      }

      if (input.platform === "tiktok") {
        if (!tiktokService) {
          throw new Error("TikTok service is not configured.");
        }

        return tiktokService.publishPost(input.post, input.userId);
      }

      if (input.platform === "facebook" || input.platform === "instagram") {
        if (!metaService) {
          throw new Error("Meta service is not configured.");
        }

        return metaService.publishPost(input.post, input.userId);
      }

      return {
        externalPostId: `stub-${input.platform}-${input.postId}`,
      };
    },
  };
}
