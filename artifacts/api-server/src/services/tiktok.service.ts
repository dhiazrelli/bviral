import { createHmac, timingSafeEqual } from "node:crypto";
import { ensureTikTokConfigured, type AppConfig } from "../lib/config";
import type {
  AccountResponseDto,
  AccountSecretRecord,
  AccountsRepository,
} from "../repositories/accounts.repository";
import type { PostResponseDto } from "../repositories/posts.repository";
import type { VideosRepository } from "../repositories/videos.repository";

const authUrl = "https://www.tiktok.com/v2/auth/authorize/";
const tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
const userInfoUrl = "https://open.tiktokapis.com/v2/user/info/";
const creatorInfoUrl = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const directPostUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const tiktokScopes = ["user.info.basic", "video.publish"];
const stateTtlMs = 10 * 60 * 1000;
const tokenRefreshSkewMs = 60_000;
const maxCaptionLength = 2_200;

export interface TikTokConnectInput {
  userId: string;
  redirectUri: string;
}

export interface TikTokCallbackInput {
  code: string;
  state: string;
  redirectUri: string;
}

export interface TikTokPublishResult {
  externalPostId: string;
}

export interface TikTokService {
  getConnectUrl(input: TikTokConnectInput): string;
  handleCallback(input: TikTokCallbackInput): Promise<AccountResponseDto>;
  publishPost(post: PostResponseDto, userId: string): Promise<TikTokPublishResult>;
}

interface TikTokTokenResponse {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  log_id?: string;
}

interface TikTokApiError {
  code?: string;
  message?: string;
  log_id?: string;
  logid?: string;
}

interface TikTokUserInfoResponse {
  data?: {
    user?: {
      open_id?: string;
      union_id?: string;
      avatar_url?: string;
      display_name?: string;
    };
  };
  error?: TikTokApiError;
}

interface TikTokCreatorInfoResponse {
  data?: {
    creator_avatar_url?: string;
    creator_username?: string;
    creator_nickname?: string;
    privacy_level_options?: string[];
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    stitch_disabled?: boolean;
    max_video_post_duration_sec?: number;
  };
  error?: TikTokApiError;
}

interface TikTokDirectPostResponse {
  data?: {
    publish_id?: string;
    upload_url?: string;
  };
  error?: TikTokApiError;
}

function signState(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createState(userId: string, secret: string) {
  const payload = Buffer
    .from(JSON.stringify({ userId, expiresAt: Date.now() + stateTtlMs }))
    .toString("base64url");
  return `${payload}.${signState(payload, secret)}`;
}

function parseState(state: string, secret: string): string {
  const [payload, signature] = state.split(".");

  if (!payload || !signature) {
    throw new Error("Invalid TikTok OAuth state.");
  }

  const expected = signState(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid TikTok OAuth state.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId?: unknown;
    expiresAt?: unknown;
  };

  if (typeof parsed.userId !== "string" || typeof parsed.expiresAt !== "number") {
    throw new Error("Invalid TikTok OAuth state.");
  }

  if (parsed.expiresAt < Date.now()) {
    throw new Error("Expired TikTok OAuth state.");
  }

  return parsed.userId;
}

function toExpiryDate(expiresIn: number | undefined) {
  return typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? new Date(Date.now() + expiresIn * 1000)
    : null;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function getTikTokErrorMessage(
  response: Response,
  error: TikTokApiError | TikTokTokenResponse | undefined,
  fallback: string,
) {
  const apiError = error as TikTokApiError | undefined;
  const tokenError = error as TikTokTokenResponse | undefined;
  const code = tokenError?.error ?? apiError?.code;
  const message = tokenError?.error_description ?? apiError?.message;
  const logId = tokenError?.log_id ?? apiError?.log_id ?? apiError?.logid;
  const details = [
    code,
    message,
    logId ? `log_id=${logId}` : undefined,
  ].filter(Boolean).join(": ");

  return `${fallback}: ${details || `${response.status} ${response.statusText}`}`;
}

async function exchangeToken(body: URLSearchParams) {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await readJson<TikTokTokenResponse>(response);

  if (!response.ok || data.error || !data.access_token) {
    throw new Error(getTikTokErrorMessage(response, data, "TikTok token exchange failed"));
  }

  return data;
}

async function getUserInfo(accessToken: string) {
  const url = new URL(userInfoUrl);
  url.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await readJson<TikTokUserInfoResponse>(response);

  if (!response.ok || data.error?.code && data.error.code !== "ok") {
    throw new Error(getTikTokErrorMessage(response, data.error, "TikTok user lookup failed"));
  }

  return data.data?.user ?? {};
}

async function getCreatorInfo(accessToken: string) {
  const response = await fetch(creatorInfoUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  const data = await readJson<TikTokCreatorInfoResponse>(response);

  if (!response.ok || data.error?.code && data.error.code !== "ok") {
    throw new Error(getTikTokErrorMessage(response, data.error, "TikTok creator lookup failed"));
  }

  return data.data ?? {};
}

function getStringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getBooleanMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "boolean" ? value : null;
}

function resolveCaption(post: PostResponseDto) {
  const title = getStringMetadata(post.metadata, "title");
  const description = getStringMetadata(post.metadata, "description");
  const caption = [title, description].filter(Boolean).join("\n\n")
    || "BVIRAL scheduled video";

  return caption.length > maxCaptionLength
    ? caption.slice(0, maxCaptionLength)
    : caption;
}

function resolvePrivacyLevel(
  post: PostResponseDto,
  privacyLevelOptions: string[] | undefined,
) {
  const privacyLevel = getStringMetadata(post.metadata, "privacy_level") ?? "SELF_ONLY";

  if (!privacyLevelOptions?.includes(privacyLevel)) {
    throw new Error(`TikTok privacy level ${privacyLevel} is not available for this account.`);
  }

  return privacyLevel;
}

async function refreshAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: AccountSecretRecord,
) {
  if (!account.refreshToken) {
    throw new Error("TikTok refresh token is missing.");
  }

  ensureTikTokConfigured(config);

  const body = new URLSearchParams({
    client_key: config.tiktokClientKey!,
    client_secret: config.tiktokClientSecret!,
    grant_type: "refresh_token",
    refresh_token: account.refreshToken,
  });
  const token = await exchangeToken(body);

  await accountsRepository.updateTokens(account.id, {
    accessToken: token.access_token!,
    refreshToken: token.refresh_token ?? account.refreshToken,
    tokenExpiry: toExpiryDate(token.expires_in),
  });

  return token.access_token!;
}

async function resolveAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: AccountSecretRecord,
) {
  if (!account.tokenExpiry || new Date(account.tokenExpiry).getTime() <= Date.now() + tokenRefreshSkewMs) {
    return refreshAccessToken(config, accountsRepository, account);
  }

  return account.accessToken;
}

