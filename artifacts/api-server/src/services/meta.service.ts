import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppConfig } from "../lib/config";
import type {
  AccountResponseDto,
  AccountSecretRecord,
  AccountsRepository,
} from "../repositories/accounts.repository";
import type { PostResponseDto } from "../repositories/posts.repository";
import type { VideosRepository } from "../repositories/videos.repository";

const graphApiVersion = "v25.0";
const graphUrl = `https://graph.facebook.com/${graphApiVersion}`;
const graphVideoUrl = `https://graph-video.facebook.com/${graphApiVersion}`;
const instagramGraphUrl = `https://graph.instagram.com/${graphApiVersion}`;
const loginDialogUrl = `https://www.facebook.com/${graphApiVersion}/dialog/oauth`;
const defaultMetaScopes = [
  "pages_show_list",
  "pages_read_engagement",
];
const instagramReadScopes = new Set(["instagram_basic", "instagram_business_basic"]);
const stateTtlMs = 10 * 60 * 1000;
const tokenRefreshSkewMs = 24 * 60 * 60 * 1000;
const defaultTokenTtlSeconds = 60 * 24 * 60 * 60;
const instagramStatusPolls = 5;

export interface MetaConnectInput {
  userId: string;
  redirectUri: string;
}

export interface MetaCallbackInput {
  code: string;
  state: string;
  redirectUri: string;
}

export interface MetaPublishResult {
  externalPostId: string;
}

export interface MetaService {
  getConnectUrl(input: MetaConnectInput): string;
  handleCallback(input: MetaCallbackInput): Promise<AccountResponseDto[]>;
  publishPost(post: PostResponseDto, userId: string): Promise<MetaPublishResult>;
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
  token_type?: string;
  expires_in?: number;
}

interface MetaUserResponse extends MetaErrorResponse {
  id?: string;
  name?: string;
}

interface MetaAccountsResponse extends MetaErrorResponse {
  data?: MetaPageAccount[];
}

interface MetaPageAccount {
  id: string;
  name: string;
  access_token?: string;
  category?: string;
  tasks?: string[];
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
  };
}

interface MetaUploadSessionResponse extends MetaErrorResponse {
  id?: string;
}

interface MetaUploadHandleResponse extends MetaErrorResponse {
  h?: string;
}

interface MetaPublishResponse extends MetaErrorResponse {
  id?: string;
  post_id?: string;
}

interface InstagramContainerStatusResponse extends MetaErrorResponse {
  status_code?: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
}

function requireMetaCredentials(config: AppConfig) {
  if (!config.metaAppId || !config.metaAppSecret) {
    throw new Error(
      "Meta integration is not configured. Set APP_ID and APP_SECRET, or META_APP_ID and META_APP_SECRET.",
    );
  }

  return {
    appId: config.metaAppId,
    appSecret: config.metaAppSecret,
  };
}

function getMetaScopes(config: AppConfig) {
  return config.metaOAuthScopes?.length ? config.metaOAuthScopes : defaultMetaScopes;
}

function hasInstagramReadScope(config: AppConfig) {
  return getMetaScopes(config).some((scope) => instagramReadScopes.has(scope));
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
    throw new Error("Invalid Meta OAuth state.");
  }

  const expected = signState(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid Meta OAuth state.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId?: unknown;
    expiresAt?: unknown;
  };

  if (typeof parsed.userId !== "string" || typeof parsed.expiresAt !== "number") {
    throw new Error("Invalid Meta OAuth state.");
  }

  if (parsed.expiresAt < Date.now()) {
    throw new Error("Expired Meta OAuth state.");
  }

  return parsed.userId;
}

