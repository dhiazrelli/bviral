import fp from "fastify-plugin";
import { buildAccountsRepository } from "../repositories/accounts.repository";
import { buildAccountsService } from "../services/accounts.service";
import { buildAlertsRepository } from "../repositories/alerts.repository";
import { buildAlertsService } from "../services/alerts.service";
import { buildAnalyticsRepository } from "../repositories/analytics.repository";
import { buildAnalyticsService } from "../services/analytics.service";
import { buildPlatformPublisher } from "../services/platform-publisher.service";
import { buildPostsRepository } from "../repositories/posts.repository";
import { buildPostsService } from "../services/posts.service";
import { buildUsersRepository } from "../repositories/users";
import { buildVideosRepository } from "../repositories/videos.repository";
import { buildVideosService } from "../services/videos.service";
import { buildMetaService } from "../services/meta.service";
import { buildTikTokService } from "../services/tiktok.service";
import { buildYouTubeService } from "../services/youtube.service";

export default fp(async function repositoriesPlugin(fastify) {
  const accountsRepository = buildAccountsRepository(fastify.db);
  const alertsRepository = buildAlertsRepository(fastify.db);
  const analyticsRepository = buildAnalyticsRepository(fastify.db);
  const postsRepository = buildPostsRepository(fastify.db);
  const videosRepository = buildVideosRepository(fastify.db);
  const youtubeService = buildYouTubeService(
    fastify.config,
    accountsRepository,
    videosRepository,
  );
  const tiktokService = buildTikTokService(
    fastify.config,
    accountsRepository,
    videosRepository,
  );
  const metaService = buildMetaService(
    fastify.config,
    accountsRepository,
    videosRepository,
  );

  fastify.decorate("accountsRepository", accountsRepository);
  fastify.decorate("accountsService", buildAccountsService(accountsRepository));
  fastify.decorate("alertsRepository", alertsRepository);
  fastify.decorate("alertsService", buildAlertsService(alertsRepository));
  fastify.decorate("analyticsRepository", analyticsRepository);
  fastify.decorate("analyticsService", buildAnalyticsService(
    fastify.config,
    analyticsRepository,
    accountsRepository,
  ));
  fastify.decorate("youtubeService", youtubeService);
  fastify.decorate("tiktokService", tiktokService);
  fastify.decorate("metaService", metaService);
  fastify.decorate("platformPublisher", buildPlatformPublisher(
    youtubeService,
    tiktokService,
    metaService,
  ));
  fastify.decorate("postsRepository", postsRepository);
  fastify.decorate("postsService", buildPostsService(
    postsRepository,
    fastify.postPublishingQueue,
  ));
  fastify.decorate("usersRepository", buildUsersRepository(fastify.db));
  fastify.decorate("videosRepository", videosRepository);
  fastify.decorate("videosService", buildVideosService(videosRepository, {
    supabaseAdmin: fastify.supabaseAdmin,
    videoProcessingQueue: fastify.videoProcessingQueue,
    videoBucket: fastify.config.supabaseVideoBucket,
  }));
}, {
  name: "repositories-plugin",
  dependencies: ["database-plugin", "queues-plugin", "storage-plugin"],
});
