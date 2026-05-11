import { z } from "zod";
import type { AppConfig } from "../lib/config";
import type { AccountsRepository } from "../repositories/accounts.repository";
import type {
  AnalyticsFilterParams,
  AnalyticsOverviewDto,
  AnalyticsRepository,
  AnalyticsSnapshotDto,
  PostAnalyticsDto,
  PostedPostForAnalytics,
} from "../repositories/analytics.repository";

const tokenRefreshSkewMs = 60_000;
const youtubeTokenUrl = "https://oauth2.googleapis.com/token";
const youtubeVideosUrl = "https://www.googleapis.com/youtube/v3/videos";
const tiktokTokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
const tiktokStatusUrl = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
const graphApiVersion = "v25.0";
const graphUrl = `https://graph.facebook.com/${graphApiVersion}`;
const defaultMetaTokenTtlSeconds = 60 * 24 * 60 * 60;

export const analyticsPostParamsSchema = z.object({
  post_id: z.string().uuid(),
});

export class AnalyticsNotFoundError extends Error {
  constructor() {
    super("Analytics were not found for this post.");
  }
}

export interface AnalyticsRefreshSummary {
  scanned: number;
  refreshed: number;
  failed: number;
}

export const analyticsFilterQuerySchema = z.object({
  videoId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
  platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "snapchat"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type AnalyticsFilterQuery = z.infer<typeof analyticsFilterQuerySchema>;

export interface AnalyticsService {
  getOverview(userId: string): Promise<AnalyticsOverviewDto>;
  getOverviewFiltered(filters: AnalyticsFilterParams): Promise<AnalyticsOverviewDto>;
  getPostAnalytics(postId: string, userId: string): Promise<PostAnalyticsDto>;
  refreshPostedPostAnalytics(): Promise<AnalyticsRefreshSummary>;
}

interface PlatformMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  revenue?: number;
}

function requireMetaCredentials(config: AppConfig) {
  if (!config.metaAppId || !config.metaAppSecret) {
    throw new Error(
      "Meta analytics refresh is not configured. Set APP_ID and APP_SECRET, or META_APP_ID and META_APP_SECRET.",
    );
  }

  return {
    appId: config.metaAppId,
    appSecret: config.metaAppSecret,
  };
}

function requireYouTubeCredentials(config: AppConfig) {
  if (!config.youtubeClientId || !config.youtubeClientSecret) {
    throw new Error(
      "YouTube analytics refresh is not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET.",
    );
  }

  return {
    clientId: config.youtubeClientId,
    clientSecret: config.youtubeClientSecret,
  };
}

function requireTikTokCredentials(config: AppConfig) {
  if (!config.tiktokClientKey || !config.tiktokClientSecret) {
    throw new Error(
      "TikTok analytics refresh is not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.",
    );
  }

  return {
    clientKey: config.tiktokClientKey,
    clientSecret: config.tiktokClientSecret,
  };
}

interface YouTubeTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface YouTubeVideosResponse {
  items?: Array<{
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface TikTokTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface TikTokStatusResponse {
  data?: {
    status?: string;
    view_count?: number;
    views?: number;
    like_count?: number;
    likes?: number;
    comment_count?: number;
    comments?: number;
    share_count?: number;
    shares?: number;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
}

interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

interface MetaTokenResponse extends MetaErrorResponse {
  access_token?: string;
  expires_in?: number;
}

interface MetaAccountsResponse extends MetaErrorResponse {
  data?: Array<{
    id: string;
    access_token?: string;
  }>;
}

interface MetaVideoMetricsResponse extends MetaErrorResponse {
  views?: number;
  likes?: {
    summary?: {
      total_count?: number;
    };
  };
  comments?: {
    summary?: {
      total_count?: number;
    };
  };
  sharedposts?: {
    summary?: {
      total_count?: number;
    };
  };
  like_count?: number;
  comments_count?: number;
}

function isExpired(expiry: string | null) {
  return !expiry || new Date(expiry).getTime() <= Date.now() + tokenRefreshSkewMs;
}

function toExpiryDate(expiresIn: number | undefined) {
  return typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? new Date(Date.now() + expiresIn * 1000)
    : null;
}

function toMetaExpiryDate(expiresIn: number | undefined) {
  const seconds = typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? expiresIn
    : defaultMetaTokenTtlSeconds;

  return new Date(Date.now() + seconds * 1000);
}

function numberFromString(value: string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function getMetaErrorMessage(response: Response, data: MetaErrorResponse, fallback: string) {
  const error = data.error;

  if (!error) {
    return `${fallback}: ${response.status} ${response.statusText}`;
  }

  return [
    fallback,
    error.type,
    error.code ? `code=${error.code}` : null,
    error.error_subcode ? `subcode=${error.error_subcode}` : null,
    error.message,
    error.fbtrace_id ? `fbtrace_id=${error.fbtrace_id}` : null,
  ].filter(Boolean).join(": ");
}

function getMetadataId(account: PostedPostForAnalytics, key: string) {
  const value = account.accountMetadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function refreshYouTubeAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
) {
  if (!account.accountRefreshToken) {
    throw new Error("YouTube refresh token is missing.");
  }
  const credentials = requireYouTubeCredentials(config);

  const response = await fetch(youtubeTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.accountRefreshToken,
    }),
  });
  const token = await readJson<YouTubeTokenResponse>(response);

  if (!response.ok || token.error || !token.access_token) {
    throw new Error(token.error_description ?? token.error ?? "YouTube token refresh failed.");
  }

  await accountsRepository.updateTokens(account.accountId, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? account.accountRefreshToken,
    tokenExpiry: toExpiryDate(token.expires_in),
  });

  return token.access_token;
}

async function getYouTubeAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
) {
  if (isExpired(account.accountTokenExpiry)) {
    return refreshYouTubeAccessToken(config, accountsRepository, account);
  }

  return account.accountAccessToken;
}

