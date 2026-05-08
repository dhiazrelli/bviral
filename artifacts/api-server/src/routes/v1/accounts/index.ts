import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  AccountNotFoundError,
  accountParamsSchema,
  createAccountBodySchema,
  updateAccountBodySchema,
} from "../../../services/accounts.service";
import { IntegrationNotConfiguredError } from "../../../lib/config";
import { z } from "zod";

const youtubeCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const tiktokCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  scopes: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

const metaCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  error_description: z.string().optional(),
});

function wantsJsonResponse(request: FastifyRequest) {
  const accept = request.headers.accept ?? "";
  return accept.includes("application/json");
}

function getCurrentUserId(request: FastifyRequest): string {
  if (!request.currentUser) {
    throw new Error("Authenticated user was not attached to the request.");
  }

  return request.currentUser.id;
}

function sendValidationError(reply: FastifyReply, error: ZodError) {
  reply.code(400).send({
    statusCode: 400,
    error: "Bad Request",
    message: error.issues[0]?.message ?? "Request validation failed.",
  });
}

function sendNotFound(reply: FastifyReply) {
  reply.code(404).send({
    statusCode: 404,
    error: "Not Found",
    message: "Account was not found.",
  });
}

function sendIntegrationError(reply: FastifyReply, error: unknown, fallback: string) {
  reply.code(503).send({
    statusCode: 503,
    error: "Service Unavailable",
    message: error instanceof Error ? error.message : fallback,
  });
}

function isIntegrationNotConfigured(error: unknown): error is IntegrationNotConfiguredError {
  return error instanceof IntegrationNotConfiguredError
    || (error instanceof Error && error.name === "IntegrationNotConfiguredError");
}

function getYouTubeRedirectUri(fastify: FastifyInstance, request: FastifyRequest) {
  return fastify.config.youtubeRedirectUri
    ?? `${request.protocol}://${request.hostname}/api/v1/accounts/youtube/callback`;
}

function getTikTokRedirectUri(fastify: FastifyInstance, request: FastifyRequest) {
  return fastify.config.tiktokRedirectUri
    ?? `${request.protocol}://${request.hostname}/api/v1/accounts/tiktok/callback`;
}

function getMetaRedirectUri(fastify: FastifyInstance, request: FastifyRequest) {
  return fastify.config.metaRedirectUri
    ?? `${request.protocol}://${request.hostname}/api/v1/accounts/meta/callback`;
}

function getDashboardUrl(fastify: FastifyInstance) {
  const dashboardUrl = fastify.config.dashboardUrl
    ?? fastify.config.corsOrigins[0]
    ?? (fastify.config.nodeEnv === "production" ? null : "http://localhost:5173");

  return dashboardUrl ? dashboardUrl.replace(/\/+$/, "") : "";
}

function getAccountsRedirectUrl(fastify: FastifyInstance, provider: OAuthProvider) {
  const query = new URLSearchParams({ [provider]: "connected" });
  const dashboardUrl = getDashboardUrl(fastify);
  return `${dashboardUrl}/accounts?${query.toString()}`;
}

type OAuthProvider = "youtube" | "tiktok" | "meta";

