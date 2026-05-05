import fp from "fastify-plugin";
import { videoStatusValues } from "@workspace/db";

const uuidPattern =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$";

export default fp(async function videoSchemas(fastify) {
  fastify.addSchema({
    $id: "video",
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: uuidPattern },
      userId: { type: "string", pattern: uuidPattern },
      originalUrl: { type: "string" },
      processedUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
      duration: { anyOf: [{ type: "integer" }, { type: "null" }] },
      status: { type: "string", enum: [...videoStatusValues] },
      createdAt: { type: "string" },
    },
    required: [
      "id",
      "userId",
      "originalUrl",
      "processedUrl",
      "duration",
      "status",
      "createdAt",
    ],
  });

  fastify.addSchema({
    $id: "videosCollection",
    type: "object",
    additionalProperties: false,
    properties: {
      data: {
        type: "array",
        items: { $ref: "video#" },
      },
    },
    required: ["data"],
  });
}, {
  name: "video-schemas",
});