async function fetchYouTubeMetrics(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
): Promise<PlatformMetrics> {
  const url = new URL(youtubeVideosUrl);
  url.searchParams.set("part", "statistics");
  url.searchParams.set("id", account.externalPostId);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${await getYouTubeAccessToken(config, accountsRepository, account)}`,
    },
  });
  const data = await readJson<YouTubeVideosResponse>(response);

  if (!response.ok || data.error) {
    throw new Error(data.error?.message ?? `YouTube analytics fetch failed: ${response.status}`);
  }

  const statistics = data.items?.[0]?.statistics;

  return {
    views: numberFromString(statistics?.viewCount),
    likes: numberFromString(statistics?.likeCount),
    comments: numberFromString(statistics?.commentCount),
    shares: 0,
    revenue: 0,
  };
}

async function refreshTikTokAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
) {
  if (!account.accountRefreshToken) {
    throw new Error("TikTok refresh token is missing.");
  }
  const credentials = requireTikTokCredentials(config);

  const response = await fetch(tiktokTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_key: credentials.clientKey,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.accountRefreshToken,
    }),
  });
  const token = await readJson<TikTokTokenResponse>(response);

  if (!response.ok || token.error || !token.access_token) {
    throw new Error(token.error_description ?? token.error ?? "TikTok token refresh failed.");
  }

  await accountsRepository.updateTokens(account.accountId, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? account.accountRefreshToken,
    tokenExpiry: toExpiryDate(token.expires_in),
  });

  return token.access_token;
}

async function getTikTokAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
) {
  if (isExpired(account.accountTokenExpiry)) {
    return refreshTikTokAccessToken(config, accountsRepository, account);
  }

  return account.accountAccessToken;
}

async function fetchTikTokMetrics(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
): Promise<PlatformMetrics> {
  const response = await fetch(tiktokStatusUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await getTikTokAccessToken(config, accountsRepository, account)}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      publish_id: account.externalPostId,
    }),
  });
  const data = await readJson<TikTokStatusResponse>(response);

  if (!response.ok || data.error?.code && data.error.code !== "ok") {
    throw new Error(data.error?.message ?? `TikTok analytics fetch failed: ${response.status}`);
  }

  return {
    views: data.data?.view_count ?? data.data?.views ?? 0,
    likes: data.data?.like_count ?? data.data?.likes ?? 0,
    comments: data.data?.comment_count ?? data.data?.comments ?? 0,
    shares: data.data?.share_count ?? data.data?.shares ?? 0,
    revenue: 0,
  };
}

async function graphGet<T extends MetaErrorResponse>(
  path: string,
  params: Record<string, string>,
) {
  const url = new URL(`${graphUrl}/${path.replace(/^\/+/u, "")}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = await readJson<T>(response);

  if (!response.ok || data.error) {
    throw new Error(getMetaErrorMessage(response, data, "Meta analytics fetch failed"));
  }

  return data;
}