export default async function accountsRoutes(fastify: FastifyInstance) {
  fastify.get("/youtube/connect", {
    schema: {
      response: {
        200: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
          },
        },
        302: { type: "null" },
        401: { $ref: "errorResponse#" },
        503: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const url = fastify.youtubeService.getConnectUrl({
        userId,
        redirectUri: getYouTubeRedirectUri(fastify, request),
      });

      if (wantsJsonResponse(request)) {
        return { url };
      }

      return reply.redirect(url);
    } catch (error) {
      if (isIntegrationNotConfigured(error)) {
        sendIntegrationError(reply, error, "YouTube integration is not configured.");
        return;
      }
      throw error;
    }
  });

  fastify.get("/youtube/callback", {
    schema: {
      response: {
        302: { type: "null" },
        400: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const query = youtubeCallbackQuerySchema.parse(request.query);
      await fastify.youtubeService.handleCallback({
        code: query.code,
        state: query.state,
        redirectUri: getYouTubeRedirectUri(fastify, request),
      });

      return reply.redirect(getAccountsRedirectUrl(fastify, "youtube"));
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error);
        return;
      }

      reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: error instanceof Error ? error.message : "YouTube OAuth callback failed.",
      });
    }
  });

  fastify.get("/tiktok/connect", {
    schema: {
      response: {
        200: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
          },
        },
        302: { type: "null" },
        401: { $ref: "errorResponse#" },
        503: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const url = fastify.tiktokService.getConnectUrl({
        userId,
        redirectUri: getTikTokRedirectUri(fastify, request),
      });

      if (wantsJsonResponse(request)) {
        return { url };
      }

      return reply.redirect(url);
    } catch (error) {
      if (isIntegrationNotConfigured(error)) {
        sendIntegrationError(reply, error, "TikTok integration is not configured.");
        return;
      }
      throw error;
    }
  });

  fastify.get("/tiktok/callback", {
    schema: {
      response: {
        302: { type: "null" },
        400: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const query = tiktokCallbackQuerySchema.parse(request.query);

      if (query.error) {
        throw new Error(query.error_description ?? query.error);
      }

      if (!query.code || !query.state) {
        throw new Error("TikTok OAuth callback is missing code or state.");
      }

      await fastify.tiktokService.handleCallback({
        code: query.code,
        state: query.state,
        redirectUri: getTikTokRedirectUri(fastify, request),
      });

      return reply.redirect(getAccountsRedirectUrl(fastify, "tiktok"));
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error);
        return;
      }

      reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: error instanceof Error ? error.message : "TikTok OAuth callback failed.",
      });
    }
  });

  fastify.get("/meta/connect", {
    schema: {
      response: {
        200: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
          },
        },
        302: { type: "null" },
        401: { $ref: "errorResponse#" },
        503: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const url = fastify.metaService.getConnectUrl({
        userId,
        redirectUri: getMetaRedirectUri(fastify, request),
      });

      if (wantsJsonResponse(request)) {
        return { url };
      }

      return reply.redirect(url);
    } catch (error) {
      sendIntegrationError(reply, error, "Meta account connection is not configured.");
      return;
    }
  });

  fastify.get("/meta/callback", {
    schema: {
      response: {
        302: { type: "null" },
        400: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const query = metaCallbackQuerySchema.parse(request.query);

      if (query.error) {
        throw new Error(query.error_description ?? query.error_message ?? query.error);
      }

      if (!query.code || !query.state) {
        throw new Error("Meta OAuth callback is missing code or state.");
      }

      await fastify.metaService.handleCallback({
        code: query.code,
        state: query.state,
        redirectUri: getMetaRedirectUri(fastify, request),
      });

      return reply.redirect(getAccountsRedirectUrl(fastify, "meta"));
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error);
        return;
      }

      reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: error instanceof Error ? error.message : "Meta OAuth callback failed.",
      });
    }
  });

  fastify.get("/", {
    schema: {
      response: {
        200: { $ref: "accountsCollection#" },
        401: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request) => {
    const userId = getCurrentUserId(request);
    const accounts = await fastify.accountsService.listAccounts(userId);

    return { data: accounts };
  });

  fastify.post("/", {
    schema: {
      response: {
        201: { $ref: "account#" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const body = createAccountBodySchema.parse(request.body);
      const userId = getCurrentUserId(request);
      const account = await fastify.accountsService.connectAccount(body, userId);

      reply.code(201);
      return account;
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error);
        return;
      }

      throw error;
    }
  });

  fastify.get("/:id", {
    schema: {
      response: {
        200: { $ref: "account#" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = accountParamsSchema.parse(request.params);
      const userId = getCurrentUserId(request);

      return await fastify.accountsService.getAccount(id, userId);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error);
        return;
      }

      if (error instanceof AccountNotFoundError) {
        sendNotFound(reply);
        return;
      }

      throw error;
    }
  });

  fastify.patch("/:id", {
    schema: {
      response: {
        200: { $ref: "account#" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = accountParamsSchema.parse(request.params);
      const body = updateAccountBodySchema.parse(request.body);
      const userId = getCurrentUserId(request);

      const updated = await fastify.accountsService.updateAccount(id, userId, body);
      return updated;
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error);
        return;
      }

      if (error instanceof AccountNotFoundError) {
        sendNotFound(reply);
        return;
      }

      throw error;
    }
  });

  fastify.delete("/:id", {
    schema: {
      response: {
        204: { type: "null" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = accountParamsSchema.parse(request.params);
      const userId = getCurrentUserId(request);

      await fastify.accountsService.disconnectAccount(id, userId);
      reply.code(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error);
        return;
      }

      if (error instanceof AccountNotFoundError) {
        sendNotFound(reply);
        return;
      }

      throw error;
    }
  });
}
