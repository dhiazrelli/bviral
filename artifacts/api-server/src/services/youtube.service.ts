import { createHmac, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { ensureYouTubeConfigured, type AppConfig } from "../lib/config";
import type {
  AccountResponseDto,
  AccountsRepository,
} from "../repositories/accounts.repository";
import type { PostResponseDto } from "../repositories/posts.repository";
import type { VideosRepository } from "../repositories/videos.repository";

const youtubeScopes = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];
const stateTtlMs = 10 * 60 * 1000;

export interface YouTubeConnectInput {
  userId: string;
  redirectUri: string;
}

export interface YouTubeCallbackInput {
  code: string;
  state: string;
  redirectUri: string;
}

export interface YouTubePublishResult {
  externalPostId: string;
}

export interface YouTubeService {
  getConnectUrl(input: YouTubeConnectInput): string;
  handleCallback(input: YouTubeCallbackInput): Promise<AccountResponseDto>;
  publishPost(post: PostResponseDto, userId: string): Promise<YouTubePublishResult>;
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
    throw new Error("Invalid YouTube OAuth state.");
  }

  const expected = signState(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid YouTube OAuth state.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId?: unknown;
    expiresAt?: unknown;
  };

  if (typeof parsed.userId !== "string" || typeof parsed.expiresAt !== "number") {
    throw new Error("Invalid YouTube OAuth state.");
  }

  if (parsed.expiresAt < Date.now()) {
    throw new Error("Expired YouTube OAuth state.");
  }

  return parsed.userId;
}

function createOAuthClient(config: AppConfig, redirectUri: string) {
  return new google.auth.OAuth2(
    config.youtubeClientId,
    config.youtubeClientSecret,
    redirectUri,
  );
}

function getStringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveVideoMetadata(post: PostResponseDto) {
  return {
    title: getStringMetadata(post.metadata, "title") ?? "BVIRAL scheduled video",
    description: getStringMetadata(post.metadata, "description") ?? "",
  };
}

function tokenExpiryDate(expiryDate: number | null | undefined) {
  return expiryDate ? new Date(expiryDate) : null;
}

export function buildYouTubeService(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  videosRepository: VideosRepository,
): YouTubeService {
  return {
    getConnectUrl({ userId, redirectUri }) {
      ensureYouTubeConfigured(config);
      const oauthClient = createOAuthClient(config, redirectUri);
      return oauthClient.generateAuthUrl({
        access_type: "offline",
        include_granted_scopes: true,
        prompt: "consent",
        scope: youtubeScopes,
        state: createState(userId, config.youtubeClientSecret!),
      });
    },

    async handleCallback({ code, state, redirectUri }) {
      ensureYouTubeConfigured(config);
      const userId = parseState(state, config.youtubeClientSecret!);
      const oauthClient = createOAuthClient(config, redirectUri);
      const { tokens } = await oauthClient.getToken(code);

      if (!tokens.access_token) {
        throw new Error("YouTube OAuth did not return an access token.");
      }

      oauthClient.setCredentials(tokens);
      const youtube = google.youtube({ version: "v3", auth: oauthClient });
      const channelResponse = await youtube.channels.list({
        part: ["snippet"],
        mine: true,
      });
      const channel = channelResponse.data.items?.[0];
      const channelId = channel?.id ?? null;
      const channelTitle = channel?.snippet?.title ?? "YouTube Channel";

      return accountsRepository.upsertConnectedAccount({
        platform: "youtube",
        accountName: channelTitle,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry: tokenExpiryDate(tokens.expiry_date),
        userId,
        metadata: {
          channelId,
          channelTitle,
        },
      });
    },

    async publishPost(post, userId) {
      const account = await accountsRepository.findSecretForUser(post.accountId, userId);

      if (!account || account.platform !== "youtube") {
        throw new Error("YouTube account was not found.");
      }

      if (!account.refreshToken) {
        throw new Error("YouTube refresh token is missing.");
      }

      const video = await videosRepository.findForUser(post.videoId, userId);

      if (!video) {
        throw new Error("Video was not found.");
      }

      const oauthClient = createOAuthClient(
        config,
        config.youtubeRedirectUri ?? "urn:ietf:wg:oauth:2.0:oob",
      );
      oauthClient.setCredentials({
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
        expiry_date: account.tokenExpiry ? new Date(account.tokenExpiry).getTime() : undefined,
      });

      if (!account.tokenExpiry || new Date(account.tokenExpiry).getTime() <= Date.now() + 60_000) {
        await oauthClient.getAccessToken();
        const refreshed = oauthClient.credentials;

        if (refreshed.access_token) {
          await accountsRepository.updateTokens(account.id, {
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token ?? account.refreshToken,
            tokenExpiry: tokenExpiryDate(refreshed.expiry_date),
          });
        }
      }

      const videoResponse = await fetch(video.processedUrl ?? video.originalUrl);

      if (!videoResponse.ok) {
        throw new Error(`Unable to download video for YouTube upload: ${videoResponse.status}`);
      }

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      const { title, description } = resolveVideoMetadata(post);
      const youtube = google.youtube({ version: "v3", auth: oauthClient });
      const uploadResponse = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title,
            description,
          },
          status: {
            privacyStatus: "private",
          },
        },
        media: {
          body: Readable.from(videoBuffer),
        },
      });

      const youtubeVideoId = uploadResponse.data.id;

      if (!youtubeVideoId) {
        throw new Error("YouTube upload did not return a video id.");
      }

      return {
        externalPostId: youtubeVideoId,
      };
    },
  };
}
