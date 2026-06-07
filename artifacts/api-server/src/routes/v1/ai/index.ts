import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AiJobNotFoundError,
  AiVideoNotFoundError,
  CaptionsNotReadyError,
  LtxGenerationCapReachedError,
  LtxNotConfiguredError,
} from "../../../services/ai.service";

function getCurrentUserId(request: FastifyRequest): string {
  if (!request.currentUser) {
    throw new Error("Authenticated user was not attached to the request.");
  }
  return request.currentUser.id;
}

function sendError(reply: FastifyReply, statusCode: number, message: string) {
  reply.code(statusCode).send({
    statusCode,
    error:
      statusCode === 404 ? "Not Found"
      : statusCode === 409 ? "Conflict"
      : statusCode === 429 ? "Too Many Requests"
      : statusCode === 503 ? "Service Unavailable"
      : statusCode >= 500 ? "Internal Server Error"
      : "Bad Request",
    message,
  });
}

interface ViralityRequestBody {
  videoId: string;
  force?: boolean;
}

interface ViralityJobParams {
  jobId: string;
}

interface CaptionsRequestBody {
  videoId: string;
  style?: "stroke" | "yellow" | "pill";
  wordsPerFlash?: number;
  modelSize?: "tiny" | "base" | "small" | "medium" | "large";
  force?: boolean;
}

interface CaptionApproveParams {
  jobId: string;
}

interface EnhanceRequestBody {
  videoId: string;
  upscale?: boolean;
  faceRestore?: boolean;
}

interface LtxRequestBody {
  prompt: string;
  style?: string;
  durationSec: number;
  resolution?: "1080x1920" | "1920x1080" | "1440x2560";
}

interface JobParams {
  jobId: string;
}

export default async function aiRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: ViralityRequestBody }>("/virality/predict", {
    schema: {
      body: { $ref: "viralityPredictRequest#" },
      response: {
        200: { $ref: "viralityJob#" },
        202: { $ref: "viralityJob#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const job = await fastify.viralityService.requestPrediction(
        request.body.videoId,
        userId,
        request.body.force ?? false,
      );
      reply.code(job.status === "queued" ? 202 : 200);
      return job;
    } catch (error) {
      if (error instanceof AiVideoNotFoundError) {
        sendError(reply, 404, "Video was not found.");
        return;
      }
      throw error;
    }
  });

  fastify.get<{ Params: ViralityJobParams }>("/virality/jobs/:jobId", {
    schema: {
      response: {
        200: { $ref: "viralityJob#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      getCurrentUserId(request);
      return await fastify.viralityService.getJob(request.params.jobId);
    } catch (error) {
      if (error instanceof AiJobNotFoundError) {
        sendError(reply, 404, "Virality job was not found.");
        return;
      }
      throw error;
    }
  });

  fastify.post<{ Body: CaptionsRequestBody }>("/captions/generate", {
    schema: {
      body: { $ref: "captionsGenerateRequest#" },
      response: {
        202: { $ref: "aiJobAcceptedResponse#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const job = await fastify.aiService.enqueueCaptions({
        videoId: request.body.videoId,
        userId,
        style: request.body.style,
        wordsPerFlash: request.body.wordsPerFlash,
        modelSize: request.body.modelSize,
        force: request.body.force,
      });
      reply.code(202);
      return { jobId: job.jobId, status: job.status };
    } catch (error) {
      if (error instanceof AiVideoNotFoundError) {
        sendError(reply, 404, "Video was not found.");
        return;
      }
      throw error;
    }
  });

  fastify.post<{ Params: CaptionApproveParams }>("/captions/jobs/:jobId/approve", {
    schema: {
      response: {
        200: { $ref: "video#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
        409: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      return await fastify.aiService.approveCaptions({
        jobId: request.params.jobId,
        userId,
      });
    } catch (error) {
      if (error instanceof AiJobNotFoundError) {
        sendError(reply, 404, "Caption job was not found.");
        return;
      }
      if (error instanceof AiVideoNotFoundError) {
        sendError(reply, 404, "Video was not found.");
        return;
      }
      if (error instanceof CaptionsNotReadyError) {
        sendError(reply, 409, error.message);
        return;
      }
      throw error;
    }
  });

  fastify.post<{ Body: EnhanceRequestBody }>("/enhance", {
    schema: {
      body: { $ref: "enhanceRequest#" },
      response: {
        202: { $ref: "aiJobAcceptedResponse#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const job = await fastify.aiService.enqueueEnhance({
        videoId: request.body.videoId,
        userId,
        upscale: Boolean(request.body.upscale),
        faceRestore: Boolean(request.body.faceRestore),
      });
      reply.code(202);
      return { jobId: job.jobId, status: job.status };
    } catch (error) {
      if (error instanceof AiVideoNotFoundError) {
        sendError(reply, 404, "Video was not found.");
        return;
      }
      throw error;
    }
  });

  fastify.post<{ Body: LtxRequestBody }>("/generate/ltx", {
    schema: {
      body: { $ref: "ltxGenerateRequest#" },
      response: {
        202: { $ref: "ltxGenerateResponse#" },
        401: { $ref: "errorResponse#" },
        429: { $ref: "errorResponse#" },
        503: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = getCurrentUserId(request);
      const { job, estimatedCostUsd } = await fastify.aiService.enqueueLtxGeneration({
        userId,
        prompt: request.body.prompt,
        style: request.body.style,
        durationSec: request.body.durationSec,
        resolution: request.body.resolution,
      });
      reply.code(202);
      return { jobId: job.jobId, status: job.status, estimatedCostUsd };
    } catch (error) {
      if (error instanceof LtxNotConfiguredError) {
        sendError(reply, 503, error.message);
        return;
      }
      if (error instanceof LtxGenerationCapReachedError) {
        sendError(reply, 429, error.message);
        return;
      }
      throw error;
    }
  });

  fastify.get<{ Params: JobParams }>("/jobs/:jobId", {
    schema: {
      response: {
        200: { $ref: "aiJobStatus#" },
        401: { $ref: "errorResponse#" },
        404: { $ref: "errorResponse#" },
      },
    },
  }, async (request, reply) => {
    try {
      getCurrentUserId(request);
      return await fastify.aiService.getJob(request.params.jobId);
    } catch (error) {
      if (error instanceof AiJobNotFoundError) {
        sendError(reply, 404, "AI job was not found.");
        return;
      }
      throw error;
    }
  });
}
