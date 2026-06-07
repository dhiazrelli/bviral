import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserResponseDto } from "../repositories/users";

export type AuthRole = "admin" | "content_creator";
export type AuthRouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

interface SupabaseAuthUser {
  id: string;
  aud?: string;
  role?: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: AuthRole;
  jwtRole?: string;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
  databaseUser: UserResponseDto | null;
}

const developmentUserId = "00000000-0000-4000-8000-000000000001";
const developmentUserEmail = "local-admin@bviral.dev";

// How long to wait on a single call to Supabase's /auth/v1/user, and how many
// times to retry. The previous code did a single bare fetch with no timeout,
// so any transient network blip (ETIMEDOUT reaching supabase.co) threw and
// 500'd every authenticated request. We now bound each attempt and retry
// transient failures (thrown network errors + 5xx) with a short backoff.
const SUPABASE_VERIFY_TIMEOUT_MS = 5000;
const SUPABASE_VERIFY_MAX_ATTEMPTS = 3;

/**
 * Raised when Supabase's auth API is unreachable after retries. Distinct from
 * an invalid token (which returns null -> 401): this is a transient provider
 * outage, surfaced as 503 so the client retries instead of logging the user out.
 */
class AuthProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthProviderUnavailableError";
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getBearerToken(request: FastifyRequest): string | null {
  const authorization = getHeaderValue(request.headers.authorization);

  if (!authorization) {
    return null;
  }

  const [scheme, token, ...extra] = authorization.trim().split(/\s+/u);

  if (scheme?.toLowerCase() !== "bearer" || !token || extra.length > 0) {
    return null;
  }

  return token;
}

function readStringClaim(
  metadata: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function resolveRole(
  authUser: SupabaseAuthUser,
  databaseUser: UserResponseDto | null,
): AuthRole {
  const appMetadata = authUser.app_metadata ?? {};
  const explicitRole = readStringClaim(appMetadata, [
    "app_role",
    "role",
    "user_role",
    "team_role",
  ]);

  if (explicitRole === "admin" || databaseUser?.role === "admin") {
    return "admin";
  }

  return "content_creator";
}

async function verifySupabaseToken(
  request: FastifyRequest,
  token: string,
): Promise<SupabaseAuthUser | null> {
  const url = `${request.server.config.supabaseUrl}/auth/v1/user`;
  const headers = {
    apikey: request.server.config.supabasePublishableKey,
    authorization: `Bearer ${token}`,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= SUPABASE_VERIFY_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUPABASE_VERIFY_TIMEOUT_MS);

    try {
      const response = await fetch(url, { headers, signal: controller.signal });

      // 5xx from the auth provider is transient -> retry rather than reject.
      if (response.status >= 500) {
        lastError = new Error(`Supabase auth responded ${response.status}`);
      } else {
        if (!response.ok) {
          // 401/403 etc. -> the token itself is invalid. Not retryable.
          request.log.warn(
            { statusCode: response.status, statusText: response.statusText },
            "Supabase JWT verification failed",
          );
          return null;
        }

        const data = await response.json() as Partial<SupabaseAuthUser>;

        if (typeof data.id !== "string" || !data.id) {
          return null;
        }

        return {
          id: data.id,
          aud: data.aud,
          role: data.role,
          email: data.email,
          app_metadata: data.app_metadata && typeof data.app_metadata === "object"
            ? data.app_metadata
            : {},
          user_metadata: data.user_metadata && typeof data.user_metadata === "object"
            ? data.user_metadata
            : {},
        };
      }
    } catch (error) {
      // Thrown fetch error: ETIMEDOUT / DNS / abort (our timeout). Transient.
      lastError = error;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < SUPABASE_VERIFY_MAX_ATTEMPTS) {
      await delay(200 * attempt); // 200ms, then 400ms
    }
  }

  request.log.error(
    { err: lastError },
    "Supabase JWT verification unreachable after retries",
  );
  throw new AuthProviderUnavailableError(
    "Authentication provider is temporarily unavailable. Please retry.",
  );
}

function sendAuthError(
  reply: FastifyReply,
  statusCode: 401 | 403,
  message: string,
) {
  reply.code(statusCode).send({
    statusCode,
    error: statusCode === 401 ? "Unauthorized" : "Forbidden",
    message,
  });
}

function isPublicRoute(request: FastifyRequest) {
  return request.method === "GET"
    && (
      request.url.startsWith("/api/v1/accounts/youtube/callback")
      || request.url.startsWith("/api/v1/accounts/tiktok/callback")
      || request.url.startsWith("/api/v1/accounts/meta/callback")
    );
}

function canUseDevelopmentAuth(request: FastifyRequest) {
  return request.server.config.nodeEnv !== "production"
    && Boolean(request.server.config.adminToken);
}

async function attachDevelopmentUser(request: FastifyRequest) {
  const databaseUser = await request.server.usersRepository.ensureDevelopmentUser({
    id: developmentUserId,
    email: developmentUserEmail,
    fullName: "BVIRAL Local Admin",
    role: "admin",
  });

  request.currentUser = {
    id: databaseUser.id,
    email: databaseUser.email,
    role: "admin",
    jwtRole: "development",
    appMetadata: { developmentAuth: true },
    userMetadata: {},
    databaseUser,
  };
}

export default fp(async function authPlugin(fastify) {
  fastify.decorateRequest("currentUser", null);

  fastify.decorate("authenticate", async (request, reply) => {
    if (request.currentUser) {
      return;
    }

    const token = getBearerToken(request);

    if (!token) {
      if (canUseDevelopmentAuth(request)) {
        await attachDevelopmentUser(request);
        return;
      }

      sendAuthError(reply, 401, "Authorization bearer token is required.");
      return;
    }

    let authUser: SupabaseAuthUser | null;
    try {
      authUser = await verifySupabaseToken(request, token);
    } catch (error) {
      if (error instanceof AuthProviderUnavailableError) {
        // Transient: the auth provider couldn't be reached after retries. 503
        // (not 500) tells the client this is temporary and safe to retry.
        reply.code(503).send({
          statusCode: 503,
          error: "Service Unavailable",
          message: error.message,
        });
        return;
      }
      throw error;
    }

    if (!authUser) {
      sendAuthError(reply, 401, "Authorization bearer token is invalid.");
      return;
    }

    const databaseUser = await fastify.usersRepository.findById(authUser.id);
    const role = resolveRole(authUser, databaseUser);

    if (databaseUser?.suspendedAt && role !== "admin") {
      sendAuthError(reply, 403, "This account is suspended. Contact an administrator.");
      return;
    }

    request.currentUser = {
      id: authUser.id,
      email: authUser.email ?? databaseUser?.email,
      role,
      jwtRole: authUser.role,
      appMetadata: authUser.app_metadata ?? {},
      userMetadata: authUser.user_metadata ?? {},
      databaseUser,
    };
  });

  fastify.decorate("requireRole", (...roles: AuthRole[]) => {
    return async (request, reply) => {
      await fastify.authenticate(request, reply);

      if (reply.sent) {
        return;
      }

      if (!request.currentUser || !roles.includes(request.currentUser.role)) {
        sendAuthError(reply, 403, "Your role is not allowed to access this route.");
      }
    };
  });

  fastify.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS" || isPublicRoute(request)) {
      return;
    }

    await fastify.authenticate(request, reply);
  });
}, {
  name: "auth-plugin",
  dependencies: ["repositories-plugin"],
});