export function buildTikTokService(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  videosRepository: VideosRepository,
): TikTokService {
  return {
    getConnectUrl({ userId, redirectUri }) {
      ensureTikTokConfigured(config);
      const url = new URL(authUrl);
      url.searchParams.set("client_key", config.tiktokClientKey!);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", tiktokScopes.join(","));
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", createState(userId, config.tiktokClientSecret!));

      return url.toString();
    },

    async handleCallback({ code, state, redirectUri }) {
      ensureTikTokConfigured(config);
      const userId = parseState(state, config.tiktokClientSecret!);
      const token = await exchangeToken(new URLSearchParams({
        client_key: config.tiktokClientKey!,
        client_secret: config.tiktokClientSecret!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }));
      const userInfo = await getUserInfo(token.access_token!);
      const accountName = userInfo.display_name
        ?? userInfo.open_id
        ?? token.open_id
        ?? "TikTok Account";

      return accountsRepository.upsertConnectedAccount({
        platform: "tiktok",
        accountName,
        accessToken: token.access_token!,
        refreshToken: token.refresh_token ?? null,
        tokenExpiry: toExpiryDate(token.expires_in),
        userId,
        metadata: {
          openId: userInfo.open_id ?? token.open_id ?? null,
          unionId: userInfo.union_id ?? null,
          displayName: userInfo.display_name ?? null,
          avatarUrl: userInfo.avatar_url ?? null,
          scope: token.scope ?? null,
          tokenType: token.token_type ?? null,
          refreshExpiresAt: toExpiryDate(token.refresh_expires_in)?.toISOString() ?? null,
        },
      });
    },

    async publishPost(post, userId) {
      const account = await accountsRepository.findSecretForUser(post.accountId, userId);

      if (!account || account.platform !== "tiktok") {
        throw new Error("TikTok account was not found.");
      }

      const video = await videosRepository.findForUser(post.videoId, userId);

      if (!video) {
        throw new Error("Video was not found.");
      }

      const accessToken = await resolveAccessToken(config, accountsRepository, account);
      const videoUrl = video.processedUrl ?? video.originalUrl;
      const creatorInfo = await getCreatorInfo(accessToken);
      const privacyLevel = resolvePrivacyLevel(post, creatorInfo.privacy_level_options);
      const response = await fetch(directPostUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: resolveCaption(post),
            privacy_level: privacyLevel,
            disable_comment: creatorInfo.comment_disabled
              || getBooleanMetadata(post.metadata, "disable_comment")
              || false,
            disable_duet: creatorInfo.duet_disabled
              || getBooleanMetadata(post.metadata, "disable_duet")
              || false,
            disable_stitch: creatorInfo.stitch_disabled
              || getBooleanMetadata(post.metadata, "disable_stitch")
              || false,
            brand_content_toggle: getBooleanMetadata(post.metadata, "brand_content_toggle")
              || false,
            brand_organic_toggle: getBooleanMetadata(post.metadata, "brand_organic_toggle")
              || false,
            is_aigc: getBooleanMetadata(post.metadata, "is_aigc") || false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        }),
      });
      const data = await readJson<TikTokDirectPostResponse>(response);

      if (!response.ok || data.error?.code && data.error.code !== "ok" || !data.data?.publish_id) {
        throw new Error(getTikTokErrorMessage(response, data.error, "TikTok video publish failed"));
      }

      return {
        externalPostId: data.data.publish_id,
      };
    },
  };
}
