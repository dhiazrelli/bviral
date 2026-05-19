import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  DuplicateVideoFilenameError,
  VideoNotFoundError,
  VideoUploadConfigurationError,
  VideoUploadValidationError,
  videoParamsSchema,
} from "../../../services/videos.service";

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
    message: "Video was not found.",
  });
}

export default async function videosRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    schema: {
      response: {
        200: { $ref: "videosCollection#" },
        401: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request) => {
    const userId = getCurrentUserId(request);
    const videos = await fastify.videosService.listVideos(userId);

    return { data: videos };
  });

  fastify.get("/:id", {
    schema: {
      response: {
        200: { $ref: "video#" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = videoParamsSchema.parse(request.params);
      const userId = getCurrentUserId(request);

      return await fastify.videosService.getVideo(id, userId);
    } catch (error) {
      if (error instanceof ZodError) {
        sendValidationError(reply, error.issues[0]?.message ?? "Request validation failed.");
        return;
      }

      if (error instanceof VideoNotFoundError) {
        sendNotFound(reply);
        return;
      }

      throw error;
    }
  });

  fastify.post("/upload", {
    schema: {
      response: {
        201: { $ref: "video#" },
        400: { $ref: "errorResponse#" },
        401: { $ref: "errorResponse#" },
        409: { $ref: "duplicateVideoResponse#" },
        500: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const file = await request.file();
      const userId = getCurrentUserId(request);
      const video = await fastify.videosService.uploadVideo({ file, userId });

      reply.code(201);
      return video;
    } catch (error) {
      if (error instanceof VideoUploadValidationError) {
        sendValidationError(reply, error.message);
        return;
      }

      if (error instanceof DuplicateVideoFilenameError) {
        reply.code(409).send({
          statusCode: 409,
          error: "Conflict",
          message: error.message,
          existing: error.existing,
        });
        return;
      }

      if (error instanceof VideoUploadConfigurationError) {
        reply.code(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: error.message,
        });
        return;
      }

      throw error;
    }
  });
}
