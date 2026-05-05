import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  PostCancellationError,
  PostNotFoundError,
  PostValidationError,
  createPostBodySchema,
  postParamsSchema,
} from "../../../services/posts.service";

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
    message: "Post was not found.",
  });
}

function sendConflict(reply: FastifyReply, message: string) {
  reply.code(409).send({
    statusCode: 409,
    error: "Conflict",
    message,
  });
}

export default async function postsRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    schema: {
      response: {
        200: { $ref: "postsCollection#" },
        401: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request) => {
    const userId = getCurrentUserId(request);
    const posts = await fastify.postsService.listPosts(userId);

    return { data: posts };
  });

  fastify.post("/", {
    schema: {
      response: {
        201: { $ref: "post#" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const body = createPostBodySchema.parse(request.body);
      const userId = getCurrentUserId(request);
      const post = await fastify.postsService.createPost(body, userId);

      reply.code(201);
      return post;
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error.issues[0]?.message ?? "Request validation failed.");
        return;
      }

      if (error instanceof PostValidationError) {
        sendValidationError(reply, error.message);
        return;
      }

      throw error;
    }
  });

  fastify.get("/:id", {
    schema: {
      response: {
        200: { $ref: "post#" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = postParamsSchema.parse(request.params);
      const userId = getCurrentUserId(request);

      return await fastify.postsService.getPost(id, userId);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error.issues[0]?.message ?? "Request validation failed.");
        return;
      }

      if (error instanceof PostNotFoundError) {
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
        409: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = postParamsSchema.parse(request.params);
      const userId = getCurrentUserId(request);

      await fastify.postsService.cancelPost(id, userId);
      reply.code(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error.issues[0]?.message ?? "Request validation failed.");
        return;
      }

      if (error instanceof PostNotFoundError) {
        sendNotFound(reply);
        return;
      }

      if (error instanceof PostCancellationError) {
        sendConflict(reply, error.message);
        return;
      }

      throw error;
    }
  });
}
