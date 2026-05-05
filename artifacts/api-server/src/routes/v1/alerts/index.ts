import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  AlertNotFoundError,
  alertParamsSchema,
} from "../../../services/alerts.service";

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
    message: "Alert was not found.",
  });
}

export default async function alertsRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    schema: {
      response: {
        200: { $ref: "alertsCollection#" },
        401: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request) => {
    const userId = getCurrentUserId(request);
    const alerts = await fastify.alertsService.listAlerts(userId);

    return { data: alerts };
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
      const { id } = alertParamsSchema.parse(request.params);
      const userId = getCurrentUserId(request);

      await fastify.alertsService.dismissAlert(id, userId);
      reply.code(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error.issues[0]?.message ?? "Request validation failed.");
        return;
      }

      if (error instanceof AlertNotFoundError) {
        sendNotFound(reply);
        return;
      }

      throw error;
    }
  });
}