async function refreshMetaAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
) {
  const { appId, appSecret } = requireMetaCredentials(config);

  if (!account.accountRefreshToken) {
    throw new Error("Meta long-lived user token is missing.");
  }

  const longLivedToken = await graphGet<MetaTokenResponse>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: account.accountRefreshToken,
  });

  if (!longLivedToken.access_token) {
    throw new Error("Meta token refresh did not return an access token.");
  }

  const pages = await graphGet<MetaAccountsResponse>("me/accounts", {
    fields: "id,access_token",
    access_token: longLivedToken.access_token,
  });
  const pageId = getMetadataId(account, "pageId");
  const page = pageId
    ? pages.data?.find((candidate) => candidate.id === pageId)
    : pages.data?.[0];

  if (!page?.access_token) {
    throw new Error("Meta token refresh could not find a matching Page access token.");
  }

  await accountsRepository.updateTokens(account.accountId, {
    accessToken: page.access_token,
    refreshToken: longLivedToken.access_token,
    tokenExpiry: toMetaExpiryDate(longLivedToken.expires_in),
  });

  return page.access_token;
}

async function getMetaAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
) {
  if (isExpired(account.accountTokenExpiry)) {
    return refreshMetaAccessToken(config, accountsRepository, account);
  }

  return account.accountAccessToken;
}

async function fetchMetaMetrics(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: PostedPostForAnalytics,
): Promise<PlatformMetrics> {
  const accessToken = await getMetaAccessToken(config, accountsRepository, account);
  const data = await graphGet<MetaVideoMetricsResponse>(account.externalPostId, {
    fields: "views,likes.summary(true),comments.summary(true),sharedposts.summary(true),like_count,comments_count",
    access_token: accessToken,
  });

  return {
    views: data.views ?? 0,
    likes: data.likes?.summary?.total_count ?? data.like_count ?? 0,
    comments: data.comments?.summary?.total_count ?? data.comments_count ?? 0,
    shares: data.sharedposts?.summary?.total_count ?? 0,
    revenue: 0,
  };
}

async function fetchPlatformMetrics(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  post: PostedPostForAnalytics,
) {
  if (post.platform === "youtube") {
    return fetchYouTubeMetrics(config, accountsRepository, post);
  }

  if (post.platform === "tiktok") {
    return fetchTikTokMetrics(config, accountsRepository, post);
  }

  if (post.platform === "facebook" || post.platform === "instagram") {
    return fetchMetaMetrics(config, accountsRepository, post);
  }

  throw new Error(`Analytics are not supported for ${post.platform}.`);
}

export function buildAnalyticsService(
  config: AppConfig,
  analyticsRepository: AnalyticsRepository,
  accountsRepository: AccountsRepository,
): AnalyticsService {
  return {
    getOverview(userId) {
      return analyticsRepository.getOverviewForUser(userId);
    },

    getOverviewFiltered(filters) {
      return analyticsRepository.getOverviewFiltered(filters);
    },

    async getPostAnalytics(postId, userId) {
      const analytics = await analyticsRepository.getPostAnalyticsForUser(postId, userId);

      if (!analytics) {
        throw new AnalyticsNotFoundError();
      }

      return analytics;
    },

    async refreshPostedPostAnalytics() {
      const posts = await analyticsRepository.listPostedPostsForRefresh();
      const summary: AnalyticsRefreshSummary = {
        scanned: posts.length,
        refreshed: 0,
        failed: 0,
      };

      for (const post of posts) {
        try {
          const metrics = await fetchPlatformMetrics(config, accountsRepository, post);
          await analyticsRepository.insertSnapshot({
            postId: post.postId,
            views: metrics.views,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            revenue: metrics.revenue ?? 0,
          });
          summary.refreshed += 1;
        } catch (error) {
          summary.failed += 1;
          console.error({
            err: error,
            postId: post.postId,
            platform: post.platform,
          }, "Analytics refresh failed");
        }
      }

      return summary;
    },
  };
}
