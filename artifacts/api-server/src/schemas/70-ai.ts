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

  // The LLM (Groq) step is non-fatal by design: if it fails or no key is set,
  // the Python service returns an empty llm_analysis and the rest of the
  // prediction (views, tier, SHAP) is still valid. So none of these fields are
  // required -- otherwise an empty llm_analysis would fail response
  // serialization and 500 the whole request.
  //
  // additionalProperties: true -- the LLM is free-form JSON and may return keys
  // beyond the ones we document; scores are `number` (not integer) because the
  // model sometimes emits fractional scores like 8.5. Strict validation here
  // would 500 the request via the anyOf in viralityJob (see note there).
  fastify.addSchema({
    $id: "viralityLlmAnalysis",
    type: "object",
    additionalProperties: true,
    properties: {
      video_summary: { type: "string" },
      hook_score: { type: "number", minimum: 0, maximum: 10 },
      clarity_score: { type: "number", minimum: 0, maximum: 10 },
      quality_score: { type: "number", minimum: 0, maximum: 10 },
      hook_type: { type: "string" },
      tone: { type: "string" },
      emotion: { type: "string" },
      content_category: { type: "string" },
      engagement_triggers: { type: "array", items: { type: "string" } },
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array", items: { type: "string" } },
      improvement_suggestion: { type: "string" },
    },
  });

  // additionalProperties: true -- the Python /analyze response carries extra
  // diagnostic fields (viral_score, processing_time_seconds, title, platform)
  // on top of the contract below, and the worker caches the payload verbatim.
  // Because `prediction` is wrapped in an anyOf in viralityJob, fast-json-
  // stringify validates it strictly with ajv (it doesn't just strip extras as
  // it would for a top-level object), so additionalProperties: false here makes
  // every anyOf branch fail -> the request 500s. Allow the extras through.
  fastify.addSchema({
    $id: "viralityPrediction",
    type: "object",
    additionalProperties: true,
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
      force: { type: "boolean", default: false },
    },
    required: ["videoId"],
  });

  // Unified shape for POST /virality/predict (200 cache hit / 202 queued) and
  // GET /virality/jobs/{jobId}. prediction is present once status is "done".
  fastify.addSchema({
    $id: "viralityJob",
    type: "object",
    additionalProperties: false,
    properties: {
      jobId: { anyOf: [{ type: "string" }, { type: "null" }] },
      status: { type: "string", enum: ["queued", "running", "done", "failed"] },
      prediction: { anyOf: [{ $ref: "viralityPrediction#" }, { type: "null" }] },
      error: { anyOf: [{ type: "string" }, { type: "null" }] },
    },
    required: ["jobId", "status", "prediction", "error"],
  });

  fastify.addSchema({
    $id: "captionsGenerateRequest",
    type: "object",
    additionalProperties: false,
    properties: {
      videoId: { type: "string", pattern: uuidPattern },
      style: { type: "string", enum: ["stroke", "yellow", "pill"] },
      wordsPerFlash: { type: "integer", minimum: 1, maximum: 10 },
      modelSize: { type: "string", enum: ["tiny", "base", "small", "medium", "large"] },
      force: { type: "boolean", default: false },
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
