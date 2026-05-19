import fp from "fastify-plugin";

const uuidPattern =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export default fp(async function aiSchemas(fastify) {
  fastify.addSchema({
    $id: "viralityShapEntry",
    type: "object",
    additionalProperties: false,
    properties: {
      msg: { type: "string" },
      impact: { type: "number" },
    },
    required: ["msg", "impact"],
  });

  fastify.addSchema({
    $id: "viralityLlmAnalysis",
    type: "object",
    additionalProperties: false,
    properties: {
      video_summary: { type: "string" },
      hook_score: { type: "integer", minimum: 0, maximum: 10 },
      clarity_score: { type: "integer", minimum: 0, maximum: 10 },
      quality_score: { type: "integer", minimum: 0, maximum: 10 },
      hook_type: { type: "string" },
      tone: { type: "string" },
      emotion: { type: "string" },
      content_category: { type: "string" },
      engagement_triggers: { type: "array", items: { type: "string" } },
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array", items: { type: "string" } },
      improvement_suggestion: { type: "string" },
    },
    required: [
      "video_summary",
      "hook_score",
      "clarity_score",
      "quality_score",
      "hook_type",
      "tone",
      "emotion",
      "content_category",
      "engagement_triggers",
      "strengths",
      "weaknesses",
      "improvement_suggestion",
    ],
  });

  fastify.addSchema({
    $id: "viralityPrediction",
    type: "object",
    additionalProperties: false,
    properties: {
      video: { type: "string" },
      predicted_views_estimate: { type: "integer", minimum: 0 },
      viral_tier: { type: "string" },
      shap_pushing_up: { type: "array", items: { $ref: "viralityShapEntry#" } },
      shap_dragging_down: { type: "array", items: { $ref: "viralityShapEntry#" } },
      llm_analysis: { $ref: "viralityLlmAnalysis#" },
      hook_transcript: { type: "string" },
    },
    required: [
      "video",
      "predicted_views_estimate",
      "viral_tier",
      "shap_pushing_up",
      "shap_dragging_down",
      "llm_analysis",
      "hook_transcript",
    ],
  });

  fastify.addSchema({
    $id: "viralityPredictRequest",
    type: "object",
    additionalProperties: false,
    properties: {
      videoId: { type: "string", pattern: uuidPattern },
    },
    required: ["videoId"],
  });

  fastify.addSchema({
    $id: "captionsGenerateRequest",
    type: "object",
    additionalProperties: false,
    properties: {
      videoId: { type: "string", pattern: uuidPattern },
      style: { type: "string", enum: ["stroke", "yellow", "pill"] },
    },
    required: ["videoId"],
  });

  fastify.addSchema({
    $id: "enhanceRequest",
    type: "object",
    additionalProperties: false,
    properties: {
      videoId: { type: "string", pattern: uuidPattern },
      upscale: { type: "boolean", default: false },
      faceRestore: { type: "boolean", default: false },
    },
    required: ["videoId"],
  });

  fastify.addSchema({
    $id: "ltxGenerateRequest",
    type: "object",
    additionalProperties: false,
    properties: {
      prompt: { type: "string", minLength: 1, maxLength: 2000 },
      style: { type: "string", maxLength: 200 },
      durationSec: { type: "integer", minimum: 2, maximum: 10 },
      resolution: { type: "string", enum: ["1080x1920", "1920x1080", "1440x2560"] },
    },
    required: ["prompt", "durationSec"],
  });

  fastify.addSchema({
    $id: "ltxGenerateResponse",
    type: "object",
    additionalProperties: false,
    properties: {
      jobId: { type: "string" },
      status: { type: "string", enum: ["queued", "running", "done", "failed"] },
      estimatedCostUsd: { type: "number" },
    },
    required: ["jobId", "status", "estimatedCostUsd"],
  });

  fastify.addSchema({
    $id: "aiJobAcceptedResponse",
    type: "object",
    additionalProperties: false,
    properties: {
      jobId: { type: "string" },
      status: { type: "string", enum: ["queued", "running", "done", "failed"] },
    },
    required: ["jobId", "status"],
  });

  fastify.addSchema({
    $id: "aiJobStatus",
    type: "object",
    additionalProperties: false,
    properties: {
      jobId: { type: "string" },
      kind: { type: "string", enum: ["captions", "enhance", "ltx"] },
      status: { type: "string", enum: ["queued", "running", "done", "failed"] },
      progress: { anyOf: [{ type: "integer", minimum: 0, maximum: 100 }, { type: "null" }] },
      resultUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
      videoId: { anyOf: [{ type: "string", pattern: uuidPattern }, { type: "null" }] },
      error: { anyOf: [{ type: "string" }, { type: "null" }] },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: [
      "jobId",
      "kind",
      "status",
      "progress",
      "resultUrl",
      "videoId",
      "error",
      "createdAt",
      "updatedAt",
    ],
  });
}, {
  name: "ai-schemas",
});
