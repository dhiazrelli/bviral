import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  AnalyticsNotFoundError,
  analyticsFilterQuerySchema,
  analyticsPostParamsSchema,
} from "../../../services/analytics.service";

function getCurrentUserId(request: FastifyRequest): string {
  if (!request.currentUser) {
    throw new Error("Authenticated user was not attached to the request.");
  }

  return request.currentUser.id;
}

function sendValidationError(reply: FastifyReply, message: string) {
  reply.code(400).send({
    statusCode: 400,
    error: "Bad Request",
    message,
  });
}

function sendNotFound(reply: FastifyReply) {
  reply.code(404).send({
    statusCode: 404,
    error: "Not Found",
    message: "Analytics were not found for this post.",
  });
}

export default async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    schema: {
      response: {
        200: { $ref: "analyticsOverview#" },
        401: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    const user = request.currentUser;

    if (!user) {
      throw new Error("Authenticated user was not attached to the request.");
    }

    if (user.role === "admin") {
      try {
        const filters = analyticsFilterQuerySchema.parse(request.query);
        return await fastify.analyticsService.getOverviewFiltered(filters);
      } catch (error) {
        if (error instanceof ZodError) {
          sendValidationError(reply, error.issues[0]?.message ?? "Query validation failed.");
          return;
        }

        throw error;
      }
    }

    return fastify.analyticsService.getOverview(getCurrentUserId(request));
  });

  fastify.get("/:post_id", {
    schema: {
      response: {
        200: { $ref: "postAnalytics#" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const { post_id: postId } = analyticsPostParamsSchema.parse(request.params);
      const userId = getCurrentUserId(request);

      return await fastify.analyticsService.getPostAnalytics(postId, userId);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error.issues[0]?.message ?? "Request validation failed.");
        return;
      }

      if (error instanceof AnalyticsNotFoundError) {
        sendNotFound(reply);
        return;
      }

      throw error;
    }
  });
}
