import type { Database } from "@workspace/db";
import type { Pool } from "pg";
import type { AppConfig } from "../lib/config";
import type { AiJobStore } from "../lib/ai-job-store";
import type { AiProcessingQueue } from "../lib/ai-processing-queue";
import type { AnalyticsRefreshQueue } from "../lib/analytics-refresh-queue";
import type { PostPublishingQueue } from "../lib/post-publishing-queue";
import type { VideoProcessingQueue } from "../lib/video-processing-queue";
import type { ViralityQueue } from "../lib/virality-queue";
import type { ViralityService } from "../services/virality.service";
import type { AccountsRepository } from "../repositories/accounts.repository";
import type { AccountsService } from "../services/accounts.service";
import type { AdminAuditRepository } from "../repositories/admin-audit.repository";
import type { AdminPostsRepository } from "../repositories/admin-posts.repository";
import type { AdminVideosRepository } from "../repositories/admin-videos.repository";
import type { AiService } from "../services/ai.service";
import type { AlertsRepository } from "../repositories/alerts.repository";
import type { AlertsService } from "../services/alerts.service";
import type { AnalyticsRepository } from "../repositories/analytics.repository";
import type { AnalyticsService } from "../services/analytics.service";
import type { MetaService } from "../services/meta.service";
import type { PlatformPublisher } from "../services/platform-publisher.service";
import type { UsersRepository } from "../repositories/users";
import type { PostsRepository } from "../repositories/posts.repository";
import type { PostsService } from "../services/posts.service";
import type { TikTokService } from "../services/tiktok.service";
import type { VideosRepository } from "../repositories/videos.repository";
import type { VideosService } from "../services/videos.service";
import type { YouTubeService } from "../services/youtube.service";
import type {
  AuthenticatedUser,
  AuthRole,
  AuthRouteHandler,
} from "../plugins/50-auth";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    db: Database;
    pgPool: Pool;
    analyticsRefreshQueue: AnalyticsRefreshQueue;
    videoProcessingQueue: VideoProcessingQueue;
    postPublishingQueue: PostPublishingQueue;
    aiProcessingQueue: AiProcessingQueue;
    viralityQueue: ViralityQueue;
    queuesAdmin: {
      queueNames: readonly string[];
      getStats(): Promise<Array<{
        name: string;
        counts: Record<string, number>;
      }>>;
      getFailedJobs(queueName: string, limit?: number): Promise<Array<{
        id: string;
        name: string;
        failedReason: string | null;
        attemptsMade: number;
        timestamp: number;
        processedOn: number | null;
        finishedOn: number | null;
        data: unknown;
      }>>;
      retryJob(queueName: string, jobId: string): Promise<boolean>;
    };
    aiJobStore: AiJobStore;
    accountsRepository: AccountsRepository;
    accountsService: AccountsService;
    adminAuditRepository: AdminAuditRepository;
    adminPostsRepository: AdminPostsRepository;
    adminVideosRepository: AdminVideosRepository;
    aiService: AiService;
    alertsRepository: AlertsRepository;
    alertsService: AlertsService;
    analyticsRepository: AnalyticsRepository;
    analyticsService: AnalyticsService;
    platformPublisher: PlatformPublisher;
    youtubeService: YouTubeService;
    tiktokService: TikTokService;
    metaService: MetaService;
    postsRepository: PostsRepository;
    postsService: PostsService;
    usersRepository: UsersRepository;
    videosRepository: VideosRepository;
    videosService: VideosService;
    viralityService: ViralityService;
    authenticate: AuthRouteHandler;
    requireRole: (...roles: AuthRole[]) => AuthRouteHandler;
  }

  interface FastifyRequest {
    adminScope: "users:write" | null;
    currentUser: AuthenticatedUser | null;
  }
}
