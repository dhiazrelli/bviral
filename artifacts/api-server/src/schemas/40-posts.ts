import fp from "fastify-plugin";
import { platformValues, postStatusValues } from "@workspace/db";

const uuidPattern =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export default fp(async function postSchemas(fastify) {
  fastify.addSchema({
    $id: "post",
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: uuidPattern },
      videoId: { type: "string", pattern: uuidPattern },
      accountId: { type: "string", pattern: uuidPattern },
      platform: { type: "string", enum: [...platformValues] },
      scheduledAt: { type: "string" },
      postedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
      status: { type: "string", enum: [...postStatusValues] },
      externalPostId: { anyOf: [{ type: "string" }, { type: "null" }] },
      errorMessage: { anyOf: [{ type: "string" }, { type: "null" }] },
      metadata: { type: "object", additionalProperties: true },
      createdAt: { type: "string" },
    },
    required: [
      "id",
      "videoId",
      "accountId",
      "platform",
      "scheduledAt",
      "postedAt",
      "status",
      "externalPostId",
      "errorMessage",
      "metadata",
      "createdAt",
    ],
  });

  fastify.addSchema({
    $id: "postsCollection",
    type: "object",
    additionalProperties: false,
    properties: {
      data: {
        type: "array",
        items: { $ref: "post#" },
      },
    },
    required: ["data"],
  });
}, {
  name: "post-schemas",
});
