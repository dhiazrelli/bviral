export type NodeEnv = "development" | "test" | "production";

export interface AppConfig {
  appName: string;
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  adminToken?: string;
  dbPoolMax: number;
}

function requireString(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
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

  if (nodeEnv === "production" && !env.ADMIN_TOKEN) {
    throw new Error("ADMIN_TOKEN must be configured in production.");
  }

  return Object.freeze({
    appName: env.APP_NAME?.trim() || "bviral-api",
    nodeEnv,
    host: env.HOST?.trim() || "0.0.0.0",
    port: parsePositiveNumber(env.PORT, 3001, "PORT"),
    databaseUrl: requireString(env.DATABASE_URL, "DATABASE_URL"),
    corsOrigins,
    adminToken: env.ADMIN_TOKEN?.trim() || undefined,
    dbPoolMax: parsePositiveNumber(env.DB_POOL_MAX, 10, "DB_POOL_MAX"),
  });
}