function toExpiryDate(expiresIn: number | undefined) {
  const seconds = typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? expiresIn
    : defaultTokenTtlSeconds;

  return new Date(Date.now() + seconds * 1000);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function metaErrorMessage(response: Response, data: MetaErrorResponse, fallback: string) {
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

async function graphGet<T extends MetaErrorResponse>(
  path: string,
  params: Record<string, string>,
  host = graphUrl,
) {
  const url = new URL(`${host}/${path.replace(/^\/+/u, "")}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = await readJson<T>(response);

  if (!response.ok || data.error) {
    throw new Error(metaErrorMessage(response, data, "Meta Graph API request failed"));
  }

  return data;
}

async function graphPost<T extends MetaErrorResponse>(
  path: string,
  body: URLSearchParams,
  host = graphUrl,
  headers?: Record<string, string>,
) {
  const response = await fetch(`${host}/${path.replace(/^\/+/u, "")}`, {
    method: "POST",
    headers,
    body,
  });
  const data = await readJson<T>(response);

  if (!response.ok || data.error) {
    throw new Error(metaErrorMessage(response, data, "Meta Graph API request failed"));
  }

  return data;
}

function getStringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveTitle(post: PostResponseDto) {
  return getStringMetadata(post.metadata, "title") ?? "BVIRAL scheduled video";
}

function resolveDescription(post: PostResponseDto) {
  return getStringMetadata(post.metadata, "description")
    ?? getStringMetadata(post.metadata, "caption")
    ?? "";
}

function getMetadataId(account: AccountSecretRecord, key: string) {
  const value = account.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requirePageId(account: AccountSecretRecord) {
  const pageId = getMetadataId(account, "pageId");

  if (!pageId) {
    throw new Error("Meta account is missing its Page ID.");
  }

  return pageId;
}

function requireInstagramId(account: AccountSecretRecord) {
  const instagramId = getMetadataId(account, "instagramBusinessAccountId");

  if (!instagramId) {
    throw new Error("Meta account is missing its Instagram professional account ID.");
  }

  return instagramId;
}

function findPage(pages: MetaPageAccount[], pageId: string | null) {
  return pageId
    ? pages.find((page) => page.id === pageId)
    : pages[0];
}

async function exchangeCodeForToken(
  config: AppConfig,
  code: string,
  redirectUri: string,
) {
  const { appId, appSecret } = requireMetaCredentials(config);

  return graphGet<MetaTokenResponse>("oauth/access_token", {
    client_id: appId,
    redirect_uri: redirectUri,
    client_secret: appSecret,
    code,
  });
}

async function exchangeForLongLivedToken(config: AppConfig, accessToken: string) {
  const { appId, appSecret } = requireMetaCredentials(config);

  return graphGet<MetaTokenResponse>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: accessToken,
  });
}

async function getMetaUser(accessToken: string) {
  return graphGet<MetaUserResponse>("me", {
    fields: "id,name",
    access_token: accessToken,
  });
}

async function getPageAccounts(accessToken: string, includeInstagram: boolean) {
  const fields = [
    "id",
    "name",
    "access_token",
    "category",
    "tasks",
    includeInstagram ? "instagram_business_account{id,username,name}" : null,
  ].filter(Boolean).join(",");

  const response = await graphGet<MetaAccountsResponse>("me/accounts", {
    fields,
    access_token: accessToken,
  });

  return response.data ?? [];
}

async function refreshAccountToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: AccountSecretRecord,
) {
  if (!account.refreshToken) {
    throw new Error("Meta long-lived user token is missing.");
  }

  const longLivedToken = await exchangeForLongLivedToken(config, account.refreshToken);

  if (!longLivedToken.access_token) {
    throw new Error("Meta token refresh did not return an access token.");
  }

  const pages = await getPageAccounts(longLivedToken.access_token, hasInstagramReadScope(config));
  const page = findPage(pages, getMetadataId(account, "pageId"));

  if (!page?.access_token) {
    throw new Error("Meta token refresh could not find a matching Page access token.");
  }

  await accountsRepository.updateTokens(account.id, {
    accessToken: page.access_token,
    refreshToken: longLivedToken.access_token,
    tokenExpiry: toExpiryDate(longLivedToken.expires_in),
  });

  return page.access_token;
}

async function resolvePageAccessToken(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  account: AccountSecretRecord,
) {
  if (!account.tokenExpiry || new Date(account.tokenExpiry).getTime() <= Date.now() + tokenRefreshSkewMs) {
    return refreshAccountToken(config, accountsRepository, account);
  }

  return account.accessToken;
}

async function downloadVideo(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to download video for Meta upload: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim()
    || "video/mp4";

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

async function uploadVideoHandle(
  config: AppConfig,
  videoUrl: string,
  userAccessToken: string,
) {
  const { appId } = requireMetaCredentials(config);
  const { buffer, contentType } = await downloadVideo(videoUrl);
  const uploadSession = await graphPost<MetaUploadSessionResponse>(
    `${appId}/uploads`,
    new URLSearchParams({
      file_name: "bviral-video.mp4",
      file_length: String(buffer.byteLength),
      file_type: contentType === "video/mp4" ? contentType : "video/mp4",
      access_token: userAccessToken,
    }),
  );

  if (!uploadSession.id) {
    throw new Error("Meta upload session did not return an id.");
  }

  const uploadResponse = await fetch(`${graphUrl}/${uploadSession.id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${userAccessToken}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });
  const uploadHandle = await readJson<MetaUploadHandleResponse>(uploadResponse);

  if (!uploadResponse.ok || uploadHandle.error || !uploadHandle.h) {
    throw new Error(metaErrorMessage(
      uploadResponse,
      uploadHandle,
      "Meta resumable upload failed",
    ));
  }

  return uploadHandle.h;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInstagramContainer(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < instagramStatusPolls; attempt += 1) {
    const status = await graphGet<InstagramContainerStatusResponse>(containerId, {
      fields: "status_code",
      access_token: accessToken,
    });

    if (status.status_code === "FINISHED" || status.status_code === "PUBLISHED") {
      return;
    }

    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram media container status is ${status.status_code}.`);
    }

    await wait(60_000);
  }

  throw new Error("Instagram media container was not ready after polling.");
}

export function buildMetaService(
  config: AppConfig,
  accountsRepository: AccountsRepository,
  videosRepository: VideosRepository,
): MetaService {
  return {
    getConnectUrl({ userId, redirectUri }) {
      const { appId, appSecret } = requireMetaCredentials(config);
      const url = new URL(loginDialogUrl);
      url.searchParams.set("client_id", appId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", createState(userId, appSecret));
      url.searchParams.set("scope", getMetaScopes(config).join(","));
      url.searchParams.set("response_type", "code");

      return url.toString();
    },

    async handleCallback({ code, state, redirectUri }) {
      const { appSecret } = requireMetaCredentials(config);
      const userId = parseState(state, appSecret);
      const shortToken = await exchangeCodeForToken(config, code, redirectUri);

      if (!shortToken.access_token) {
        throw new Error("Meta OAuth did not return an access token.");
      }

      const longToken = await exchangeForLongLivedToken(config, shortToken.access_token);

      if (!longToken.access_token) {
        throw new Error("Meta token exchange did not return a long-lived token.");
      }

      const [metaUser, pages] = await Promise.all([
        getMetaUser(longToken.access_token),
        getPageAccounts(longToken.access_token, hasInstagramReadScope(config)),
      ]);
      const page = pages.find((candidate) => candidate.access_token);

      if (!page?.access_token) {
        throw new Error("Meta OAuth did not return any Pages with access tokens.");
      }

      const tokenExpiry = toExpiryDate(longToken.expires_in);
      const accounts: AccountResponseDto[] = [];
      accounts.push(await accountsRepository.upsertConnectedAccount({
        platform: "facebook",
        accountName: page.name,
        accessToken: page.access_token,
        refreshToken: longToken.access_token,
        tokenExpiry,
        userId,
        metadata: {
          pageId: page.id,
          pageName: page.name,
          pageCategory: page.category ?? null,
          pageTasks: page.tasks ?? [],
          metaUserId: metaUser.id ?? null,
          metaUserName: metaUser.name ?? null,
          tokenType: longToken.token_type ?? null,
        },
      }));

      if (page.instagram_business_account?.id) {
        const instagramAccount = page.instagram_business_account;
        accounts.push(await accountsRepository.upsertConnectedAccount({
          platform: "instagram",
          accountName: instagramAccount.username
            ?? instagramAccount.name
            ?? page.name,
          accessToken: page.access_token,
          refreshToken: longToken.access_token,
          tokenExpiry,
          userId,
          metadata: {
            pageId: page.id,
            pageName: page.name,
            instagramBusinessAccountId: instagramAccount.id,
            instagramUsername: instagramAccount.username ?? null,
            instagramName: instagramAccount.name ?? null,
            metaUserId: metaUser.id ?? null,
            metaUserName: metaUser.name ?? null,
            tokenType: longToken.token_type ?? null,
          },
        }));
      }

      return accounts;
    },

    async publishPost(post, userId) {
      requireMetaCredentials(config);
      const account = await accountsRepository.findSecretForUser(post.accountId, userId);

      if (!account || (account.platform !== "facebook" && account.platform !== "instagram")) {
        throw new Error("Meta account was not found.");
      }

      const video = await videosRepository.findForUser(post.videoId, userId);

      if (!video) {
        throw new Error("Video was not found.");
      }

      const pageAccessToken = await resolvePageAccessToken(config, accountsRepository, account);
      const videoUrl = video.processedUrl ?? video.originalUrl;

      if (account.platform === "facebook") {
        const userAccessToken = account.refreshToken ?? pageAccessToken;
        const fileHandle = await uploadVideoHandle(config, videoUrl, userAccessToken);
        const pageId = requirePageId(account);
        const response = await graphPost<MetaPublishResponse>(
          `${pageId}/videos`,
          new URLSearchParams({
            access_token: pageAccessToken,
            title: resolveTitle(post),
            description: resolveDescription(post),
            fbuploader_video_file_chunk: fileHandle,
          }),
          graphVideoUrl,
        );
        const postId = response.id ?? response.post_id;

        if (!postId) {
          throw new Error("Facebook video publish did not return a post id.");
        }

        return { externalPostId: postId };
      }

      const instagramId = requireInstagramId(account);
      const container = await graphPost<MetaPublishResponse>(
        `${instagramId}/media`,
        new URLSearchParams({
          access_token: pageAccessToken,
          media_type: getStringMetadata(post.metadata, "media_type") ?? "REELS",
          video_url: videoUrl,
          caption: resolveDescription(post) || resolveTitle(post),
        }),
        instagramGraphUrl,
      );

      if (!container.id) {
        throw new Error("Instagram media container creation did not return an id.");
      }

      await waitForInstagramContainer(container.id, pageAccessToken);
      const published = await graphPost<MetaPublishResponse>(
        `${instagramId}/media_publish`,
        new URLSearchParams({
          access_token: pageAccessToken,
          creation_id: container.id,
        }),
        instagramGraphUrl,
      );

      if (!published.id) {
        throw new Error("Instagram media publish did not return a post id.");
      }

      return { externalPostId: published.id };
    },
  };
}
