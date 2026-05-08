export type NodeEnv = "development" | "test" | "production";

export interface AppConfig {
  appName: string;
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  dashboardUrl?: string;
  adminToken?: string;
  dbPoolMax: number;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey?: string;
  supabaseVideoBucket: string;
  redisUrl: string;
  // OAuth credentials are intentionally optional. The server boots fine
  // without them; routes that require them throw a 503 with a clear message
  // so devs can iterate on the dashboard without configuring every provider.
  youtubeClientId?: string;
  youtubeClientSecret?: string;
  youtubeRedirectUri?: string;
  tiktokClientKey?: string;
  tiktokClientSecret?: string;
  tiktokRedirectUri?: string;
  metaAppId?: string;
  metaAppSecret?: string;
  metaRedirectUri?: string;
}

/**
 * Throw a 503-shaped error when an OAuth integration is reached without
 * the required env credentials. Lets the platform services stay simple.
 */
export class IntegrationNotConfiguredError extends Error {
  readonly statusCode = 503;
  readonly name = "IntegrationNotConfiguredError";

  constructor(integration: string, missingEnvVars: string[]) {
    super(
      `${integration} is not configured. Missing environment variables: `
        + missingEnvVars.join(", ")
        + ". Set them and restart the API server.",
    );
  }
}

function getSupabaseDirectConnectionMessage(name: string) {
  return `${name} is using Supabase's direct database host. This often fails on local IPv4-only networks because the direct host is IPv6-first. Replace it with the Supabase Session pooler connection string from the dashboard Connect panel.`;
}

function validateDatabaseUrl(value: string, name: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection string.`);
  }

  const isSupabaseDirectHost =
    url.hostname.startsWith("db.")
    && url.hostname.endsWith(".supabase.co")
    && url.port === "5432";

  if (isSupabaseDirectHost) {
    throw new Error(getSupabaseDirectConnectionMessage(name));
  }

  return value;
}

function requireString(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} environment variable is required.`);
  }

  return validateDatabaseUrl(value, name);
}

function requireTrimmedString(value: string | undefined, name: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${name} environment variable is required.`);
  }

  return trimmed;
}

function optionalTrimmedString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function validateSupabaseUrl(value: string, name: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error(`${name} must use HTTPS outside localhost.`);
  }

  return value.replace(/\/+$/, "");
}

function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function resolveNodeEnv(value: string | undefined): NodeEnv {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = resolveNodeEnv(env.NODE_ENV);
  const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];

  if (nodeEnv === "production" && corsOrigins.length === 0) {
    throw new Error("CORS_ORIGINS must be configured in production.");
  }

  return Object.freeze({
    appName: env.APP_NAME?.trim() || "bviral-api",
    nodeEnv,
    host: env.HOST?.trim() || "0.0.0.0",
    port: parsePositiveNumber(env.PORT, 3001, "PORT"),
    databaseUrl: requireString(env.DATABASE_URL, "DATABASE_URL"),
    corsOrigins,
    dashboardUrl: optionalTrimmedString(
      env.DASHBOARD_URL ?? env.FRONTEND_URL ?? env.VITE_DASHBOARD_URL,
    ),
    adminToken: env.ADMIN_TOKEN?.trim() || undefined,
    dbPoolMax: parsePositiveNumber(env.DB_POOL_MAX, 10, "DB_POOL_MAX"),
    supabaseUrl: validateSupabaseUrl(
      requireTrimmedString(
        env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
        "SUPABASE_URL",
      ),
      "SUPABASE_URL",
    ),
    supabasePublishableKey: requireTrimmedString(
      env.SUPABASE_PUBLISHABLE_KEY
        ?? env.VITE_SUPABASE_PUBLISHABLE_KEY
        ?? env.SUPABASE_ANON_KEY,
      "SUPABASE_PUBLISHABLE_KEY",
    ),
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      || env.SUPABASE_SECRET_KEY?.trim()
      || undefined,
    supabaseVideoBucket: env.SUPABASE_VIDEO_BUCKET?.trim() || "videos",
    redisUrl: env.REDIS_URL?.trim() || "redis://127.0.0.1:6379",
    youtubeClientId: optionalTrimmedString(env.YOUTUBE_CLIENT_ID),
    youtubeClientSecret: optionalTrimmedString(env.YOUTUBE_CLIENT_SECRET),
    youtubeRedirectUri: optionalTrimmedString(env.YOUTUBE_REDIRECT_URI),
    tiktokClientKey: optionalTrimmedString(env.TIKTOK_CLIENT_KEY),
    tiktokClientSecret: optionalTrimmedString(env.TIKTOK_CLIENT_SECRET),
    tiktokRedirectUri: optionalTrimmedString(env.TIKTOK_REDIRECT_URI),
    metaAppId: optionalTrimmedString(
      env.APP_ID ?? env.META_APP_ID ?? env.FACEBOOK_APP_ID,
    ),
    metaAppSecret: optionalTrimmedString(
      env.APP_SECRET ?? env.META_APP_SECRET ?? env.FACEBOOK_APP_SECRET,
    ),
    metaRedirectUri: optionalTrimmedString(
      env.META_REDIRECT_URI ?? env.FACEBOOK_REDIRECT_URI,
    ),
  });
}

export function ensureYouTubeConfigured(config: AppConfig): config is AppConfig & {
  youtubeClientId: string;
  youtubeClientSecret: string;
} {
  const missing: string[] = [];
  if (!config.youtubeClientId) missing.push("YOUTUBE_CLIENT_ID");
  if (!config.youtubeClientSecret) missing.push("YOUTUBE_CLIENT_SECRET");
  if (missing.length > 0) {
    throw new IntegrationNotConfiguredError("YouTube OAuth", missing);
  }
  return true;
}

export function ensureTikTokConfigured(config: AppConfig): config is AppConfig & {
  tiktokClientKey: string;
  tiktokClientSecret: string;
} {
  const missing: string[] = [];
  if (!config.tiktokClientKey) missing.push("TIKTOK_CLIENT_KEY");
  if (!config.tiktokClientSecret) missing.push("TIKTOK_CLIENT_SECRET");
  if (missing.length > 0) {
    throw new IntegrationNotConfiguredError("TikTok OAuth", missing);
  }
  return true;
}

export function ensureMetaConfigured(config: AppConfig): config is AppConfig & {
  metaAppId: string;
  metaAppSecret: string;
} {
  const missing: string[] = [];
  if (!config.metaAppId) missing.push("META_APP_ID (or APP_ID / FACEBOOK_APP_ID)");
  if (!config.metaAppSecret) missing.push("META_APP_SECRET (or APP_SECRET / FACEBOOK_APP_SECRET)");
  if (missing.length > 0) {
    throw new IntegrationNotConfiguredError("Meta OAuth", missing);
  }
  return true;
}
